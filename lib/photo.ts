import 'server-only';
import { db, must } from './db';
import type { PhotoVote } from './photo-core';
export * from './photo-core';

/** Votes du jeu photo (table photo_votes, migration 023). Vide si la table n'existe pas encore. */
export async function loadPhotoVotes(): Promise<PhotoVote[]> {
  const { data, error } = await db().from('photo_votes').select('voter_id, activity_id, liked').limit(50000);
  return error ? [] : (data as PhotoVote[]);
}
export async function castPhotoVote(voterId: string, activityId: string, liked: boolean) {
  must(await db().from('photo_votes').insert({ voter_id: voterId, activity_id: activityId, liked }));
}
