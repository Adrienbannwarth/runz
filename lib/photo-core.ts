// Boost « Photo couleur » (#COULEURZ) et son vote façon appli de rencontre : logique pure, testée dans tests/photo.test.ts.
//
// Règles :
// - Pendant le boost, une sortie à pied ou en courant nommée « #COULEURZ (nom) », avec une photo ajoutée sur Strava,
//   rapporte bonus_km (25) à l'équipe. Une seule par personne (la plus longue). Mêmes contrôles que le reste :
//   activité éligible (vitesse, exclusion), vrai tracé GPS, pas de saisie manuelle Strava.
// - Si TOUS les membres d'une équipe en ont une : team_bonus_km (50) en plus pour l'équipe.
// - Réactions : chaque participant voit chaque photo une fois (pas la sienne) et met une réaction positive (ou passe).
//   Pas de MVP automatique : il est choisi par l'organisation à partir des réactions.

import type { Boost, Participant, ScoredActivity } from './scoring.ts';

/** Tag des photos : #COULEURZ (accepte aussi #COULEUR, #COULEURS, majuscules et espaces). */
export const PHOTO_TAG = /#\s*couleur\s*[sz]?(?![a-zà-ÿ])/i;
export const hasPhotoTag = (name?: string | null) => !!name && PHOTO_TAG.test(name);

export type PhotoEntry = { id: string; participant_id: string; url: string; title: string; caption: string; km: number; sport: string; day: string; excluded: boolean };
export type PhotoVote = { voter_id: string; activity_id: string; liked: boolean; reaction?: string | null };

/** Réactions proposées sous chaque photo, toutes positives. */
export const REACTIONS = [
  { key: 'love', emoji: '🫶', label: 'J’adore' },
  { key: 'couleur', emoji: '🎨', label: 'Trop couleur' },
  { key: 'drole', emoji: '😂', label: 'Trop drôle' },
  { key: 'trouvaille', emoji: '🤯', label: 'Belle trouvaille' },
] as const;
export type ReactionKey = (typeof REACTIONS)[number]['key'];
export const isReaction = (x: unknown): x is ReactionKey => REACTIONS.some((r) => r.key === x);

/** Le boost photo : un boost à tag qui rapporte des km bonus (le plus récent). */
export const photoBoost = (boosts: Boost[]) =>
  boosts.filter((b) => b.tag && Number(b.bonus_km) > 0).sort((x, y) => String(y.starts_at).localeCompare(String(x.starts_at)))[0];

/** Titre affiché : le texte entre parenthèses (« #COULEURZ (Porte rouge) » → « Porte rouge »), rien sinon. */
export const photoTitle = (name?: string | null) => (name?.match(/\(([^)]+)\)/)?.[1] ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);

/** Photos retenues : une par personne (la plus longue sortie), dans la période du boost, avec les contrôles habituels. */
export function photoEntries(boost: Boost, scored: ScoredActivity[], opts: { includeExcluded?: boolean } = {}): PhotoEntry[] {
  const from = boost.starts_at.slice(0, 10), to = boost.ends_at.slice(0, 10);
  const ok = scored.filter((a) => a.eligible && !!a.photo_url && hasPhotoTag(a.name)
    && a.day >= from && a.day <= to && a.has_track !== false && !a.strava_manual && !a.trainer);
  const best = new Map<string, ScoredActivity>();
  for (const a of ok) { const cur = best.get(a.participant_id); if (!cur || a.rawKm > cur.rawKm) best.set(a.participant_id, a); }
  return [...best.values()]
    .filter((a) => opts.includeExcluded || !a.vote_excluded)
    .map((a) => ({ id: a.id, participant_id: a.participant_id, url: a.photo_url!, title: photoTitle(a.name), caption: (a.photo_caption ?? '').trim().slice(0, 280), km: Math.round(a.rawKm * 100) / 100, sport: a.sport_type, day: a.day, excluded: !!a.vote_excluded }));
}

/** Km bonus par équipe : bonus_km par personne avec une photo, + team_bonus_km si tous les membres en ont une. */
export function photoTeamBonus(boost: Boost | undefined, entries: PhotoEntry[], participants: Participant[]) {
  const out = new Map<number, { people: number; members: number; km: number; all: boolean }>();
  if (!boost) return out;
  const withPhoto = new Set(entries.map((e) => e.participant_id));
  for (const p of participants) {
    if (p.team_id == null) continue;
    const t = out.get(p.team_id) ?? { people: 0, members: 0, km: 0, all: false };
    t.members++; if (withPhoto.has(p.id)) t.people++;
    out.set(p.team_id, t);
  }
  for (const t of out.values()) {
    t.all = t.members > 0 && t.people === t.members;
    t.km = t.people * Number(boost.bonus_km ?? 0) + (t.all ? Number(boost.team_bonus_km ?? 0) : 0);
  }
  return out;
}

/** Photos qu'il reste à voter pour ce votant, dans un ordre propre à lui (stable d'un chargement à l'autre). */
export function photosToVote(entries: PhotoEntry[], votes: PhotoVote[], voterId: string, opts: { allowOwn?: boolean } = {}) {
  const seen = new Set(votes.filter((v) => v.voter_id === voterId).map((v) => v.activity_id));
  const pool = entries.filter((e) => !seen.has(e.id) && (opts.allowOwn || e.participant_id !== voterId));
  const key = (id: string) => { let h = 2166136261; for (const c of voterId + id) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
  return pool.sort((a, b) => key(a.id) - key(b.id));
}

/** Réactions reçues par photo (pour aider l'organisation à choisir le MVP), triées par nombre total de réactions. */
export function photoResults(entries: PhotoEntry[], votes: PhotoVote[]) {
  return entries.map((e) => {
    const vs = votes.filter((v) => v.activity_id === e.id);
    const by = Object.fromEntries(REACTIONS.map((r) => [r.key, vs.filter((v) => v.reaction === r.key).length])) as Record<ReactionKey, number>;
    const total = REACTIONS.reduce((t, r) => t + by[r.key], 0);
    return { entry: e, by, total, seen: vs.length };
  }).sort((x, y) => y.total - x.total || y.seen - x.seen);
}
