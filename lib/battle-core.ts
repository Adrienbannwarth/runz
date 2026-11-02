// Battle TraceZ : logique pure (testée dans tests/scoring.test.ts), sans accès base.
import { polylineToPath, shapeLabel } from './polyline.ts';
import type { Activity, Boost } from './scoring.ts';

export type Vote = { voter_id: string; a: string; b: string; winner: string; test?: boolean | null };
export type Shape = { id: string; participant_id: string; path: string; km: number; label: string };

export const VOTE_OPEN_HOUR = '09:00'; // la fenêtre de vote s'ouvre le premier jour à 9h

/** Le boost « forme » qui porte un vote (le plus récent), s'il existe. */
export const battleBoost = (boosts: Boost[]) =>
  boosts.filter((b) => b.tag && b.vote_from).sort((x, y) => String(y.starts_at).localeCompare(String(x.starts_at)))[0];

/** Formes en compétition : activités validées pour ce boost, avec un tracé. */
export function battleShapes(boost: Boost, activities: Activity[]): Shape[] {
  return activities
    .filter((a) => (a.validated_boosts ?? []).map(Number).includes(Number(boost.id)) && a.polyline)
    .map((a) => ({ id: a.id, participant_id: a.participant_id, path: polylineToPath(a.polyline)!, km: Math.round(Number(a.distance_m) / 10) / 100, label: shapeLabel(a.name) }))
    .filter((s) => s.path);
}

/** Formes du mode test (tracés récupérés pour les admins, jamais dans le vrai vote). */
export function testShapes(activities: (Activity & { test_polyline?: string | null })[]): Shape[] {
  return activities
    .filter((a) => a.test_polyline)
    .map((a) => ({ id: a.id, participant_id: a.participant_id, path: polylineToPath(a.test_polyline)!, km: Math.round(Number(a.distance_m) / 10) / 100, label: shapeLabel(a.name) }))
    .filter((s) => s.path);
}

/** Ouvert du premier jour à 9h (heure de Paris) jusqu'au dernier jour inclus. `now` = « YYYY-MM-DDTHH:MM:SS ». */
export const voteOpen = (boost: Boost, now: string) =>
  !!boost.vote_from && now >= `${boost.vote_from}T${VOTE_OPEN_HOUR}` && now.slice(0, 10) <= (boost.vote_to ?? boost.vote_from);
export const voteEnded = (boost: Boost, now: string) => !!boost.vote_from && now.slice(0, 10) > (boost.vote_to ?? boost.vote_from);

/** Générateur pseudo-aléatoire reproductible (le tirage d'un votant reste le même d'un chargement à l'autre). */
function seeded(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/**
 * Tirage « battle royale » d'un votant : les formes qu'il n'a jamais vues sont mélangées (tirage propre à
 * chaque votant, reproductible) puis appariées deux à deux. Chaque forme n'apparaît donc qu'UNE fois pour lui,
 * gagnante ou perdante, et ne revient jamais. 16 formes = 8 duels. Hors test, sa propre forme est exclue.
 */
export function remainingPairs(shapes: Shape[], votes: Vote[], voterId: string, opts: { allowOwn?: boolean; seed?: string } = {}): [string, string][] {
  const seen = new Set(votes.filter((v) => v.voter_id === voterId).flatMap((v) => [v.a, v.b]));
  const pool = shapes.filter((s) => !seen.has(s.id) && (opts.allowOwn || s.participant_id !== voterId)).map((s) => s.id).sort();
  const rnd = seeded(opts.seed ?? voterId);
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const pairs: [string, string][] = [];
  for (let i = 0; i + 1 < pool.length; i += 2) pairs.push([pool[i], pool[i + 1]]);
  return pairs;
}

/** Classement : % de duels gagnés = victoires ÷ duels joués (puis nombre de victoires). */
export function battleResults(shapes: Shape[], votes: Vote[]) {
  const ids = new Set(shapes.map((s) => s.id));
  return shapes.map((s) => {
    const duels = votes.filter((v) => (v.a === s.id || v.b === s.id) && ids.has(v.a) && ids.has(v.b));
    const wins = duels.filter((v) => v.winner === s.id).length;
    return { shape: s, wins, duels: duels.length, pct: duels.length ? wins / duels.length : 0 };
  }).sort((x, y) => y.pct - x.pct || y.wins - x.wins);
}
