import { Player } from './models';

interface MatchResut {
  winner: Player;
  loser: Player;
  sets: number[][];
}

export function parseScore(player: Player, opponent: Player, score: string): MatchResut {
  const sets = score.split(' ').map(set => set.split('-').map(Number));

  if (sets.some(([score1, score2]) => isNaN(score1) || isNaN(score2))) {
    console.log('Invalid score format. Please use integers for scores.');
    return {} as MatchResut;
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

  return { winner, loser, sets } as MatchResut
}