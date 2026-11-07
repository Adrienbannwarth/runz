'use server';
import { getParticipantId } from '@/lib/session';
import { loadAll, nowParis } from '@/lib/data';
import { battleBoost, battleShapes, castVote, loadVotes, voteEnded, voteOpen } from '@/lib/battle';

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
  // Règle « battle royale » : deux formes valides, différentes, jamais vues par ce votant (et pas la sienne, sauf aperçu admin)
  const seen = new Set((await loadVotes()).filter((v) => v.voter_id === pid).flatMap((v) => [v.a, v.b]));
  const ok = (id: string) => shapes.some((x) => x.id === id && (early || x.participant_id !== pid)) && !seen.has(id);
  if (a === b || !ok(a) || !ok(b)) return { ok: false, error: 'Duel déjà voté ou non disponible.' };
  await castVote(pid, a, b, winner);
  return { ok: true };
}
