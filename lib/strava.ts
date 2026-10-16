import 'server-only';
import { db, must } from './db';

const API = 'https://www.strava.com/api/v3';
const OAUTH = 'https://www.strava.com/oauth';

export const appUrl = () => (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
// activity:read = activités visibles par "Tout le monde"/"Abonnés". activity:read_all inclut aussi
// les activités "Moi uniquement" (utile pour qui garde ses marches privées).
export const stravaScope = () => process.env.STRAVA_SCOPE || 'activity:read_all';

export function authorizeUrl(state: string) {
  const u = new URL(`${OAUTH}/authorize`);
  u.searchParams.set('client_id', process.env.STRAVA_CLIENT_ID || '');
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

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${OAUTH}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      ...body,
    }),
  });
  if (!res.ok) throw new Error(`Strava token ${res.status}: ${await res.text()}`);
  return res.json();
}

export const exchangeCode = (code: string) => tokenRequest({ code, grant_type: 'authorization_code' });

type TokenRow = { id: string; access_token: string | null; refresh_token: string | null; token_expires_at: number | null };

/** Renvoie un access token valide, en le rafraîchissant si besoin (expire toutes les 6 h). */
export async function validToken(p: TokenRow): Promise<string> {
  if (!p.refresh_token) throw new Error('Participant non connecté à Strava');
  if (p.access_token && p.token_expires_at && p.token_expires_at - 300 > Date.now() / 1000) return p.access_token;
  const t = await tokenRequest({ refresh_token: p.refresh_token, grant_type: 'refresh_token' });
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
    .select('id, access_token, refresh_token, token_expires_at').eq('id', participantId).single()) as TokenRow;
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
    .select('id, access_token, refresh_token, token_expires_at').eq('id', participantId).single()) as TokenRow;
  return api<StravaActivity>(await validToken(p), `/activities/${activityId}`);
}

/** Révoque l'accès côté Strava et efface tokens + activités Strava stockées. */
export async function disconnect(participantId: string, revoke = true) {
  const p = must(await db().from('participants')
    .select('id, access_token, refresh_token, token_expires_at').eq('id', participantId).single()) as TokenRow;
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
