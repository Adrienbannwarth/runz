import 'server-only';
import { db } from './db';
import type { Feedback } from './feedback-core';
export * from './feedback-core';

/** Toutes les réponses (vide si la migration 026 n'est pas encore passée). */
export async function loadFeedback(): Promise<Feedback[]> {
  const { data, error } = await db().from('feedback').select('*').order('updated_at', { ascending: false });
  return error ? [] : (data as Feedback[]);
}

/** Réponse déjà envoyée par ce participant (pour la pré-remplir). */
export async function myFeedback(participantId: string | null): Promise<Feedback | null> {
  if (!participantId) return null;
  const { data, error } = await db().from('feedback').select('*').eq('participant_id', participantId).maybeSingle();
  return error ? null : (data as Feedback | null);
}
