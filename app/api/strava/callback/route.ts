import { NextRequest, NextResponse, after } from 'next/server';
import { db, must } from '@/lib/db';
import { appUrl, exchangeCode, syncParticipant } from '@/lib/strava';
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
  try { t = await exchangeCode(q.get('code') || '', appKey); } catch { return fail('Échec de la connexion Strava.'); }
  if (!t.athlete) return fail('Profil Strava introuvable.');
  const tokens = {
    strava_athlete_id: t.athlete.id, access_token: t.access_token, refresh_token: t.refresh_token,
    token_expires_at: t.expires_at, scope, strava_app: appKey,
  };

  // 1) athlète déjà connu  2) lien d'invitation  3) nouveau participant (équipe à attribuer par l'admin)
  const known = must(await db().from('participants').select('id').eq('strava_athlete_id', t.athlete.id).maybeSingle()) as { id: string } | null;
  let pid = known?.id;
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
