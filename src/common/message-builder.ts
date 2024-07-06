import { EloCalculationResult } from '../elo';
import { MatchStats, Player } from './models';

export function createMyStatsMessage (player: Player): string {
  const last5MatchesResults = player.matches?.map(x => x.win).slice(-5).map(x => x ? '🟢' : '🔴').join('') ?? '';

  const message = multilineMessage(`
    👤 *${player.name}*

    Rating: *${player.rating.toFixed(2)}*
    Last 5: *${last5MatchesResults ? last5MatchesResults : 'n/a'}*
    Change (last 5): *${calculateRatingChangeLastMatches(player.matches, 5)}*
    
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
    // .map((player, index) => `${index+1}. ${player.name} (@${player.telegramUsername}) [<a href="tg://user?id=${player.telegramId}">dfd</a>] - ${player.rating.toFixed(2)}`)
    .map((player, index) => {
      let wins = 0;
      let losses = 0;
      player.matches.forEach(match => {match.win ? wins++ : losses++ });
      return multilineMessage(`${index+1}. ${player.name} - *${player.rating.toFixed(2)}* (${wins}/${losses}, ${calculateRatingChangeLastMatches(player.matches, 5)})`);
    })
    .join('\n');

  const message = multilineMessage(`
    🎾 *Player Ratings*
    
    ${alignRatings(ratingMessageBlock)}
  `);

  return message;
}

function alignRatings(input: string) {
  // Split the input string into individual lines
  const lines = input.trim().split('\n');

  // Extract names and find the maximum length
  const names = lines.map(line => {
      const match = line.match(/^\d+\.\s+([^\-]+)\s+-/);
      return match ? match[1].trim() : '';
  });

  const maxLength = Math.max(...names.map(name => name.length));

  // Pad each name with spaces to align the ratings
  const alignedLines = lines.map(line => {
      return line.replace(/^(\d+\.\s+)([^\-]+)(\s+-)/, (match, p1, p2, p3) => {
          const paddedName = p2.trim().padEnd(maxLength);
          return `${p1}${paddedName}${p3}`;
      });
  });

  // Join the lines back into a single string
  return alignedLines.join('\n');
};

function multilineMessage(message: string): string {
  return message.split('\n').map(line => line.trim()).join('\n');
}

function calculateRatingChangeLastMatches(matches: MatchStats[], numberOfLastMatches: number) {
  var ratingChange = matches?.map(x => x.ratingChange).slice(-numberOfLastMatches).reduce((acc, val) => acc + val, 0) ?? 0;
  return ratingChange >= 0 ? `+${ratingChange.toFixed(2)}` : ratingChange.toFixed(2);
}