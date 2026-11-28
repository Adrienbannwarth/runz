import 'server-only';
import { db } from './db';

/** Une saison du challenge (table seasons, migration 025). */
export type Season = { id: number; name: string; kind: 'runz' | 'bingoz' | string; starts_on: string | null; ends_on: string | null; status: 'draft' | 'live' | 'done' | string };

/** Valeurs par défaut si la migration 025 n'est pas encore passée. */
const FALLBACK: Season[] = [
  { id: 1, name: 'RunZ', kind: 'runz', starts_on: '2026-10-27', ends_on: '2026-11-27', status: 'done' },
  { id: 2, name: 'BingoZ', kind: 'bingoz', starts_on: null, ends_on: null, status: 'draft' },
];

export async function loadSeasons(): Promise<Season[]> {
  const { data, error } = await db().from('seasons').select('*').order('id');
  return error || !data?.length ? FALLBACK : (data as Season[]);
}

/** Saison affichée sur l'accueil (réglage settings.current_season, 1 par défaut). */
export async function currentSeasonId(): Promise<number> {
  const { data, error } = await db().from('settings').select('current_season').eq('id', 1).maybeSingle();
  return error ? 1 : Number((data as { current_season?: number } | null)?.current_season ?? 1);
}

/** Ce participant peut-il voir les saisons en préparation (/bingoz) ? Colonne participants.can_preview. */
export async function canPreview(participantId: string | null): Promise<boolean> {
  if (!participantId) return false;
  const { data, error } = await db().from('participants').select('can_preview').eq('id', participantId).maybeSingle();
  return !error && !!(data as { can_preview?: boolean } | null)?.can_preview;
}
