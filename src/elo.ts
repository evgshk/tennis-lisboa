import { Player } from './common/models';

export interface EloCalculationResult {
  winnerExpected: number;
  loserExpected: number;
  winnerGained: number;
  loserLost: number
}

export async function calculateEloRating(winner: Player, loser: Player): Promise<EloCalculationResult> {
  const kFactor = 32; // Example K-factor value, may be adjusted it as needed

  const winnerExpected = 1 / (1 + Math.pow(10, (loser.rating - winner.rating) / 400));
  const loserExpected = 1 / (1 + Math.pow(10, (winner.rating - loser.rating) / 400));

  const winnerGained = kFactor * (1 - winnerExpected);
  const loserLost = kFactor * (0 - loserExpected);

  return { winnerExpected, loserExpected, winnerGained, loserLost } as EloCalculationResult;
}