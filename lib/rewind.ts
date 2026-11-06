// RunZ Rewind : récap personnel de fin de challenge (façon « stories »).
// Fonctions pures, sans accès base, testées dans tests/rewind.test.ts.

import type { Boost, ScoredActivity, TeamStats } from './scoring.ts';
import { polylineToPath, shapeLabel } from './polyline.ts';

/** Ouverture du Rewind : false = réservé aux admins (aperçu), true = visible par tous les participants connectés. */
export const REWIND_PUBLIC = false;

const RUN = ['Run', 'VirtualRun'];
const WALK = ['Walk'];
const TRAIL = ['TrailRun'];
const HIKE = ['Hike'];
const EIFFEL_M = 330;
const DAYS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

/** Distances depuis Paris, pour l'équivalence ludique. */
const TRIPS: [number, string][] = [
  [5, 'le tour du lac Daumesnil'], [10, 'Paris → Saint-Denis'], [20, 'Paris → Versailles'], [42.2, 'un marathon'],
  [60, 'Paris → Fontainebleau'], [85, 'Paris → Chartres'], [135, 'Paris → Rouen'], [225, 'Paris → Lille'],
  [385, 'Paris → Nantes'], [465, 'Paris → Lyon'], [585, 'Paris → Bordeaux'], [775, 'Paris → Marseille'],
];

export type RewindDay = { day: string; km: number; level: 0 | 1 | 2 | 3; streak: boolean };
export type RewindTeam = { id: number; name: string; emoji: string; color: string; rank: number; km: number; mine: boolean };

export type GalleryShape = { path: string; label: string; km: number; mine: boolean };
export type Track = { path: string; km: number; sport: string; day: string };
const MAX_TRACKS = 36;

export type Rewind = {
  name: string;
  avatar: string | null;
  teamName: string | null;
  teamColor: string | null;
  start: string; end: string; final: boolean; days: number;
  totalKm: number; countedKm: number; boostKm: number;
  trip: { label: string; km: number } | null;
  split: { run: number; walk: number; trail: number; hike: number };
  runPace: string | null;   // allure moyenne course « 5'48" »
  walkSpeed: string | null; // vitesse moyenne marche « 5,6 »
  bestPace: string | null;  // meilleure allure moyenne (course ≥ 3 km)
  activities: number; activeDays: number; longestStreak: number; capDays: number;
  calendar: RewindDay[];
  longest: { km: number; day: string } | null;
  bestDay: { km: number; day: string } | null;
  elevation: number; eiffel: number;
  slots: { morning: number; lunch: number; day: number; evening: number }; // part des km (0-1)
  earliest: { time: string; day: string } | null;
  favDay: { name: string; count: number } | null;
  boosts: { name: string; count: number }[]; boostsCaught: number; boostsTotal: number;
  shape: { path: string; label: string; km: number; day: string; wins: number; duels: number; rank: number | null } | null;
  teamShare: number; teamRankInside: number | null; teamMembers: number; teamKm: number;
  podium: RewindTeam[];
  gallery: GalleryShape[]; // toutes les formes #TRACEZ retenues (sans lieu ni nom), la sienne en premier
  tracks: Track[];          // ses propres sorties avec tracé, les plus longues d'abord (36 max)
  tracksTotal: number;      // nombre de sorties avec tracé
};

