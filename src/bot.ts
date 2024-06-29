import TelegramBot from 'node-telegram-bot-api';
import { registerMe, sendMyStats, sendOtherPlayerStats, sendPlayerRatings } from './actions';
import { calculateEloRating } from './elo';
import { getPlayerByUsername, updatePlayerProfiles } from './persistance/firebase';
import { createMatchReportInfoMessage, createMatchReportMessage } from './common/message-builder';
import { calculateMatchResult } from './common/helpers';

const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
if (!telegramBotToken) {
  throw new Error("Missing environment variables");
}

const bot = new TelegramBot(telegramBotToken, { polling: true });
const userStates: { [key: number]: { step: string } } = {};

bot.onText(/\/start/, async (msg) => {
  console.log('/start by', msg.from?.username);

  const chatId = msg.chat.id;
  const messageThreadId = msg.message_thread_id ?? 0;

  bot.sendMessage(chatId, "Welcome to the Tennis Elo Rating Bot! Use the menu below to navigate.", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Register Me", callback_data: 'register_me' }, { text: "View Ratings", callback_data: 'view_ratings' }],
        [{ text: "Report Match Result", callback_data: 'report_match' }, { text: "My Stats", callback_data: 'my_stats' }]
      ]
    },
    message_thread_id: messageThreadId
  });
});

bot.onText(/\/mystats(@\w+)?/, async (msg, match) => {
  console.log('/mystats by', msg.from?.username, match);

  const chatId = msg.chat.id;
  const userId = msg.from?.id || 0;
  const messageThreadId = msg.message_thread_id ?? 0;

  let playerUsername = '';

  if (match && match[1] && match[1] !== '@tennis_lisboa_bot') {
    playerUsername = match[1].slice(1); // Remove "@" symbol
    await sendOtherPlayerStats(bot, chatId, messageThreadId, playerUsername);
  } else {
    await sendMyStats(bot, chatId, messageThreadId, userId);
  }

});

bot.onText(/\/ratings/, async (msg) => {
  console.log('/ratings by', msg.from?.username);

  const chatId = msg.chat.id;
  const messageThreadId = msg.message_thread_id ?? 0;

  await sendPlayerRatings(bot, chatId, messageThreadId);
});

bot.onText(/\/matchresult(.*)/, (msg, match) => {
  console.log('/matchresult by', msg.from?.username, match);

  const chatId = msg.chat.id;
  const messageThreadId = msg.message_thread_id ?? 0;

  if (!match) {
    bot.sendMessage(chatId, createMatchReportInfoMessage(), { parse_mode: 'Markdown', message_thread_id: messageThreadId });
    return;
  }

  const userId = msg.from?.id || 0;
  const username = msg.from?.username || '';
  const input = match[1].trim();

  // console.log(input);

  if (!input || input === '@tennis_lisboa_bot') {
    userStates[userId] = { step: 'awaiting_match_details' };
    bot.sendMessage(chatId, createMatchReportInfoMessage(), { message_thread_id: messageThreadId });
  } else {
    handleMatchResultInput(chatId, messageThreadId, username, input);
  }
});

const handleMatchResultInput = async (chatId: number, messageThreadId: number, username: string, input: string): Promise<boolean> => {
  console.log('handle /matchresult by', username, input);

  const selfMatchRegex = /@(\w+)\s(\d+-\d+(\s\d+-\d+){0,2})/;
  const otherMatchRegex = /@(\w+)\s-\s@(\w+)\s(\d+-\d+(\s\d+-\d+){0,2})/;

  let playerUsername: string | undefined;
  let opponentUsername: string | undefined;
  let score: string | undefined;

  let selfMatch = input.match(selfMatchRegex);
  let match = input.match(otherMatchRegex);

  if (match) {
    [, playerUsername, opponentUsername, score] = match;
  } else if (selfMatch) {
    [, opponentUsername, score] = selfMatch;
    playerUsername = username; 
  } else {
    bot.sendMessage(chatId, 'Invalid format. Please use:\n- @opponentUsername 6-2 6-2\n- @playerUsername - @opponentUsername 6-2 6-2 10-8', { message_thread_id: messageThreadId });
    return false;
  }

  if (!playerUsername || !opponentUsername || !score) {
    bot.sendMessage(chatId, 'Invalid format. Please ensure you are using the correct format.', { message_thread_id: messageThreadId });
    return false;
  }

  // Process the match result, calculate new ELO ratings, update Firebase, etc.
  try {
    const player = await getPlayerByUsername(playerUsername);
    const opponent = await getPlayerByUsername(opponentUsername);

    if (!player || !opponent) {
      console.log('One or both players not found.')
      bot.sendMessage(chatId, 'One or both players not found.', { message_thread_id: messageThreadId });
      return false;
    }

    const matchResult = calculateMatchResult(player, opponent, score);
    const eloResult = await calculateEloRating(matchResult.winner, matchResult.loser);

    await updatePlayerProfiles(matchResult, eloResult);

    bot.sendMessage(chatId, createMatchReportMessage(matchResult.winner, matchResult.loser, score, eloResult), { parse_mode: 'Markdown', reply_to_message_id: messageThreadId });
  } catch(error) {
    console.log(error);
    return false;
  }

  return true;
}

bot.on('callback_query', async (query) => {
  const chatId = query.message?.chat.id as number;
  const messageThreadId = query.message?.message_thread_id ?? 0;

  switch (query.data) {
    case 'register_me':
      if (query.from) {
        console.log('callback [register_me] by', query.from.username);

        const telegramId = query.from.id as number;
        const telegramUsername = query.from.username || '';
        const name = `${query.from?.first_name ?? ''} ${query.from?.last_name ?? ''}`;

        await registerMe(bot, chatId, messageThreadId, name, telegramId, telegramUsername);
      }
      break;
    case 'view_ratings':
      console.log('callback [view_ratings] by', query.from.username);
      await sendPlayerRatings(bot, chatId, messageThreadId);
      break;
    case 'report_match':
      console.log('callback [report_match] by', query.from.username);
      userStates[query.from.id] = { step: 'awaiting_match_details' };
      bot.sendMessage(chatId, createMatchReportInfoMessage(), {parse_mode: 'Markdown', message_thread_id: messageThreadId });
      break;
    case 'my_stats':
      if (query.from) {
        console.log('callback [my_stats] by', query.from.username);
        const telegramId = query.from.id as number;
        await sendMyStats(bot, chatId, messageThreadId, telegramId);
      }
      break;
    default:
      bot.sendMessage(chatId, 'Unknown command', { message_thread_id: messageThreadId });
  }
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const messageId = msg.message_id;
  const userId = msg.from?.id || 0;
  const username = msg.from?.username || '';
  const text = msg.text?.trim() || '';

  if (userStates[userId] && userStates[userId].step === 'awaiting_match_details') {
    if (text.startsWith('/')) {
      // If a new command is received, reset the state
      delete userStates[userId];
    } else if (userStates[userId].step === 'awaiting_match_details') {
      delete userStates[userId];  
      handleMatchResultInput(chatId, messageId, username, text);
      return;
    }
  }
});

export default bot;