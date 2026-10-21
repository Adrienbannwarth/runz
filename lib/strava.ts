import 'server-only';
import { db, must } from './db';

const API = 'https://www.strava.com/api/v3';
const OAUTH = 'https://www.strava.com/oauth';

export const appUrl = () => (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
// activity:read = activités visibles par "Tout le monde"/"Abonnés". activity:read_all inclut aussi
// les activités "Moi uniquement" (utile pour qui garde ses marches privées).
export const stravaScope = () => process.env.STRAVA_SCOPE || 'activity:read_all';

// Plusieurs apps Strava (A = STRAVA_CLIENT_ID, B = STRAVA_CLIENT_ID_2, ...) pour répartir les athlètes.
// Chaque participant reste rattaché à l'app qui a émis ses tokens (colonne participants.strava_app).
export type StravaApp = { key: string; clientId: string; secret: string };
export function stravaApps(): StravaApp[] {
  const apps: StravaApp[] = [];
  if (process.env.STRAVA_CLIENT_ID) apps.push({ key: 'a', clientId: process.env.STRAVA_CLIENT_ID, secret: process.env.STRAVA_CLIENT_SECRET || '' });
  for (const [i, key] of [[2, 'b'], [3, 'c']] as const) {
    const id = process.env[`STRAVA_CLIENT_ID_${i}`];
    if (id) apps.push({ key, clientId: id, secret: process.env[`STRAVA_CLIENT_SECRET_${i}`] || '' });
  }
  return apps;
}
export const appCapacity = () => Number(process.env.STRAVA_APP_CAPACITY || 10);
export function appByKey(key?: string | null): StravaApp {
  const apps = stravaApps();
  return apps.find((a) => a.key === (key || 'a')) ?? apps[0];
}
/** Nombre d'athlètes connectés par app. */
export async function appUsage(): Promise<Record<string, number>> {
  const rows = must(await db().from('participants').select('strava_app').not('strava_athlete_id', 'is', null)) as { strava_app: string | null }[];
  const usage: Record<string, number> = Object.fromEntries(stravaApps().map((a) => [a.key, 0]));
  for (const r of rows) usage[r.strava_app || 'a'] = (usage[r.strava_app || 'a'] ?? 0) + 1;
  return usage;
}
/** Première app qui a encore de la place (null si tout est plein). */
export async function pickApp(): Promise<StravaApp | null> {
  const usage = await appUsage();
  return stravaApps().find((a) => (usage[a.key] ?? 0) < appCapacity()) ?? null;
}

export function authorizeUrl(state: string, appKey = 'a') {
  const u = new URL(`${OAUTH}/authorize`);
  u.searchParams.set('client_id', appByKey(appKey).clientId);
  u.searchParams.set('redirect_uri', `${appUrl()}/api/strava/callback`);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('approval_prompt', 'auto');
  u.searchParams.set('scope', stravaScope());
  u.searchParams.set('state', state);
  return u.toString();
}

type TokenResponse = {
  access_token: string; refresh_token: string; expires_at: number;
  athlete?: { id: number; firstname: string; lastname: string };
};

async function tokenRequest(body: Record<string, string>, appKey?: string | null): Promise<TokenResponse> {
  const app = appByKey(appKey);
  const res = await fetch(`${OAUTH}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: app.clientId, client_secret: app.secret, ...body }),
  });
  if (!res.ok) throw new Error(`Strava token ${res.status}: ${await res.text()}`);
  return res.json();
}

export const exchangeCode = (code: string, appKey: string) => tokenRequest({ code, grant_type: 'authorization_code' }, appKey);

type TokenRow = { id: string; access_token: string | null; refresh_token: string | null; token_expires_at: number | null; strava_app: string | null };
const TOKEN_COLS = 'id, access_token, refresh_token, token_expires_at, strava_app';

/** Renvoie un access token valide, en le rafraîchissant si besoin (expire toutes les 6 h). */
export async function validToken(p: TokenRow): Promise<string> {
  if (!p.refresh_token) throw new Error('Participant non connecté à Strava');
  if (p.access_token && p.token_expires_at && p.token_expires_at - 300 > Date.now() / 1000) return p.access_token;
  const t = await tokenRequest({ refresh_token: p.refresh_token, grant_type: 'refresh_token' }, p.strava_app);
  must(await db().from('participants').update({
    access_token: t.access_token, refresh_token: t.refresh_token, token_expires_at: t.expires_at,
  }).eq('id', p.id));
  return t.access_token;
}

async function api<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (res.status === 429) throw new Error('Limite de requêtes Strava atteinte, réessayer dans 15 min');
  if (!res.ok) throw new Error(`Strava ${path} ${res.status}`);
  return res.json();
}

type StravaActivity = {
  id: number; name: string; sport_type: string; type: string; start_date_local: string;
  distance: number; moving_time: number; total_elevation_gain: number;
  manual?: boolean; trainer?: boolean; map?: { summary_polyline?: string | null; polyline?: string | null } | null;
};

function toRow(participantId: string, a: StravaActivity) {
  return {
    participant_id: participantId,
    source: 'strava',
    strava_activity_id: a.id,
    name: a.name,
    sport_type: a.sport_type || a.type,
    start_date_local: a.start_date_local.replace(/Z$/, ''), // Strava suffixe "Z" mais c'est l'heure locale
    distance_m: a.distance,
    moving_time_s: a.moving_time,
    elevation_gain_m: a.total_elevation_gain,
    // Contrôle anti-triche : on note seulement SI un tracé existe, le tracé lui-même n'est jamais stocké
    strava_manual: !!a.manual,
    trainer: !!a.trainer,
    has_track: !!(a.map?.summary_polyline || a.map?.polyline),
  };
}

/** Seules les données utiles au calcul sont stockées (pas de tracé GPS, pas de polyline). */
export async function upsertActivity(participantId: string, a: StravaActivity) {
  must(await db().from('activities').upsert(toRow(participantId, a), { onConflict: 'strava_activity_id' }));
}

/** Import complet des activités d'un participant depuis le début du challenge (veille incluse). */
export async function syncParticipant(participantId: string, startDate: string, endDate: string) {
  const p = must(await db().from('participants')
    .select(TOKEN_COLS).eq('id', participantId).single()) as TokenRow;
  const token = await validToken(p);
  const after = Math.floor(new Date(`${startDate}T00:00:00Z`).getTime() / 1000) - 86400;
  const before = Math.floor(new Date(`${endDate}T23:59:59Z`).getTime() / 1000) + 86400;

  const all: StravaActivity[] = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await api<StravaActivity[]>(token, `/athlete/activities?after=${after}&before=${before}&per_page=100&page=${page}`);
    all.push(...batch);
    if (batch.length < 100) break;
  }
  if (all.length) {
    must(await db().from('activities').upsert(all.map((a) => toRow(participantId, a)), { onConflict: 'strava_activity_id' }));
  }
  // Supprime les activités effacées sur Strava depuis le dernier import
  const ids = new Set(all.map((a) => a.id));
  const existing = must(await db().from('activities').select('id, strava_activity_id')
    .eq('participant_id', participantId).eq('source', 'strava')) as { id: string; strava_activity_id: number }[];
  const gone = existing.filter((e) => !ids.has(Number(e.strava_activity_id))).map((e) => e.id);
  if (gone.length) must(await db().from('activities').delete().in('id', gone));

  must(await db().from('participants').update({ last_sync_at: new Date().toISOString() }).eq('id', participantId));
  return all.length;
}

export async function fetchActivity(participantId: string, activityId: number) {
  const p = must(await db().from('participants')
    .select(TOKEN_COLS).eq('id', participantId).single()) as TokenRow;
  return api<StravaActivity>(await validToken(p), `/activities/${activityId}`);
}

/** Révoque l'accès côté Strava et efface tokens + activités Strava stockées. */
export async function disconnect(participantId: string, revoke = true) {
  const p = must(await db().from('participants')
    .select(TOKEN_COLS).eq('id', participantId).single()) as TokenRow;
  if (revoke && p.refresh_token) {
    try {
      const token = await validToken(p);
      await fetch(`${OAUTH}/deauthorize`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    } catch { /* déjà révoqué côté Strava */ }
  }
  must(await db().from('activities').delete().eq('participant_id', participantId).eq('source', 'strava'));
  must(await db().from('participants').update({
    strava_athlete_id: null, access_token: null, refresh_token: null, token_expires_at: null, scope: null,
  }).eq('id', participantId));
}
