import { EloCalculationResult } from '../elo';
import { groupMatchesByYearAndTournament } from './helpers';
import { MatchStats, Player } from './models';

const cheatsheet = `Here’s a quick cheatsheet to get you started:
    
  /profile – Get your profile stats
  /rankings – See player's rankings
  /matchresult – Report a score`;


export function createIntroMessage (): string {
  const message = multilineMessage(
    `Welcome to 🤖 Tennis Lisboa Bot, your go-to tool for managing and analyzing ELO ratings with ease. Bot helps you with:

    🎯 Calculate ELO ratings
    📊 Analyze activity
    📅 Track progress over time

    Type /register to start use it. Let’s make your game stats shine! 🌟`
  )

  return message;
}

export function createIntroRegisteredMessage (name: string): string {
  const message = multilineMessage(
    `Hi, ${name}

    ${cheatsheet}`
  )

  return message;
}

export function createRegisteredMessage (name: string): string {
  const message = multilineMessage(
    `${name}, welcome aboard! 🎉

    You've successfully registered. ${cheatsheet}`
  )

  return message;
}

export function createAlreadyRegisteredMessage (name: string): string {
  const message = multilineMessage(
    `Hi, ${name}

    You're already registered. ${cheatsheet}`
  )

  return message;
}

export function createActivityMessage (player: Player): string {
  const groupedMatches = groupMatchesByYearAndTournament(player.matches);

  console.log(groupedMatches);

  let activityBlock = '';
  for (const year in groupedMatches) {
    activityBlock += `*${year}*\n\n`;
    for (const tournament in groupedMatches[year]) {
      activityBlock += `🏆 *${tournament}*\n\n`;
      groupedMatches[year][tournament].forEach(match => {
        const opponentName = match.opponent.name;
        const score = match.score;
        const result = match.win ? "🟢" : "🔴";
        activityBlock += `🔹 ${opponentName} ${result} ${score}\n`;
      });
      activityBlock += "\n";
    }
  }

  const message = multilineMessage(`
    🎲 *Activity* / ${player.name}

    ${activityBlock ? activityBlock: '🎯 No matches found for the player.'}`
  );

  return message;
}

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