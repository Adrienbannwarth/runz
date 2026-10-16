'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { clearUserSession, getParticipantId } from '@/lib/session';
import { disconnect, syncParticipant } from '@/lib/strava';
import { getSettings } from '@/lib/data';

export async function syncMe() {
  const pid = await getParticipantId();
  if (!pid) redirect('/');
  const s = await getSettings();
  let msg = 'ok';
  try { await syncParticipant(pid, s.start_date, s.end_date); } catch (e) { msg = (e as Error).message; }
  revalidatePath('/');
  redirect(`/me?sync=${encodeURIComponent(msg)}`);
}

export async function disconnectMe() {
  const pid = await getParticipantId();
  if (!pid) redirect('/');
  await disconnect(pid, true);
  await clearUserSession();
  redirect('/?disconnected=1');
}

export async function logout() {
  await clearUserSession();
  redirect('/');
}
