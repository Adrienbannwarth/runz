'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { timingSafeEqual } from 'node:crypto';
import { db, must } from '@/lib/db';
import { clearAdminSession, isAdmin, setAdminSession } from '@/lib/session';
import { syncParticipant } from '@/lib/strava';
import { getSettings } from '@/lib/data';

const s = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const n = (fd: FormData, k: string) => Number(s(fd, k).replace(',', '.'));
const orNull = (v: string) => (v === '' ? null : v);

async function guard() { if (!(await isAdmin())) redirect('/admin/login'); }
function done(tab: string, msg = 'Enregistré') {
  revalidatePath('/'); revalidatePath('/admin');
  redirect(`/admin?tab=${tab}&msg=${encodeURIComponent(msg)}`);
}

export async function adminLogin(fd: FormData) {
  const given = Buffer.from(s(fd, 'password'));
  const expected = Buffer.from(process.env.ADMIN_PASSWORD || '');
  if (expected.length === 0 || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    redirect('/admin/login?error=1');
  }
  await setAdminSession();
  redirect('/admin');
}
export async function adminLogout() { await clearAdminSession(); redirect('/'); }

// Participants
export async function createParticipant(fd: FormData) {
  await guard();
  const names = s(fd, 'names').split('\n').map((x) => x.trim()).filter(Boolean);
  const team_id = orNull(s(fd, 'team_id'));
  if (names.length) must(await db().from('participants').insert(names.map((display_name) => ({ display_name, team_id }))));
  done('participants', `${names.length} participant·e(s) ajouté·e(s)`);
}
export async function updateParticipant(fd: FormData) {
  await guard();
  must(await db().from('participants').update({
    display_name: s(fd, 'display_name'), team_id: orNull(s(fd, 'team_id')),
  }).eq('id', s(fd, 'id')));
  done('participants');
}
export async function toggleAdmin(fd: FormData) {
  await guard();
  const makeAdmin = s(fd, 'is_admin') === '1';
  if (!makeAdmin) {
    const admins = must(await db().from('participants').select('id').eq('is_admin', true)) as { id: string }[];
    if (admins.length <= 1) done('participants', 'Il faut garder au moins un admin');
  }
  must(await db().from('participants').update({ is_admin: makeAdmin }).eq('id', s(fd, 'id')));
  done('participants', makeAdmin ? 'Rôle admin donné' : 'Rôle admin retiré');
}
export async function deleteParticipant(fd: FormData) {
  await guard();
  must(await db().from('participants').delete().eq('id', s(fd, 'id')));
  done('participants', 'Participant·e supprimé·e (et ses activités)');
}
export async function syncAll() {
  await guard();
  const st = await getSettings();
  const people = must(await db().from('participants').select('id, display_name').not('refresh_token', 'is', null)) as { id: string; display_name: string }[];
  const errors: string[] = [];
  for (const p of people) {
    try { await syncParticipant(p.id, st.start_date, st.end_date); } catch (e) { errors.push(`${p.display_name} : ${(e as Error).message}`); }
  }
  done('participants', errors.length ? `Synchro avec erreurs · ${errors.join(' · ')}` : `${people.length} compte(s) Strava synchronisé(s)`);
}

// Saisie manuelle (captures d'écran)
export async function addManualActivity(fd: FormData) {
  await guard();
  const km = n(fd, 'km');
  if (!(km > 0)) done('saisie', 'Distance invalide');
  must(await db().from('activities').insert({
    participant_id: s(fd, 'participant_id'), source: 'manual', sport_type: s(fd, 'sport_type'),
    start_date_local: `${s(fd, 'date')}T${s(fd, 'time') || '12:00'}:00`, distance_m: Math.round(km * 1000),
    elevation_gain_m: n(fd, 'elevation') || 0, note: orNull(s(fd, 'note')), name: orNull(s(fd, 'note')),
  }));
  done('saisie', `${km} km ajoutés`);
}
export async function deleteActivity(fd: FormData) {
  await guard();
  must(await db().from('activities').delete().eq('id', s(fd, 'id')).eq('source', 'manual'));
  done('saisie', 'Activité supprimée');
}

// Bonus
export async function addBonus(fd: FormData) {
  await guard();
  must(await db().from('bonuses').insert({
    team_id: Number(s(fd, 'team_id')), participant_id: orNull(s(fd, 'participant_id')),
    km: n(fd, 'km'), reason: s(fd, 'reason'), awarded_on: s(fd, 'awarded_on'),
  }));
  done('bonus', 'Bonus ajouté');
}
export async function deleteBonus(fd: FormData) {
  await guard();
  must(await db().from('bonuses').delete().eq('id', Number(s(fd, 'id'))));
  done('bonus', 'Bonus supprimé');
}

// Boosts horaires
export async function addBoost(fd: FormData) {
  await guard();
  const from = s(fd, 'date');
  const to = s(fd, 'end_date') || from;
  must(await db().from('boosts').insert({
    name: s(fd, 'name'), multiplier: n(fd, 'multiplier') || 2, manual: fd.get('manual') === 'on',
    ...(s(fd, 'from_time') && s(fd, 'to_time')
      ? { slot: 'Tous', from_time: s(fd, 'from_time'), to_time: s(fd, 'to_time') }
      : { slot: s(fd, 'slot') || 'Tous' }),
    starts_at: `${from}T00:00:00`, ends_at: `${to}T23:59:59`,
  }));
  done('boosts', 'Boost programmé');
}
export async function setBoostManual(fd: FormData) {
  await guard();
  must(await db().from('boosts').update({ manual: s(fd, 'manual') === '1' }).eq('id', Number(s(fd, 'id'))));
  done('boosts', 'Boost mis à jour');
}
/** Accorde (ou retire) un boost « à valider » à une activité. */
export async function toggleBoostValidation(fd: FormData) {
  await guard();
  const id = s(fd, 'activity'); const boost = Number(s(fd, 'boost')); const on = s(fd, 'on') === '1';
  const row = must(await db().from('activities').select('validated_boosts').eq('id', id).single()) as { validated_boosts: number[] | null };
  const set = new Set((row.validated_boosts ?? []).map(Number));
  if (on) set.add(boost); else set.delete(boost);
  must(await db().from('activities').update({ validated_boosts: [...set] }).eq('id', id));
  done(`validations&boost=${boost}`, on ? 'Boost validé' : 'Validation retirée');
}
export async function deleteBoost(fd: FormData) {
  await guard();
  must(await db().from('boosts').delete().eq('id', Number(s(fd, 'id'))));
  done('boosts', 'Boost supprimé');
}

// Réglages
export async function saveSettings(fd: FormData) {
  await guard();
  must(await db().from('settings').update({
    challenge_name: s(fd, 'challenge_name'), start_date: s(fd, 'start_date'), end_date: s(fd, 'end_date'),
    daily_cap_km: n(fd, 'daily_cap_km'), sprint_multiplier: n(fd, 'sprint_multiplier') || 1,
    ranking_mode: s(fd, 'ranking_mode') === 'average' ? 'average' : 'total',
    cap_mode: s(fd, 'cap_mode') === 'cap' ? 'cap' : 'alert',
    sport_types: fd.getAll('sport_types').map(String),
  }).eq('id', 1));
  done('reglages');
}
export async function updateTeam(fd: FormData) {
  await guard();
  must(await db().from('teams').update({
    name: s(fd, 'name'), color: s(fd, 'color'), emoji: s(fd, 'emoji'), active: fd.get('active') === 'on',
  }).eq('id', Number(s(fd, 'id'))));
  done('reglages');
}
