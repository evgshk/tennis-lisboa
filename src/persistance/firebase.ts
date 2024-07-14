import * as admin from 'firebase-admin';
import { EloCalculationResult } from '../elo';
import { MatchStats, Player } from '../common/models';
import { MatchResult } from '../common/helpers';

const firebaseConfigBase64 = process.env.FIREBASE_CONFIG;

if (!firebaseConfigBase64) {
    throw new Error("Missing Firebase configuration");
}

const firebaseConfigJson = Buffer.from(firebaseConfigBase64, 'base64').toString('utf-8');
const firebaseConfig = JSON.parse(firebaseConfigJson);

admin.initializeApp({
  credential: admin.credential.cert(firebaseConfig as admin.ServiceAccount),
});

export const db = admin.firestore();

export async function addPlayer(player: Player): Promise<void> {
  try {
    await db.collection('players').doc(player.telegramId.toString()).set(player);
    console.log(`Player ${player.name} added to Firestore.`);
  } catch (error) {
    console.error('Error adding player to Firestore:', error);
  }
}

export async function getPlayer(telegramId: number): Promise<Player | undefined> {
  const player = await db.collection('players').doc(telegramId.toString()).get();

  if (!player.exists) {
    console.log(`Player profile could not found by telegramId: ${telegramId}`);
    return undefined;
  }

  return player.data() as Player;
}

export async function getPlayerByUsername(username: string): Promise<Player | undefined> {
  const snapshot = await db.collection('players').where('telegramUsername', '==', username).limit(1).get();
  
  if (snapshot.empty) {
    console.log(`Player profile could not found by username: ${username}`);
    return undefined;
  };

  return snapshot.docs[0].data() as Player;
}

export async function getPlayerRatings(): Promise<Player[]> {
  const playerRatings = (await db.collection('players').where('isActive', '==', true).orderBy('rating', 'desc').get()).docs.map(doc => {
    const data = doc.data();

    return {
      name: data.name,
      rating: data.rating,
      telegramId: data.telegramId,
      telegramUsername: data.telegramUsername,
      matches: data.matches
    } as Player;
  });

  return playerRatings;  
}

export async function getCurrentTournament(): Promise<string> {
  const now = new Date();
  const tournamentRaw = db.collection('tournaments').where('from', '<=', now).where('to', '>=', now);
  const snapshot = await tournamentRaw.get();

  if (snapshot.empty) {
    return 'N/A';
  }

  const tournament = snapshot.docs[0].data();
  
  if (!tournament || !tournament.name) {
    return 'N/A';
  }

  return tournament.name;
}

export async function updatePlayerProfiles(match: MatchResult, elo: EloCalculationResult): Promise<void> {
  await updatePlayer(match.winner, true, match.loser, match.sets, match.winnerSetsWon, match.loserSetsWon, elo.winnerGained, elo.winnerExpected);
  await updatePlayer(match.loser, false, match.winner, match.sets, match.loserSetsWon, match.winnerSetsWon, elo.loserLost, elo.loserExpected);
}

async function updatePlayer(player: Player, isPlayerWinner: boolean, opponent: Player, sets: number[][], setsWon: number, setsLost: number, ratingChange: number, winProbability: number): Promise<void> {
  const now = new Date();
  const newRating = player.rating + ratingChange;
  const tournament = await getCurrentTournament();

  await db.collection('players').doc(player.telegramId.toString()).update({
    rating: newRating,
    matches: admin.firestore.FieldValue.arrayUnion({
      timestamp: now,
      ratingChange: ratingChange,
      winProbability, 
      win: isPlayerWinner,
      score: sets.map(set => set.join('-')).join(' '),
      setsWon,
      setsLost,
      opponent: {
        name: opponent.name,
        telegramId: opponent.telegramId
      } as Player,
      tournament 
    } as MatchStats),
    highestRating: newRating > player.highestRating ? newRating : player.highestRating,
    matchesPlayed: ++player.matchesPlayed,
    wins: isPlayerWinner ? ++player.wins : player.wins,
    losses: !isPlayerWinner ? ++player.losses : player.losses,
    lastMatchDate: now,
  });
}
