import TelegramBot from 'node-telegram-bot-api';
import { addPlayer, getPlayer, getPlayerRatings } from './persistance/firebase';
import { createMyStatsMessage, createPlayersRankingMessage } from './common/message-builder';
import { createDefaultPlayer } from './common/models';

export async function registerMe(bot: TelegramBot, chatId: number, name: string, telegramId: number, telegramUsername: string ) {
  if (!telegramId) {
    bot.sendMessage(chatId, "Error: Could not get Telegram ID.");
    return;
  }

  const playerExists = await getPlayer(telegramId);
  if (playerExists) {
    bot.sendMessage(chatId, "You are already registered. Check out your stats with /mystats command.");
    return;
  }

  const player = createDefaultPlayer(name, telegramId, telegramUsername);
  await addPlayer(player);

  bot.sendMessage(chatId, `Player ${name} added with an initial rating of 1200.`);
}

export async function sendMyStats(bot: TelegramBot, chatId: number, telegramId: number) {
  if (!telegramId) {
    bot.sendMessage(chatId, "Error: Could not get your Telegram ID.");
    return;
  }

  const player = await getPlayer(telegramId);

  if (!player) {
    bot.sendMessage(chatId, "You are not registered as a player. Please use the /register command to register.");
    return;
  }

  bot.sendMessage(chatId, createMyStatsMessage(player), { parse_mode: 'Markdown' });
}

export async function sendPlayerRatings(bot: TelegramBot, chatId: number) {
  const playerRatings = await getPlayerRatings();

  bot.sendMessage(chatId, createPlayersRankingMessage(playerRatings), { parse_mode: 'HTML' });
} 