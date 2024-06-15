import { EloCalculationResult } from '../elo';
import { Player } from './models';

export function createMyStatsMessage (player: Player): string {
  const message = multilineMessage(`
    👤 *${player.name}*

    Current Rating: *${player.rating.toFixed(2)}*
    Highest Rating: *${player.highestRating.toFixed(2)}*
    Wins/Losses: *${player.wins}/${player.losses}*

    _Join Date: ${player.joinedAt.toDate().toLocaleDateString()}_
    _Last Match Date: ${player.lastMatchDate.toDate().toLocaleDateString()}_
  `);

  console.log(player.joinedAt);

  return message;
}

export function createMatchReportMessage (winner: Player, loser: Player, scores: string, elo: EloCalculationResult): string {
  const message = multilineMessage(`
    🏆 *${winner.name}* defeated *${loser.name}* with a score of *${scores}*.
    
    🔢 Stats & Facts
    
    - *${winner.name}* had a *${(elo.winnerExpected * 100).toFixed(2)}%* chance of winning (according to Elo).
    - *${winner.name}* gained *${elo.winnerGained.toFixed(2)}* points and now has a rating of *${winner.rating.toFixed(2)}*.
    - *${loser.name}* lost *${-elo.loserLost.toFixed(2)}* points and now has a rating of *${loser.rating.toFixed(2)}*.

    ✅ Match result successfully recorded.
  `);

  return message;
}

export function createMatchReportInfoMessage(): string {
  const message = multilineMessage(`
    🔹 To report your match results, use the format:
    /matchresult @opponent 6-2 6-2 10-8. 

    🔹 If you are reporting a match between two other players, use the format:
    /matchresult @player - @opponent 6-2 6-2 10-8.`
  );

  return message;
}

export function createPlayersRankingMessage(players: Player[]) {
  const ratingMessageBlock = players
    // .map((player, index) => `${index+1}. ${player.name} (@${player.telegramUsername}) [<a href="tg://user?id=${player.telegramId}">dfd</a>] - ${player.rating.toFixed(2)}`)
    .map((player, index) => `${index+1}. ${player.name} (@${player.telegramUsername}) - ${player.rating.toFixed(2)}`)
    .join('\n');

  const message = multilineMessage(`
    🎾 *Player Elo Ranking*
    
    ${ratingMessageBlock}
  `);

  return message;
}

function multilineMessage(message: string): string {
  return message.split('\n').map(line => line.trim()).join('\n');
}