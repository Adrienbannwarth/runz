// Avis de fin de saison : questions et choix proposés (formulaire /avis et page admin).

export const RATINGS = [
  { v: 1, emoji: '😴', label: 'Bof' },
  { v: 2, emoji: '🙂', label: 'Sympa' },
  { v: 3, emoji: '😃', label: 'Bien' },
  { v: 4, emoji: '🤩', label: 'Top' },
  { v: 5, emoji: '🔥', label: 'Génial' },
] as const;

export const LIKED = [
  'Bouger avec les collègues', 'Le classement par équipe', 'Les boosts', 'Les tracés #TRACEZ',
  'La photo couleur', 'La synchro Strava automatique', 'Le récap sur zlack', 'Le Rewind',
] as const;

export const DISLIKED = [
  'Trop intense, tous les jours', 'Les boosts annoncés trop tard', 'Marche et course seulement',
  'Le plafond de 10 km par jour', 'Un mois, c’est long', 'Difficile de suivre mon équipe', 'Rien à redire',
] as const;

export const RHYTHMS = [
  'Un défi par jour', 'Quelques défis par semaine', 'Des défis connus d’avance, à faire à mon rythme', 'Un challenge court et intense (1 semaine)',
] as const;

export const NEXT = ['Oui, carrément', 'Peut-être', 'Non merci'] as const;

export const SPORTS = [
  'Vélo', 'Natation', 'Rameur / aviron', 'Salle, muscu, HIIT', 'Yoga / pilates', 'Escalade',
  'Padel, tennis, badminton', 'Sports collectifs', 'Ski, roller, glisse', 'Randonnée',
] as const;

export type Feedback = {
  id: string; participant_id: string | null; season: number; rating: number | null;
  liked: string[]; disliked: string[]; rhythm: string | null; next_season: string | null;
  sports: string[]; challenge: string | null; comment: string | null; created_at: string; updated_at: string;
};

/** Garde seulement les choix connus (le formulaire peut être bricolé). */
export const pick = (values: string[], allowed: readonly string[]) => [...new Set(values)].filter((v) => allowed.includes(v));
export const clip = (s: unknown, max: number) => (typeof s === 'string' ? s.trim().slice(0, max) : '') || null;

/** Comptage d'un choix multiple, du plus cité au moins cité. */
export function tally(rows: Feedback[], key: 'liked' | 'disliked' | 'sports', options: readonly string[]) {
  return options.map((o) => ({ label: o, n: rows.filter((r) => r[key].includes(o)).length })).sort((a, b) => b.n - a.n);
}
export function tallyOne(rows: Feedback[], key: 'rhythm' | 'next_season', options: readonly string[]) {
  return options.map((o) => ({ label: o, n: rows.filter((r) => r[key] === o).length }));
}