const r1 = (n: number) => Math.round(n * 10) / 10;
const pace = (sec: number, km: number) => {
  if (!km || !sec) return null;
  const s = Math.round(sec / km);
  return `${Math.floor(s / 60)}'${String(s % 60).padStart(2, '0')}"`;
};
const dayList = (start: string, end: string) => {
  const out: string[] = [];
  for (let t = Date.parse(`${start}T12:00:00Z`); t <= Date.parse(`${end}T12:00:00Z`); t += 86400000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
};
const hm = (s: string) => s.slice(11, 16);

export function buildRewind(input: {
  participantId: string; name: string; teamId: number | null;
  scored: ScoredActivity[]; teams: TeamStats[]; boosts: Boost[];
  counted: { participantId: string; teamId: number | null; km: number }[]; // km comptés de chaque participant
  start: string; end: string; today: string; cap: number;
  battle?: { activityId: string; wins: number; duels: number; rank: number }[];
  avatar?: string | null;
  gallery?: { participantId: string; path: string; label: string; km: number }[];
  tracks?: { stravaId: number; polyline: string }[]; // tracés lus chez Strava (non stockés)
}): Rewind {
  const { participantId, scored, teams, boosts, start, end, today, cap } = input;
  const mine = scored.filter((s) => s.participant_id === participantId && s.eligible)
    .sort((a, b) => a.start_date_local.localeCompare(b.start_date_local));
  const sumKm = (l: ScoredActivity[]) => l.reduce((t, s) => t + s.rawKm, 0);
  const ofType = (types: string[]) => mine.filter((s) => types.includes(s.sport_type));
  const totalKm = sumKm(mine);
  const countedKm = mine.reduce((t, s) => t + s.countedKm, 0);
  const boostKm = mine.reduce((t, s) => t + (s.multiplier > 1 ? s.countedKm - s.countedKm / s.multiplier : 0), 0);
  const trip = [...TRIPS].reverse().find(([km]) => km <= totalKm);

  // Allures
  const runs = ofType([...RUN, ...TRAIL]).filter((s) => s.moving_time_s);
  const walks = ofType([...WALK, ...HIKE]).filter((s) => s.moving_time_s);
  const runKm = sumKm(runs), walkKm = sumKm(walks);
  const runSec = runs.reduce((t, s) => t + Number(s.moving_time_s), 0);
  const walkSec = walks.reduce((t, s) => t + Number(s.moving_time_s), 0);
  const best = runs.filter((s) => s.rawKm >= 3).map((s) => Number(s.moving_time_s) / s.rawKm).sort((a, b) => a - b)[0];

  // Jours
  const lastDay = today < end ? today : end;
  const days = dayList(start, end);
  const byDay = new Map<string, number>();
  for (const s of mine) byDay.set(s.day, (byDay.get(s.day) ?? 0) + s.rawKm);
  let streak = 0, run = 0, streakEnd = -1;
  days.forEach((d, i) => {
    run = (byDay.get(d) ?? 0) > 0 ? run + 1 : 0;
    if (run > streak) { streak = run; streakEnd = i; }
  });
  const calendar: RewindDay[] = days.map((d, i) => {
    const km = byDay.get(d) ?? 0;
    return { day: d, km: r1(km), level: km <= 0 ? 0 : km < cap / 2 ? 1 : km < cap ? 2 : 3, streak: streak > 1 && i > streakEnd - streak && i <= streakEnd };
  });
  const dayEntries = [...byDay.entries()].sort((a, b) => b[1] - a[1]);
  const longest = [...mine].sort((a, b) => b.rawKm - a.rawKm)[0];

  // Créneaux (heure de départ) : matin < 9h30, pause déj 11h30-14h, soir ≥ 18h, sinon en journée
  const slotKm = { morning: 0, lunch: 0, day: 0, evening: 0 };
  for (const s of mine) {
    const t = hm(s.start_date_local);
    if (t < '09:30') slotKm.morning += s.rawKm;
    else if (t >= '11:30' && t < '14:00') slotKm.lunch += s.rawKm;
    else if (t >= '18:00') slotKm.evening += s.rawKm;
    else slotKm.day += s.rawKm;
  }
  const tot = totalKm || 1;
  const earliest = [...mine].sort((a, b) => hm(a.start_date_local).localeCompare(hm(b.start_date_local)))[0];
  const dow = new Map<number, number>();
  for (const d of byDay.keys()) { const w = new Date(`${d}T12:00:00Z`).getUTCDay(); dow.set(w, (dow.get(w) ?? 0) + 1); }
  const fav = [...dow.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];

  // Boosts
  const boosted = new Map<string, number>();
  for (const s of mine) if (s.multiplier > 1 && s.boostName) boosted.set(s.boostName, (boosted.get(s.boostName) ?? 0) + 1);
  const real = boosts.filter((b) => !b.bonus_note && Number(b.multiplier) > 1 && b.starts_at.slice(0, 10) <= lastDay);
  const caught = real.filter((b) => boosted.has(b.name)).length;

  // Forme #TRACEZ
  const shapeAct = mine.find((s) => s.tagWinner != null && s.polyline);
  const path = shapeAct ? polylineToPath(shapeAct.polyline) : null;
  const res = shapeAct ? input.battle?.find((b) => b.activityId === shapeAct.id) : undefined;

  // Ses tracés : uniquement les activités qui comptent, les plus longues d'abord
  const poly = new Map((input.tracks ?? []).map((t) => [Number(t.stravaId), t.polyline]));
  const allTracks = mine
    .filter((s) => s.strava_activity_id != null && poly.has(Number(s.strava_activity_id)))
    .map((s) => ({ path: polylineToPath(poly.get(Number(s.strava_activity_id))) ?? '', km: Math.round(s.rawKm * 10) / 10, sport: s.sport_type, day: s.day }))
    .filter((t) => t.path)
    .sort((a, b) => b.km - a.km);

  // Équipe
  const team = teams.find((t) => t.team.id === input.teamId);
  const mates = input.counted.filter((c) => c.teamId != null && c.teamId === input.teamId).sort((a, b) => b.km - a.km);
  const teamKm = mates.reduce((t, c) => t + c.km, 0);
  const myIdx = mates.findIndex((c) => c.participantId === participantId);

  return {
    name: input.name, avatar: input.avatar || null, teamName: team?.team.name ?? null, teamColor: team?.team.color ?? null,
    start, end, final: today > end, days: days.length,
    totalKm: r1(totalKm), countedKm: r1(countedKm), boostKm: r1(boostKm),
    trip: trip ? { label: trip[1], km: trip[0] } : null,
    split: { run: r1(sumKm(ofType(RUN))), walk: r1(sumKm(ofType(WALK))), trail: r1(sumKm(ofType(TRAIL))), hike: r1(sumKm(ofType(HIKE))) },
    runPace: pace(runSec, runKm), walkSpeed: walkSec ? (walkKm / (walkSec / 3600)).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) : null,
    bestPace: best ? pace(best, 1) : null,
    activities: mine.length, activeDays: byDay.size, longestStreak: streak,
    capDays: [...byDay.values()].filter((km) => km >= cap).length,
    calendar,
    longest: longest ? { km: r1(longest.rawKm), day: longest.day } : null,
    bestDay: dayEntries[0] ? { km: r1(dayEntries[0][1]), day: dayEntries[0][0] } : null,
    elevation: Math.round(mine.reduce((t, s) => t + Number(s.elevation_gain_m ?? 0), 0)),
    eiffel: r1(mine.reduce((t, s) => t + Number(s.elevation_gain_m ?? 0), 0) / EIFFEL_M),
    slots: { morning: slotKm.morning / tot, lunch: slotKm.lunch / tot, day: slotKm.day / tot, evening: slotKm.evening / tot },
    earliest: earliest ? { time: hm(earliest.start_date_local).replace(':', 'h'), day: earliest.day } : null,
    favDay: fav ? { name: DAYS_FR[fav[0]], count: fav[1] } : null,
    boosts: [...boosted.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    boostsCaught: caught, boostsTotal: real.length,
    shape: shapeAct && path ? {
      path, label: shapeLabel(shapeAct.name), km: Math.round(shapeAct.rawKm * 100) / 100, day: shapeAct.day,
      wins: res?.wins ?? 0, duels: res?.duels ?? 0, rank: res?.rank ?? null,
    } : null,
    teamShare: teamKm ? countedKm / teamKm : 0,
    teamRankInside: myIdx >= 0 ? myIdx + 1 : null, teamMembers: mates.length, teamKm: r1(teamKm),
    podium: teams.map((t) => ({ id: t.team.id, name: t.team.name, emoji: t.team.emoji, color: t.team.color, rank: t.rank, km: r1(t.totalKm), mine: t.team.id === input.teamId })),
    gallery: (input.gallery ?? [])
      .map((g) => ({ path: g.path, label: g.label, km: g.km, mine: g.participantId === participantId }))
      .sort((a, b) => Number(b.mine) - Number(a.mine)),
    tracks: allTracks.slice(0, MAX_TRACKS), tracksTotal: allTracks.length,
  };
}
