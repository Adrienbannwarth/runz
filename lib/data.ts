import 'server-only';
import { db, must } from './db';
import { boostActiveAt, boostsOn, computeStandings, slotOf, type Activity, type Bonus, type Boost, type Participant, type Settings, type Team } from './scoring';

export const TZ = 'Europe/Paris';
/** Date du jour (YYYY-MM-DD) à Paris. */
export const todayParis = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
/** Date-heure locale Paris "YYYY-MM-DDTHH:MM:SS". */
export function nowParis() {
  const f = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, dateStyle: 'short', timeStyle: 'medium' });
  return f.format(new Date()).replace(' ', 'T');
}

export type ParticipantRow = Participant & {
  invite_token: string; strava_athlete_id: number | null; strava_app: string | null; is_admin: boolean; is_captain: boolean; pole: string | null; last_sync_at: string | null; created_at: string;
};

export async function getSettings(): Promise<Settings & { challenge_name: string }> {
  return must(await db().from('settings').select('*').eq('id', 1).single());
}

export async function loadAll() {
  const [settings, teams, participants, activities, boosts, bonuses] = await Promise.all([
    getSettings(),
    db().from('teams').select('*').order('id').then(must) as Promise<Team[]>,
    db().from('participants')
      .select('id, display_name, team_id, invite_token, strava_athlete_id, strava_app, is_admin, is_captain, pole, last_sync_at, created_at')
      .order('display_name').then(must) as Promise<ParticipantRow[]>,
    db().from('activities').select('*').order('start_date_local', { ascending: false }).limit(10000).then(must) as Promise<Activity[]>,
    db().from('boosts').select('*').order('starts_at').then(must) as Promise<Boost[]>,
    db().from('bonuses').select('*').order('awarded_on', { ascending: false }).then(must) as Promise<Bonus[]>,
  ]);
  const today = todayParis();
  const standings = computeStandings({ settings, teams, participants, activities, boosts, bonuses, today });
  return { settings, teamList: teams, participants, activities, boosts, bonuses, today, ...standings };
}

/** Boost en cours à l'instant (pour la bannière). */
export function activeBoost(boosts: Boost[], settings: Settings) {
  const now = nowParis();
  const b = boostActiveAt(boosts, now);
  if (b) return { name: b.name, multiplier: Number(b.multiplier), until: b.ends_at, slot: windowLabel(b) === 'toute la journée' ? 'Tous' : windowLabel(b), manual: !!b.manual, sports: sportsLabel(b.sport_types), tag: b.tag ?? null };
  if (now.slice(0, 10) === settings.end_date && Number(settings.sprint_multiplier) > 1)
    return { name: 'Sprint final', multiplier: Number(settings.sprint_multiplier), until: `${settings.end_date}T23:59:59`, slot: 'Tous', manual: false, sports: '', tag: null };
  return null;
}

/** Boost du jour, tous créneaux confondus (Classement!B23). */
export function boostOfDay(boosts: Boost[], day: string) {
  return boostsOn(boosts, day)
    .map((x) => `${x.name}${windowLabel(x) !== 'toute la journée' ? ` (${windowLabel(x)})` : ''}`).join(', ') || 'Aucun';
}
export const daysLeft = (end: string, today: string) =>
  Math.max(0, Math.round((Date.parse(`${end}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000));
export const slotLabel = (s?: string | null) => (!s || s === 'Tous' ? 'toute la journée' : s);
const hFr = (t: string) => { const [h, m] = t.slice(0, 5).split(':'); return `${Number(h)}h${m === '00' ? '' : m}`; };
/** Créneau d'un boost pour l'affichage : « 18h30-22h », « 19h-22h » ou « toute la journée ». */
export const windowLabel = (b: Pick<Boost, 'slot' | 'from_time' | 'to_time'>) =>
  b.from_time && b.to_time
    ? (b.from_time.slice(0, 5) === '00:00' ? `avant ${hFr(b.to_time)}` : `${hFr(b.from_time)}-${hFr(b.to_time)}`)
    : slotLabel(b.slot);

export const fmtKm = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
export const fmtDate = (d: string) =>
  new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });

/** « ×2 », « ×1,5 » ou le texte du défi bonus. */
const SPORT_LABEL: Record<string, string> = { Walk: 'marche', Hike: 'rando', Run: 'course', TrailRun: 'trail', VirtualRun: 'tapis' };
/** « ×3 », « ×3 · marche et rando » ou le texte du défi bonus. */
export const boostEffect = (b: Pick<Boost, 'multiplier' | 'bonus_note' | 'sport_types'> & { tag?: string | null }) => {
  if (b.bonus_note) return b.bonus_note;
  const x = `×${Number(b.multiplier).toLocaleString('fr-FR')}`;
  if (b.tag) return `${x} sur ta forme ${b.tag} (nom)`;
  const t = sportsLabel(b.sport_types);
  return t ? `${x} · ${t} uniquement` : x;
};
/** « marche et rando » (vide si tous les types). */
export function sportsLabel(types?: string[] | null) {
  const t = (types ?? []).map((s) => SPORT_LABEL[s] ?? s);
  return t.length > 1 ? `${t.slice(0, -1).join(', ')} et ${t[t.length - 1]}` : t[0] ?? '';
}
