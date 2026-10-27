import { NextRequest, NextResponse, after } from 'next/server';
import { db, must } from '@/lib/db';
import { disconnect, fetchActivity, stillAuthorized, upsertActivity } from '@/lib/strava';

// Validation de l'abonnement webhook (voir README)
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  if (q.get('hub.mode') === 'subscribe' && q.get('hub.verify_token') === process.env.STRAVA_WEBHOOK_VERIFY_TOKEN) {
    return NextResponse.json({ 'hub.challenge': q.get('hub.challenge') });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

type Event = {
  object_type: 'activity' | 'athlete'; object_id: number; aspect_type: 'create' | 'update' | 'delete';
  owner_id: number; subscription_id: number; updates?: Record<string, string>;
};

// Strava exige une réponse 200 en moins de 2 s : le traitement se fait après la réponse.
export async function POST(req: NextRequest) {
  const ev = (await req.json()) as Event;
  // STRAVA_SUBSCRIPTION_ID peut lister plusieurs abonnements (un par app), séparés par des virgules
  const subs = (process.env.STRAVA_SUBSCRIPTION_ID || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (subs.length && !subs.includes(String(ev.subscription_id))) {
    return new NextResponse('ignored');
  }
  after(async () => {
    try {
      const p = must(await db().from('participants').select('id').eq('strava_athlete_id', ev.owner_id).maybeSingle()) as { id: string } | null;
      if (!p) return;
      if (ev.object_type === 'athlete' && ev.updates?.authorized === 'false') {
        // L'athlète a révoqué une app. S'il a autorisé deux apps RunZ (doublon) et révoque l'autre,
        // son accès via l'app enregistrée marche encore : on ne touche à rien.
        if (await stillAuthorized(p.id)) return;
        await disconnect(p.id, false); // l'athlète a révoqué l'accès depuis Strava : on efface ses données
      } else if (ev.object_type === 'activity' && ev.aspect_type === 'delete') {
        must(await db().from('activities').delete().eq('strava_activity_id', ev.object_id));
      } else if (ev.object_type === 'activity') {
        await upsertActivity(p.id, await fetchActivity(p.id, ev.object_id));
      }
    } catch (e) { console.error('webhook', e); }
  });
  return new NextResponse('ok');
}
