import TelegramBot from 'node-telegram-bot-api';
import { registerMe, sendMyStats, sendPlayerRatings } from './bot-actions';
import { calculateEloRating } from './elo';
import { getPlayerByUsername, saveMatch, updateRatings } from './persistance/firebase';
import { createMatchReportInfoMessage, createMatchReportMessage } from './common/message-builder';
import { Player } from './common/models';

const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
if (!telegramBotToken) {
  throw new Error("Missing environment variables");
}

const bot = new TelegramBot(telegramBotToken, { polling: true });

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

bot.onText(/\/matchresult\s*(?:@?([^\s]+)\s*-\s*)?@?([^\s]+)\s+(\d+-\d+\s+\d+-\d+(?:\s+\d+-\d+)?)/, async (msg, match) => {
  if (!match) return;

  const chatId = msg.chat.id;
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