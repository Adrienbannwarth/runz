import 'server-only';
import { db, must } from './db';
import { votesSinceOpening, type PhotoVote } from './photo-core';
import type { Boost } from './scoring';
export * from './photo-core';

/** Heure de Paris « AAAA-MM-JJTHH:MM:SS » d'un horodatage. */
const parisLocal = (iso: string) =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'medium' }).format(new Date(iso)).replace(' ', 'T');

/**
 * Votes du jeu photo (table photo_votes, migration 023). Vide si la table n'existe pas encore.
 * Avec le boost : seulement les réactions données après l'ouverture du vote (les tests des admins sont ignorés).
 */
export async function loadPhotoVotes(boost?: Boost): Promise<PhotoVote[]> {
  const { data, error } = await db().from('photo_votes').select('voter_id, activity_id, liked, reaction, created_at').limit(50000);
  if (error) return [];
  return boost ? votesSinceOpening(boost, data as PhotoVote[], parisLocal) : (data as PhotoVote[]);
}
/** Réaction (null = « Passer », la photo ne revient pas). */
export async function castPhotoVote(voterId: string, activityId: string, reaction: string | null) {
  // upsert : une réaction d'essai (aperçu admin, avant l'ouverture) est remplacée par la vraie
  must(await db().from('photo_votes').upsert({ voter_id: voterId, activity_id: activityId, liked: !!reaction, reaction, created_at: new Date().toISOString() }, { onConflict: 'voter_id,activity_id' }));
}
