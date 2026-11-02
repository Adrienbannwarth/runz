// Battle TraceZ : logique pure (testée dans tests/scoring.test.ts), sans accès base.
import { polylineToPath } from './polyline.ts';
import type { Activity, Boost } from './scoring.ts';

export type Vote = { voter_id: string; a: string; b: string; winner: string; test?: boolean | null };
export type Shape = { id: string; participant_id: string; path: string };

export const VOTE_OPEN_HOUR = '09:00'; // la fenêtre de vote s'ouvre le premier jour à 9h

/** Le boost « forme » qui porte un vote (le plus récent), s'il existe. */
export const battleBoost = (boosts: Boost[]) =>
  boosts.filter((b) => b.tag && b.vote_from).sort((x, y) => String(y.starts_at).localeCompare(String(x.starts_at)))[0];

/** Formes en compétition : activités validées pour ce boost, avec un tracé. */
export function battleShapes(boost: Boost, activities: Activity[]): Shape[] {
  return activities
    .filter((a) => (a.validated_boosts ?? []).map(Number).includes(Number(boost.id)) && a.polyline)
    .map((a) => ({ id: a.id, participant_id: a.participant_id, path: polylineToPath(a.polyline)! }))
    .filter((s) => s.path);
}

/** Formes du mode test (tracés récupérés pour les admins, jamais dans le vrai vote). */
export function testShapes(activities: (Activity & { test_polyline?: string | null })[]): Shape[] {
  return activities
    .filter((a) => a.test_polyline)
    .map((a) => ({ id: a.id, participant_id: a.participant_id, path: polylineToPath(a.test_polyline)! }))
    .filter((s) => s.path);
}

/** Ouvert du premier jour à 9h (heure de Paris) jusqu'au dernier jour inclus. `now` = « YYYY-MM-DDTHH:MM:SS ». */
export const voteOpen = (boost: Boost, now: string) =>
  !!boost.vote_from && now >= `${boost.vote_from}T${VOTE_OPEN_HOUR}` && now.slice(0, 10) <= (boost.vote_to ?? boost.vote_from);
export const voteEnded = (boost: Boost, now: string) => !!boost.vote_from && now.slice(0, 10) > (boost.vote_to ?? boost.vote_from);

const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/**
 * Duels restants pour ce votant : toutes les paires possibles, sauf celles déjà votées et (sauf en test)
 * celles qui contiennent sa propre forme ; ordre et côté gauche/droite tirés au hasard.
 */
export function remainingPairs(shapes: Shape[], votes: Vote[], voterId: string, opts: { allowOwn?: boolean; random?: () => number } = {}): [string, string][] {
  const rnd = opts.random ?? Math.random;
  const done = new Set(votes.filter((v) => v.voter_id === voterId).map((v) => key(v.a, v.b)));
  const pool = opts.allowOwn ? shapes : shapes.filter((s) => s.participant_id !== voterId);
  const pairs: [string, string][] = [];
  for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++) {
    if (!done.has(key(pool[i].id, pool[j].id))) pairs.push(rnd() < 0.5 ? [pool[i].id, pool[j].id] : [pool[j].id, pool[i].id]);
  }
  for (let i = pairs.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pairs[i], pairs[j]] = [pairs[j], pairs[i]]; }
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
