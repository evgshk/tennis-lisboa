import TelegramBot from 'node-telegram-bot-api';
import { getActivity, registerMe, sendMyStats, sendOtherPlayerStats, sendPlayerRatings } from './actions';
import { calculateEloRating } from './elo';
import { getPlayer, getPlayerByUsername, updatePlayerProfiles } from './persistance/firebase';
import { createAlreadyRegisteredMessage, createIntroMessage, createIntroRegisteredMessage, createMatchReportInfoMessage, createMatchReportMessage, createRegisteredMessage } from './common/message-builder';
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

  const player = await getPlayer(msg.from?.id ?? 0);

  if (!player) {
    bot.sendMessage(chatId, createIntroMessage(), { message_thread_id: messageThreadId });
  } else {
    bot.sendMessage(chatId, createIntroRegisteredMessage(player.name), { message_thread_id: messageThreadId });
  }

});

bot.onText(/\/register/, async (msg) => {
  const username = msg.from?.username;
  console.log('/register by', username);

  const telegramId = msg.from?.id ?? 0;
  const chatId = msg.chat.id;
  const messageThreadId = msg.message_thread_id ?? 0;
  const name = `${msg.from?.first_name ?? ''} ${msg.from?.last_name ?? ''}`;

  const player = await getPlayer(telegramId);

  if (!player) {
    await registerMe(bot, chatId, messageThreadId, name, telegramId, username || '');
    bot.sendMessage(chatId, createRegisteredMessage(name), { message_thread_id: messageThreadId });
  } else {
    bot.sendMessage(chatId, createAlreadyRegisteredMessage(name), { message_thread_id: messageThreadId });
  }

});

bot.onText(/\/profile(@\w+)?/, async (msg, match) => {
  console.log('/profile by', msg.from?.username, match?.toString());

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

bot.onText(/\/activity(@\w+)?/, async (msg, match) => {
  console.log('/activity by', msg.from?.username, match?.toString());

  const chatId = msg.chat.id;
  const userId = msg.from?.id || 0;
  const messageThreadId = msg.message_thread_id ?? 0;

  let playerUsername = '';

  if (match && match[1] && match[1] !== '@tennis_lisboa_bot') {
    playerUsername = match[1].slice(1); // Remove "@" symbol
    var player = await getPlayerByUsername(playerUsername);
    await getActivity(bot, chatId, messageThreadId, player?.telegramId ?? 0);
    return;
  }

  await getActivity(bot, chatId, messageThreadId, userId);

});

bot.onText(/\/rankings/, async (msg) => {
  console.log('/rankings by', msg.from?.username);

  const chatId = msg.chat.id;
  const messageThreadId = msg.message_thread_id ?? 0;

  await sendPlayerRatings(bot, chatId, messageThreadId);
});

bot.onText(/\/matchresult(.*)/, (msg, match) => {
  console.log('/matchresult by', msg.from?.username, match?.toString());

  const chatId = msg.chat.id;
  const messageThreadId = msg.message_thread_id ?? 0;

  if (msg.chat.type === 'private') {
    bot.sendMessage(chatId, 'This command can only be used in group chats.');
    return;
  }

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
  console.log('handle /matchresult by', username, input.toString());

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