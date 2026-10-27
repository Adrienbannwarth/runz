import { NextRequest, NextResponse, after } from 'next/server';
import { db, must } from '@/lib/db';
import { appUrl, exchangeCode, stravaApps, syncParticipant } from '@/lib/strava';
import { setUserSession } from '@/lib/session';
import { getSettings } from '@/lib/data';

const fail = (msg: string) => NextResponse.redirect(`${appUrl()}/?error=${encodeURIComponent(msg)}`);

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  if (q.get('error')) return fail('Connexion Strava annulée.');
  const [nonce, invite, appKey = 'a'] = (q.get('state') || '').split('.');
  if (!nonce || nonce !== req.cookies.get('runz_oauth')?.value) return fail('Session expirée, réessaie.');
  const scope = q.get('scope') || '';
  if (!scope.includes('activity:read')) return fail("Il faut autoriser l'accès à tes activités pour participer.");

  let t;
  try { t = await exchangeCode(q.get('code') || '', appKey); } catch (e) {
    // App pleine côté Strava (403 « limit of connected athletes ») : on relance la connexion sur l'app suivante
    const next = stravaApps().map((a) => a.key).filter((k) => k > appKey)[0];
    if (/ 403:/.test(String((e as Error).message)) && next) {
      console.error('app Strava pleine, bascule', appKey, '→', next);
      return NextResponse.redirect(`${appUrl()}/api/strava/connect?app=${next}${invite ? `&invite=${invite}` : ''}`);
    }
    console.error('échange du code Strava', e);
    return fail('Échec de la connexion Strava.');
  }
  if (!t.athlete) return fail('Profil Strava introuvable.');
  const tokens = {
    strava_athlete_id: t.athlete.id, access_token: t.access_token, refresh_token: t.refresh_token,
    token_expires_at: t.expires_at, scope, strava_app: appKey,
  };

  // 1) athlète déjà connu  2) athlète qui s'était déconnecté  3) lien d'invitation  4) nouveau participant
  const known = must(await db().from('participants').select('id').eq('strava_athlete_id', t.athlete.id).maybeSingle()) as { id: string } | null;
  let pid = known?.id;
  if (!pid) {
    const back = must(await db().from('participants').select('id').eq('strava_athlete_last', t.athlete.id)
      .is('strava_athlete_id', null).order('created_at').limit(1)) as { id: string }[];
    pid = back[0]?.id;
  }
  if (!pid && invite) {
    const inv = must(await db().from('participants').select('id, strava_athlete_id').eq('invite_token', invite).maybeSingle()) as { id: string; strava_athlete_id: number | null } | null;
    if (inv && inv.strava_athlete_id && inv.strava_athlete_id !== t.athlete.id) return fail('Ce lien est déjà associé à un autre compte Strava.');
    pid = inv?.id;
  }
  if (pid) {
    must(await db().from('participants').update(tokens).eq('id', pid));
  } else {
    const name = `${t.athlete.firstname} ${t.athlete.lastname?.charAt(0) ?? ''}.`.trim();
    const created = must(await db().from('participants').insert({ display_name: name, ...tokens }).select('id').single()) as { id: string };
    pid = created.id;
  }

  await setUserSession(pid);
  const id = pid;
  after(async () => {
    const s = await getSettings();
    await syncParticipant(id, s.start_date, s.end_date).catch((e) => console.error('sync initiale', e));
  });
  const res = NextResponse.redirect(`${appUrl()}/me?welcome=1`);
  res.cookies.delete('runz_oauth');
  return res;
}
