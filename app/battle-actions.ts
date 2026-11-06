'use server';
import { getParticipantId } from '@/lib/session';
import { loadAll, nowParis } from '@/lib/data';
import { battleBoost, battleShapes, castVote, loadVotes, testShapes, voteOpen } from '@/lib/battle';

/** Enregistre un duel. Tout est revérifié côté serveur (fenêtre de vote, formes valides, pas sa propre forme, pas de doublon). */
export async function voteDuel(a: string, b: string, winner: string, test = false): Promise<{ ok: boolean; error?: string }> {
  const pid = await getParticipantId();
  if (!pid) return { ok: false, error: 'Connecte-toi pour voter.' };
  if (winner !== a && winner !== b) return { ok: false, error: 'Vote invalide.' };
  const d = await loadAll();
  let shapes;
  if (test) {
    // Mode test : réservé aux admins participants, votes marqués « test », jamais mélangés au vrai vote
    if (!d.participants.find((p) => p.id === pid)?.is_admin) return { ok: false, error: 'Réservé aux admins.' };
    shapes = testShapes(d.activities);
  } else {
    const boost = battleBoost(d.boosts);
    if (!boost || !voteOpen(boost, nowParis())) return { ok: false, error: 'Le vote est fermé.' };
    shapes = battleShapes(boost, d.scored);
  }
  // Règle « battle royale » : deux formes valides, différentes, jamais vues par ce votant (et pas la sienne hors test)
  const seen = new Set((await loadVotes(test)).filter((v) => v.voter_id === pid).flatMap((v) => [v.a, v.b]));
  const ok = (id: string) => shapes.some((x) => x.id === id && (test || x.participant_id !== pid)) && !seen.has(id);
  if (a === b || !ok(a) || !ok(b)) return { ok: false, error: 'Duel déjà voté ou non disponible.' };
  await castVote(pid, a, b, winner, test);
  return { ok: true };
}
