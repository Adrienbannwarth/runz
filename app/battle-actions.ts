'use server';
import { getParticipantId } from '@/lib/session';
import { loadAll, nowParis } from '@/lib/data';
import { battleBoost, battleShapes, castVote, duelAllowed, loadVotes, voteEnded, voteOpen } from '@/lib/battle';
import { castPhotoVote, loadPhotoVotes, photoBoost, photoEntries, photosToVote } from '@/lib/photo';

/** Enregistre un duel. Tout est revérifié côté serveur (fenêtre de vote, formes valides, pas sa propre forme, pas de doublon). */
export async function voteDuel(a: string, b: string, winner: string): Promise<{ ok: boolean; error?: string }> {
  const pid = await getParticipantId();
  if (!pid) return { ok: false, error: 'Connecte-toi pour voter.' };
  if (winner !== a && winner !== b) return { ok: false, error: 'Vote invalide.' };
  const d = await loadAll();
  const boost = battleBoost(d.boosts);
  if (!boost) return { ok: false, error: 'Le vote est fermé.' };
  const now = nowParis();
  // Aperçu admins : avant l'ouverture à tous, les admins votent déjà (votes réels, à supprimer après les tests)
  const early = !voteOpen(boost, now) && !voteEnded(boost, now) && !!d.participants.find((p) => p.id === pid)?.is_admin;
  if (!voteOpen(boost, now) && !early) return { ok: false, error: 'Le vote est fermé.' };
  const shapes = battleShapes(boost, d.scored);
  // Règle « battle royale » : formes valides, au moins une jamais vue (dernière forme d'un nombre impair), duel jamais voté, pas la sienne (sauf aperçu admin)
  if (!duelAllowed(shapes, await loadVotes(), pid, a, b, { allowOwn: early })) return { ok: false, error: 'Duel déjà voté ou non disponible.' };
  await castVote(pid, a, b, winner);
  return { ok: true };
}

/** Vote photo (#COULEURZ) : oui / non sur une photo. Revérifié côté serveur (fenêtre, photo valide, pas la sienne, une fois). */
export async function votePhoto(activityId: string, liked: boolean): Promise<{ ok: boolean; error?: string }> {
  const pid = await getParticipantId();
  if (!pid) return { ok: false, error: 'Connecte-toi pour voter.' };
  const d = await loadAll();
  const boost = photoBoost(d.boosts);
  if (!boost) return { ok: false, error: 'Le vote est fermé.' };
  const now = nowParis();
  const early = !voteOpen(boost, now) && !voteEnded(boost, now) && !!d.participants.find((p) => p.id === pid)?.is_admin;
  if (!voteOpen(boost, now) && !early) return { ok: false, error: 'Le vote est fermé.' };
  const left = photosToVote(photoEntries(boost, d.scored), await loadPhotoVotes(), pid, { allowOwn: early });
  if (!left.some((e) => e.id === activityId)) return { ok: false, error: 'Photo déjà votée ou non disponible.' };
  await castPhotoVote(pid, activityId, liked);
  return { ok: true };
}
