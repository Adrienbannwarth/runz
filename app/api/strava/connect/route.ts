import { NextRequest, NextResponse } from 'next/server';
import { db, must } from '@/lib/db';
import { appByKey, appUrl, authorizeUrl, pickApp, stravaApps } from '@/lib/strava';

// Un seul lien pour tout le monde : on choisit l'app Strava qui a encore de la place.
// Un participant déjà rattaché à une app (reconnexion) y reste. ?app=b force une app (dépannage admin).
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const invite = (q.get('invite') || '').replace(/[^a-f0-9]/gi, '');
  let appKey = stravaApps().some((a) => a.key === q.get('app')) ? q.get('app')! : '';
  if (!appKey && invite) {
    const p = must(await db().from('participants').select('strava_app, strava_athlete_id').eq('invite_token', invite).maybeSingle()) as { strava_app: string | null; strava_athlete_id: number | null } | null;
    if (p?.strava_athlete_id && p.strava_app) appKey = p.strava_app;
  }
  if (!appKey) {
    const app = await pickApp();
    if (!app) {
      const msg = 'Toutes les places Strava sont prises pour le moment. Envoie tes captures d’écran à l’organisation, tes km seront saisis à la main.';
      return NextResponse.redirect(`${appUrl()}/?error=${encodeURIComponent(msg)}`);
    }
    appKey = app.key;
  }
  appByKey(appKey);
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const res = NextResponse.redirect(authorizeUrl(`${nonce}.${invite}.${appKey}`, appKey));
  res.cookies.set('runz_oauth', nonce, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 600, path: '/' });
  return res;
}
