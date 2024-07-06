import { EloCalculationResult } from '../elo';
import { MatchStats, Player } from './models';

export function createMyStatsMessage (player: Player): string {
  const last5MatchesResults = player.matches?.map(x => x.win).slice(-5).map(x => x ? '🟢' : '🔴').join('') ?? '';

  const message = multilineMessage(`
    👤 *${player.name}*

    Rating: *${player.rating.toFixed(2)}*
    Last 5: *${last5MatchesResults ? last5MatchesResults : 'n/a'}*
    Change (last 5): *${calculateRatingChange(player.matches, 5)}*
    
    High: *${player.highestRating.toFixed(2)}*
    W/L: *${player.wins}/${player.losses}*

    _Joined: ${player.joinedAt.toDate().toLocaleDateString()}_
    _Last Update: ${player.lastMatchDate.toDate().toLocaleDateString()}_
  `);

  return message;
}

export function createMatchReportMessage (winner: Player, loser: Player, scores: string, elo: EloCalculationResult): string {
  const message = multilineMessage(`
    🏆 *${winner.name}* def. *${loser.name}* *${scores}*.
    
    🔢 *${winner.name}* ${(winner.rating+elo.winnerGained).toFixed(2)} *(+${elo.winnerGained.toFixed(2)})* pts, *${loser.name}* ${(loser.rating+elo.loserLost).toFixed(2)} *(${elo.loserLost.toFixed(2)})* pts.
    
    ✅ Result recorded.
  `);

  return message;
}

export function createMatchReportInfoMessage(): string {
  const message = multilineMessage(`
    🔹 To report your match: 
    @opponent 6-2 6-2 10-8 

    🔹 To report others: 
    @player - @opponent 6-2 6-2 10-8`
  );

  return message;
}

export function createPlayersRankingMessage(players: Player[]) {
  const ratingMessageBlock = players
    .map((player, index) => {
      const ratingChange = calculateRatingChange(player.matches, 5);
      
      return multilineMessage(
        `${index + 1}. ${player.name} - *${player.rating.toFixed(2)}* (${ratingChange})`
      );
    })
    .join('\n');

  const message = multilineMessage(`
    🎾 *Player Ratings*
    
    ${ratingMessageBlock}

    _Values in parentheses show the rating change over the last 5 matches._
  `);

  return message;
}

function multilineMessage(message: string): string {
  return message.split('\n').map(line => line.trim()).join('\n');
}

function calculateRatingChange(matches: MatchStats[], numberOfLastMatches: number) {
  var ratingChange = matches?.map(x => x.ratingChange).slice(-numberOfLastMatches).reduce((acc, val) => acc + val, 0) ?? 0;
  return ratingChange >= 0 ? `+${ratingChange.toFixed(2)}` : ratingChange.toFixed(2);
}