import { NextRequest, NextResponse } from 'next/server';
import { db, must } from '@/lib/db';
import { syncParticipant } from '@/lib/strava';
import { getSettings } from '@/lib/data';

export const maxDuration = 60;

// Filet de sécurité si un webhook est perdu. Appelé par Vercel Cron (vercel.json).
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  const s = await getSettings();
  const people = must(await db().from('participants').select('id, display_name').not('refresh_token', 'is', null)) as { id: string; display_name: string }[];
  const report: Record<string, string | number> = {};
  for (const p of people) {
    try { report[p.display_name] = await syncParticipant(p.id, s.start_date, s.end_date); }
    catch (e) { report[p.display_name] = (e as Error).message; }
  }
  return NextResponse.json(report);
}
