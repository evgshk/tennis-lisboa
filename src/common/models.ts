export interface Player {
  name: string,
  rating: number,
  matches: MatchStats[],
  telegramId: number,
  telegramUsername: string | undefined,
  joinedAt: any,
  wins: number,
  losses: number,
  matchesPlayed: number,
  highestRating: number,
  lastMatchDate: any,
  isActive: boolean
}

export interface MatchStats {
  timestamp: any,
  ratingChange: number,
  winProbability: number,
  score: string,
  win: boolean,
  setsWon: number,
  setsLost: number,
  opponent: Player,
  tournament: string
}

export function createDefaultPlayer(name: string, telegramId: number, telegramUsername: string | undefined): Player {
  const player: Player = {
    name: name,
    rating: 1200,
    matches: [],
    telegramId: telegramId,
    telegramUsername: telegramUsername,
    joinedAt: new Date(),
    wins: 0,
    losses: 0,
    matchesPlayed: 0,
    highestRating: 1200,
    lastMatchDate: new Date(0),
    isActive: true
  }

  return player;
}