import * as admin from 'firebase-admin';
import { EloCalculationResult } from '../elo';
import { Player } from '../common/models';

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
  const playerRatings = (await db.collection('players').orderBy('rating', 'desc').get()).docs.map(doc => {
    const data = doc.data();

    return {
      name: data.name,
      rating: data.rating,
      telegramId: data.telegramId,
      telegramUsername: data.telegramUsername
    } as Player;
  });

  return playerRatings;  
}

export async function updateRatings(winner: Player, loser: Player, elo: EloCalculationResult, matchRef: FirebaseFirestore.DocumentReference): Promise<Player[]> {
  winner.rating = winner.rating + elo.winnerGained;
  loser.rating = loser.rating + elo.loserLost;

  const now = new Date();

  await db.collection('players').doc(winner.telegramId.toString()).update({
    rating: winner.rating,
    highestRating: winner.rating > winner.highestRating ? winner.rating : winner.highestRating,
    matchesPlayed: ++winner.matchesPlayed,
    wins: ++winner.wins,
    lastMatchDate: now,
    matches: admin.firestore.FieldValue.arrayUnion(matchRef),
  });

  await db.collection('players').doc(loser.telegramId.toString()).update({
    rating: loser.rating,
    highestRating: loser.rating > loser.highestRating ? loser.rating : loser.highestRating,
    matchesPlayed: ++loser.matchesPlayed,
    losses: ++loser.losses,
    lastMatchDate: now,
    matches: admin.firestore.FieldValue.arrayUnion(matchRef),
  });

  return [winner, loser];
}

export async function saveMatch(winner: Player, loser: Player, sets: number[][]): Promise<FirebaseFirestore.DocumentReference>  {
  const now = new Date();

  const matchRef = await db.collection('matches').add({
    winner: winner.telegramUsername,
    loser: loser.telegramUsername,
    scores: sets.map(set => set.join('-')).join(' '),
    timestamp: now,
  });

  return matchRef;  
}

