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
  const chatId = msg.chat.id;

  bot.sendMessage(chatId, "Welcome to the Tennis Elo Rating Bot! Use the menu below to navigate.", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Register Me", callback_data: 'register_me' }, { text: "View Ratings", callback_data: 'view_ratings' }],
        [{ text: "Report Match Result", callback_data: 'report_match' }, { text: "My Stats", callback_data: 'my_stats' }]
      ]
    }
  });
});

bot.onText(/\/mystats(@\w+)?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id || 0;

  let playerUsername = '';

  if (match && match[1]) {
    playerUsername = match[1].slice(1); // Remove "@" symbol
    await sendOtherPlayerStats(bot, chatId, playerUsername);
  } else {
    await sendMyStats(bot, chatId, userId);
  }

});

bot.onText(/\/ratings/, async (msg) => {
  const chatId = msg.chat.id;

  await sendPlayerRatings(bot, chatId);
});

bot.onText(/\/matchresult(.*)/, (msg, match) => {
  const chatId = msg.chat.id;

  if (!match) {
    bot.sendMessage(chatId, createMatchReportInfoMessage(), {parse_mode: 'Markdown'});
    return;
  }

  const userId = msg.from?.id || 0;
  const username = msg.from?.username || '';
  const input = match[1].trim();

  if (!input) {
    userStates[userId] = { step: 'awaiting_match_details' };
    bot.sendMessage(chatId, createMatchReportInfoMessage());
  } else {
    handleMatchResultInput(chatId, username, input);
  }
});

const handleMatchResultInput = async (chatId: number, username: string, input: string): Promise<boolean> => {
  const selfMatchRegex = /@(\w+)\s(\d+-\d+(\s\d+-\d+){0,2})/;
  const otherMatchRegex = /@(\w+)\s-\s@(\w+)\s(\d+-\d+(\s\d+-\d+){0,2})/;

  let playerUsername: string | undefined;
  let opponentUsername: string | undefined;
  let score: string | undefined;

  let selfMatch = input.match(selfMatchRegex);
  let match = input.match(otherMatchRegex);

  console.log("self match: ", selfMatch);
  console.log("match: ", match);

  if (match) {
    [, playerUsername, opponentUsername, score] = match;
  } else if (selfMatch) {
    [, opponentUsername, score] = selfMatch;
    playerUsername = username; 
  } else {
    bot.sendMessage(chatId, 'Invalid format. Please use:\n- @opponentUsername 6-2 6-2\n- @playerUsername - @opponentUsername 6-2 6-2 10-8');
    return false;
  }

  if (!playerUsername || !opponentUsername || !score) {
    bot.sendMessage(chatId, 'Invalid format. Please ensure you are using the correct format.');
    return false;
  }

  // Process the match result, calculate new ELO ratings, update Firebase, etc.
  try {
    const player = await getPlayerByUsername(playerUsername);
    const opponent = await getPlayerByUsername(opponentUsername);

    if (!player || !opponent) {
      console.log('One or both players not found.')
      bot.sendMessage(chatId, 'One or both players not found.');
      return false;
    }

    const matchResult = calculateMatchResult(player, opponent, score);
    const eloResult = await calculateEloRating(matchResult.winner, matchResult.loser);

    await updatePlayerProfiles(matchResult, eloResult);

    bot.sendMessage(chatId, createMatchReportMessage(matchResult.winner, matchResult.loser, score, eloResult), { parse_mode: 'Markdown' });
    console.log('true');
  } catch(error) {
    console.log(error);
    return false;
  }

  return true;
}

bot.on('callback_query', async (query) => {
  const chatId = query.message?.chat.id as number;

  switch (query.data) {
    case 'register_me':
      if (query.from) {
        const telegramId = query.from.id as number;
        const telegramUsername = query.from.username || '';
        const name = `${query.from?.first_name} ${query.from?.last_name}`;

        await registerMe(bot, chatId, name, telegramId, telegramUsername);
      }
      break;
    case 'view_ratings':
      await sendPlayerRatings(bot, chatId);
      break;
    case 'report_match':
      bot.sendMessage(chatId, createMatchReportInfoMessage(), {parse_mode: 'Markdown'});
      break;
    case 'my_stats':
      if (query.from) {
        const telegramId = query.from.id as number;
        await sendMyStats(bot, chatId, telegramId);
      }
      break;
    default:
      bot.sendMessage(chatId, 'Unknown command');
  }
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id || 0;
  const username = msg.from?.username || '';
  const text = msg.text?.trim() || '';

  if (userStates[userId] && userStates[userId].step === 'awaiting_match_details') {
    if (text.startsWith('/')) {
      // If a new command is received, reset the state
      delete userStates[userId];
    } else if (userStates[userId].step === 'awaiting_match_details') {
      delete userStates[userId];  
      handleMatchResultInput(chatId, username, text);
      return;
    }
  }
});

export default bot;