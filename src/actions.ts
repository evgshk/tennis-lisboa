import TelegramBot from 'node-telegram-bot-api';
import { addPlayer, getPlayer, getPlayerByUsername, getPlayerRatings } from './persistance/firebase';
import { createMyStatsMessage, createPlayersRankingMessage } from './common/message-builder';
import { createDefaultPlayer } from './common/models';

export async function registerMe(bot: TelegramBot, chatId: number, messageThreadId: number, name: string, telegramId: number, telegramUsername: string ) {
  if (!telegramId) {
    bot.sendMessage(chatId, "Error: Could not get Telegram ID.", { message_thread_id: messageThreadId });
    return;
  }

  const playerExists = await getPlayer(telegramId);
  if (playerExists) {
    bot.sendMessage(chatId, "You are already registered. Check out your stats with /mystats command.", { message_thread_id: messageThreadId });
    return;
  }

  const player = createDefaultPlayer(name, telegramId, telegramUsername);
  await addPlayer(player);

  bot.sendMessage(chatId, `Player ${name} registered with an initial rating of 1200.`, { message_thread_id: messageThreadId });
}

export async function sendMyStats(bot: TelegramBot, chatId: number, messageThreadId: number, telegramId: number) {
  if (!telegramId) {
    bot.sendMessage(chatId, "Error: Could not get your Telegram ID.", { message_thread_id: messageThreadId });
    return;
  }

  const player = await getPlayer(telegramId);

  if (!player) {
    bot.sendMessage(chatId, "You are not registered as a player. Please use the /register command to register.", { message_thread_id: messageThreadId });
    return;
  }

  bot.sendMessage(chatId, createMyStatsMessage(player), { parse_mode: 'Markdown', message_thread_id: messageThreadId });
}

export async function sendOtherPlayerStats(bot: TelegramBot, chatId: number, messageThreadId: number, username: string) {
  if (!username) {
    bot.sendMessage(chatId, "Error: no username is specified.", { message_thread_id: messageThreadId });
    return;
  }

  const player = await getPlayerByUsername(username);

  if (!player) {
    bot.sendMessage(chatId, "Player is not registered.", { message_thread_id: messageThreadId });
    return;
  }

  bot.sendMessage(chatId, createMyStatsMessage(player), { parse_mode: 'Markdown', message_thread_id: messageThreadId });
}

export async function sendPlayerRatings(bot: TelegramBot, chatId: number, messageThreadId: number) {
  const playerRatings = await getPlayerRatings();

  bot.sendMessage(chatId, createPlayersRankingMessage(playerRatings), { parse_mode: 'Markdown', message_thread_id: messageThreadId });
} 