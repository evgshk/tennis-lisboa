export interface Player {
  name: string,
  rating: number,
  telegramId: number,
  telegramUsername: string | undefined,
  joinedAt: any,
  wins: number,
  losses: number,
  matchesPlayed: number,
  highestRating: number,
  lastMatchDate: any,
  matches?: any;
}

export function createDefaultPlayer(name: string, telegramId: number, telegramUsername: string | undefined): Player {
  const player: Player = {
    name: name,
    rating: 1200,
    telegramId: telegramId,
    telegramUsername: telegramUsername,
    joinedAt: new Date(),
    wins: 0,
    losses: 0,
    matchesPlayed: 0,
    highestRating: 1200,
    lastMatchDate: new Date(0)
  }

  return player;
}