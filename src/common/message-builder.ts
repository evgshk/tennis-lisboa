import { EloCalculationResult } from '../elo';
import { Player } from './models';

export function createMyStatsMessage (player: Player): string {
  const ratingChangeLast5Matches = player.matches?.map(x => x.ratingChange).slice(-5).reduce((acc, val) => acc + val, 0) ?? 0;
  const last5MatchesResults = player.matches?.map(x => x.win).slice(-5).map(x => x ? '🟢' : '🔴').join('') ?? '';

  const message = multilineMessage(`
    👤 *${player.name}*

    Rating: *${player.rating.toFixed(2)}*
    Last 5: *${last5MatchesResults ? last5MatchesResults : 'n/a'}*
    Change (last 5): *${ratingChangeLast5Matches >= 0 ? '+' : ''} ${ratingChangeLast5Matches.toFixed(2)}*
    
    High: *${player.highestRating.toFixed(2)}*
    W/L: *${player.wins}/${player.losses}*

    _Joined: ${player.joinedAt.toDate().toLocaleDateString()}_
    _Last Match: ${player.lastMatchDate.toDate().toLocaleDateString()}_
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
    // .map((player, index) => `${index+1}. ${player.name} (@${player.telegramUsername}) [<a href="tg://user?id=${player.telegramId}">dfd</a>] - ${player.rating.toFixed(2)}`)
    .map((player, index) => `${index+1}. ${player.name} - <b>${player.rating.toFixed(2)}</b>`)
    .join('\n');

  const message = multilineMessage(`
    🎾 <b>Player Elo Ratings</b>
    
    ${ratingMessageBlock}
  `);

  return message;
}

function multilineMessage(message: string): string {
  return message.split('\n').map(line => line.trim()).join('\n');
}