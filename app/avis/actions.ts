'use server';
import { db, must } from '@/lib/db';
import { getParticipantId } from '@/lib/session';
import { DISLIKED, LIKED, NEXT, RHYTHMS, SPORTS, clip, pick } from '@/lib/feedback-core';

export type AvisInput = {
  rating: number | null; liked: string[]; disliked: string[]; rhythm: string | null;
  next_season: string | null; sports: string[]; challenge: string; comment: string;
};

/** Enregistre l'avis : une réponse par participant connecté (renvoyer le formulaire la remplace), anonyme sinon. */
export async function sendAvis(input: AvisInput): Promise<{ ok: boolean; error?: string }> {
  const pid = await getParticipantId();
  const rating = Number(input.rating);
  const row = {
    participant_id: pid, season: 1,
    rating: rating >= 1 && rating <= 5 ? Math.round(rating) : null,
    liked: pick(input.liked ?? [], LIKED), disliked: pick(input.disliked ?? [], DISLIKED),
    rhythm: (RHYTHMS as readonly string[]).includes(input.rhythm ?? '') ? input.rhythm : null,
    next_season: (NEXT as readonly string[]).includes(input.next_season ?? '') ? input.next_season : null,
    sports: pick(input.sports ?? [], SPORTS),
    challenge: clip(input.challenge, 300), comment: clip(input.comment, 1500),
    updated_at: new Date().toISOString(),
  };
  if (!row.rating && !row.liked.length && !row.disliked.length && !row.rhythm && !row.next_season && !row.sports.length && !row.challenge && !row.comment) {
    return { ok: false, error: 'Réponds à au moins une question 🙂' };
  }
  try {
    if (pid) must(await db().from('feedback').upsert(row, { onConflict: 'participant_id' }));
    else must(await db().from('feedback').insert(row));
    return { ok: true };
  } catch {
    return { ok: false, error: 'Ton avis n’a pas pu être enregistré, réessaie dans un instant.' };
  }
}
