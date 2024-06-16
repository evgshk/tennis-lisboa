import TelegramBot from 'node-telegram-bot-api';
import { registerMe, sendMyStats, sendPlayerRatings } from './actions';
import { calculateEloRating } from './elo';
import { getPlayerByUsername, saveMatch, updateRatings } from './persistance/firebase';
import { createMatchReportInfoMessage, createMatchReportMessage } from './common/message-builder';
import { Player } from './common/models';
import { parseScore } from './common/helpers';

const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
if (!telegramBotToken) {
  throw new Error("Missing environment variables");
}

const bot = new TelegramBot(telegramBotToken, { polling: true });
const userStates: { [key: number]: { step: string } } = {};

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(chatId, "Welcome to the Tennis Elo Rating Bot! Use the menu below to navigate.", {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "Register Me", callback_data: 'register_me' },
          { text: "View Ratings", callback_data: 'view_ratings' }
        ],
        [
          { text: "Report Match Result", callback_data: 'report_match' },
          { text: "My Stats", callback_data: 'my_stats' }
        ]
      ]
    }
  });
});

bot.onText(/\/mystats/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id || 0;

  await sendMyStats(bot, chatId, userId);
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
    bot.sendMessage(chatId, 'Please provide the match details with the next message in the format @opponentUsername 6-2 6-2 10-8');
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

  if (selfMatch) {
    [, opponentUsername, score] = selfMatch;
    playerUsername = username; 
  } else if (match) {
    [, playerUsername, opponentUsername, score] = match;
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

    const matchResult = parseScore(player, opponent, score);
    const eloResult = await calculateEloRating(matchResult.winner, matchResult.loser);

    const matchRef = await saveMatch(matchResult.winner, matchResult.loser, matchResult.sets);
    await updateRatings(matchResult.winner, matchResult.loser, eloResult, matchRef);

    bot.sendMessage(chatId, createMatchReportMessage(matchResult.winner, matchResult.loser, score, eloResult), { parse_mode: 'Markdown' });

    console.log('success');
  } catch(error) {
    console.log('failed');
    return false;
  }

  return true;
}

bot.onText(/\/matchresult\s*(?:@?([^\s]+)\s*-\s*)?@?([^\s]+)\s+(\d+-\d+\s+\d+-\d+(?:\s+\d+-\d+)?)/, async (msg, match) => {
  const chatId = msg.chat.id;

  if (!match) {
    bot.sendMessage(chatId, createMatchReportInfoMessage(), {parse_mode: 'Markdown'});
    return;
  }
  
  const reportingPlayerUsername = msg.from?.username;
  const playerUsername = match[1] ? match[1] : reportingPlayerUsername;
  const opponentUsername = match[2];
  const scores = match[3];

  if (!playerUsername || !opponentUsername || !scores) {
    bot.sendMessage(chatId, 'Invalid command format. Please use /matchresult @opponent 6-2 6-2 10-8 or /matchresult @player - @opponent 6-2 6-2 10-8.');
    return;
  }

  const player = await getPlayerByUsername(playerUsername);
  const opponent = await getPlayerByUsername(opponentUsername);

  if (!player || !opponent) {
    bot.sendMessage(chatId, 'One or both players not found.');
    return;
  }

  const sets = scores.split(' ').map(set => set.split('-').map(Number));

  if (sets.some(([score1, score2]) => isNaN(score1) || isNaN(score2))) {
    bot.sendMessage(chatId, 'Invalid score format. Please use integers for scores.');
    return;
  }

  const playerSetsWon = sets.reduce((acc, [score1, score2]) => acc + (score1 > score2 ? 1 : 0), 0);
  const opponentSetsWon = sets.reduce((acc, [score1, score2]) => acc + (score2 > score1 ? 1 : 0), 0);

  let winner: Player, loser: Player;

  if (playerSetsWon > opponentSetsWon) {
    winner = player;
    loser = opponent;
  } else {
    winner = opponent;
    loser = player;
  }

  const eloResult = await calculateEloRating(winner, loser);

  const matchRef = await saveMatch(winner, loser, sets);
  await updateRatings(winner, loser, eloResult, matchRef);

  bot.sendMessage(chatId, createMatchReportMessage(winner, loser, scores, eloResult), { parse_mode: 'Markdown' });
});

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
     // Clear the state
    const result = await handleMatchResultInput(chatId, username, text);
    if (result) {
      delete userStates[userId]; 
    }
  }
});

export default bot;