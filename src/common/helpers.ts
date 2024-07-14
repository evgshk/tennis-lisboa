import { MatchStats, Player } from './models';

export interface MatchResult {
  winner: Player;
  winnerSetsWon: number;
  loser: Player;
  loserSetsWon: number;
  sets: number[][];
}

export function calculateMatchResult(player: Player, opponent: Player, score: string): MatchResult {
  const sets = score.split(' ').map(set => set.split('-').map(Number));

  if (sets.some(([score1, score2]) => isNaN(score1) || isNaN(score2))) {
    console.log('Invalid score format. Please use integers for scores.');
    return {} as MatchResult;
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

  return { winner, winnerSetsWon: playerSetsWon, loser, loserSetsWon: opponentSetsWon, sets } as MatchResult
}

// Group matches by year and tournament
export function groupMatchesByYearAndTournament(matches: MatchStats[]): { [year: string]: { [tournament: string]: MatchStats[] } } {
  const groupedMatches: { [year: string]: { [tournament: string]: MatchStats[] } } = {};

  matches.forEach(match => {
    const matchDate = match.timestamp.toDate();
    const year = matchDate.getFullYear().toString();
    const tournament = match.tournament || "Default Tournament"; // Use actual tournament name or default

    if (!groupedMatches[year]) {
      groupedMatches[year] = {};
    }

    if (!groupedMatches[year][tournament]) {
      groupedMatches[year][tournament] = [];
    }

    groupedMatches[year][tournament].push(match);
  });

  return groupedMatches;
}