import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStandings, leadSentence, normLocal, scoreActivities, slotOf, weekOf, type Activity, type Boost, type Settings } from '../lib/scoring.ts';

// Réglages du fichier RunZ-Suivi.xlsx (onglet Paramètres)
const settings: Settings = {
  start_date: '2026-10-27', end_date: '2026-11-27', daily_cap_km: 10, sprint_multiplier: 1,
  sport_types: ['Walk', 'Run', 'TrailRun', 'Hike', 'VirtualRun'], ranking_mode: 'total', cap_mode: 'alert',
};
// Onglet Boost
const boosts: Boost[] = [
  { id: 1, name: 'Flash HourZ ×2', starts_at: '2026-11-02T00:00:00', ends_at: '2026-11-06T23:59:59', multiplier: 2, slot: '19h-22h' },
  { id: 2, name: 'On vient à pied Days', starts_at: '2026-11-09T00:00:00', ends_at: '2026-11-11T23:59:59', multiplier: 3, slot: 'Tous' },
  { id: 3, name: 'Tracé GPS', starts_at: '2026-11-16T00:00:00', ends_at: '2026-11-20T23:59:59', multiplier: 5, slot: 'Tous' },
  { id: 4, name: 'Sprint final', starts_at: '2026-11-27T00:00:00', ends_at: '2026-11-27T23:59:59', multiplier: 2, slot: 'Tous' },
];
let n = 0;
const act = (pid: string, when: string, km: number, sport = 'Run', elev = 0): Activity => ({
  id: String(++n), participant_id: pid, source: 'strava', strava_activity_id: n, name: null, sport_type: sport,
  start_date_local: when, distance_m: km * 1000, moving_time_s: 0, elevation_gain_m: elev,
});

test('normLocal, créneaux, semaines', () => {
  assert.equal(normLocal('2026-11-02T18:30:00Z'), '2026-11-02T18:30:00');
  assert.equal(normLocal('2026-11-02 18:30'), '2026-11-02T18:30:00');
  assert.equal(slotOf('2026-11-02T07:59:00'), 'Avant 8h');
  assert.equal(slotOf('2026-11-02T12:30:00'), '12h-14h');
  assert.equal(slotOf('2026-11-02T14:00:00'), 'Autre');
  assert.equal(slotOf('2026-11-02T21:59:00'), '19h-22h');
  assert.equal(weekOf('2026-10-27', '2026-10-27'), 1);
  assert.equal(weekOf('2026-11-02', '2026-10-27'), 1);
  assert.equal(weekOf('2026-11-03', '2026-10-27'), 2);
});

test('filtre type et période', () => {
  const s = scoreActivities([
    act('a', '2026-11-03T10:00:00', 5, 'Ride'),
    act('a', '2026-10-26T10:00:00', 5),
    act('a', '2026-11-03T10:00:00', 5, 'Wheelchair'),
    act('a', '2026-11-03T10:00:00', 5, 'Walk'),
  ], settings, []);
  assert.deepEqual(s.map((x) => x.eligible), [false, false, false, true]);
});

test('boost par période + créneau, le plus fort gagne', () => {
  const s = scoreActivities([
    act('a', '2026-11-03T19:30:00', 4), // Flash HourZ ×2
    act('a', '2026-11-03T12:00:00', 4), // hors créneau
    act('a', '2026-11-07T19:30:00', 4), // hors période
    act('a', '2026-11-10T09:00:00', 4), // On vient à pied ×3
    act('a', '2026-11-27T09:00:00', 4), // Sprint final ×2
  ], settings, boosts);
  assert.deepEqual(s.map((x) => x.multiplier), [2, 1, 1, 3, 2]);
  assert.equal(s[0].countedKm, 8);
  assert.equal(s[3].boostName, 'On vient à pied Days');
});

test('plafond : alerte par défaut, coupe en mode cap', () => {
  const acts = [act('a', '2026-11-04T08:00:00', 7), act('a', '2026-11-04T18:00:00', 5)];
  const alert = scoreActivities(acts, settings, []);
  assert.equal(alert[0].overCap, true);
  assert.equal(alert[0].countedKm + alert[1].countedKm, 12);
  const cap = scoreActivities(acts, { ...settings, cap_mode: 'cap' }, []);
  assert.ok(Math.abs(cap[0].countedKm + cap[1].countedKm - 10) < 1e-9);
});

test('classement au total, stats MVP et phrase du récap', () => {
  const teams = [
    { id: 1, name: 'Rouges', color: '#f00', emoji: '', active: true },
    { id: 2, name: 'Bleus', color: '#00f', emoji: '', active: true },
    { id: 3, name: 'Jaunes', color: '#ff0', emoji: '', active: false },
  ];
  const participants = [
    { id: 'r1', display_name: 'R1', team_id: 1 }, { id: 'r2', display_name: 'R2', team_id: 1 },
    { id: 'b1', display_name: 'B1', team_id: 2 },
  ];
  const res = computeStandings({
    settings, teams, participants, boosts, today: '2026-11-03',
    activities: [
      act('r1', '2026-11-03T07:00:00', 6), act('r2', '2026-11-03T12:30:00', 4, 'Walk', 120),
      act('b1', '2026-11-03T20:00:00', 9), // Flash ×2 → 18
    ],
    bonuses: [{ id: 1, team_id: 1, participant_id: null, km: 30, reason: 'Tous au compteur', awarded_on: '2026-11-03' }],
  });
  assert.equal(res.teams.length, 2);
  assert.equal(res.teams[0].team.name, 'Rouges'); // 10 + 30 = 40 > 18 (mode total)
  assert.equal(res.teams[0].totalKm, 40);
  assert.equal(res.teams[0].avgKm, 20);
  assert.equal(res.teams[1].multiplierKm, 9);
  assert.equal(leadSentence(res.teams, 'total'), 'Les Rouges mènent de 22,0 km.');
  const b1 = res.people.find((p) => p.participant.id === 'b1')!;
  assert.equal(b1.flashKm, 9);
  assert.equal(b1.rawKm, 9);
  assert.equal(b1.countedKm, 18);
  const r1 = res.people.find((p) => p.participant.id === 'r1')!;
  assert.equal(r1.earlyKm, 6);
  assert.equal(res.people.find((p) => p.participant.id === 'r2')!.lunchKm, 4);
  assert.equal(r1.activeThisWeek, true);
  // en moyenne : Rouges 20/pers. > Bleus 18
  const avg = computeStandings({ ...{ settings: { ...settings, ranking_mode: 'average' } }, teams, participants, boosts, today: '2026-11-03',
    activities: [act('r1', '2026-11-03T07:00:00', 6), act('b1', '2026-11-03T20:00:00', 9)], bonuses: [] });
  assert.equal(avg.teams[0].team.name, 'Bleus'); // 18 > 6/2 = 3
});

test('signalement des activités sans tracé (comptent quand même)', async () => {
  const { flagOf } = await import('../lib/scoring.ts');
  const base = act('a', '2026-11-03T10:00:00', 5);
  assert.equal(flagOf({ ...base, strava_manual: true }), 'Saisie manuelle dans Strava (sans tracé)');
  assert.equal(flagOf({ ...base, has_track: false }), 'Aucun tracé GPS');
  assert.equal(flagOf({ ...base, has_track: false, trainer: true }), undefined);
  assert.equal(flagOf({ ...base, sport_type: 'VirtualRun', has_track: false }), undefined);
  assert.equal(flagOf({ ...base, has_track: true }), undefined);
  assert.equal(flagOf({ ...base, source: 'manual' }), undefined);
  const s = scoreActivities([{ ...base, strava_manual: true }], settings, []);
  assert.equal(s[0].countedKm, 5);
  assert.ok(s[0].flag);
});

test('phrase du récap avec un nom « Team … »', () => {
  const t = (name: string, score: number) => ({ team: { id: 1, name, color: '', emoji: '', active: true }, members: 5, realKm: 0, multiplierKm: 0, countedKm: 0, bonusKm: 0, totalKm: score, avgKm: 0, score, todayKm: 0, notYetThisWeek: 0, rank: 1 });
  assert.equal(leadSentence([t('Team Rouge', 30), t('Team Vert', 20)], 'total'), 'La Team Rouge mène de 10,0 km.');
});

test('boost « à valider » : sans validation pas de multiplicateur, avec validation il s’applique', () => {
  const manual: Boost[] = boosts.map((b) => (b.id === 3 ? { ...b, manual: true } : b));
  const base = act('a', '2026-11-17T10:00:00', 4); // Tracé GPS ×5, à valider
  const [pending] = scoreActivities([base], settings, manual);
  assert.equal(pending.multiplier, 1);
  assert.equal(pending.countedKm, 4);
  assert.deepEqual(pending.pendingBoosts.map((x) => x.id), [3]);
  const [ok] = scoreActivities([{ ...base, validated_boosts: [3] }], settings, manual);
  assert.equal(ok.multiplier, 5);
  assert.equal(ok.countedKm, 20);
  assert.equal(ok.pendingBoosts.length, 0);
  // un boost automatique reste automatique à côté
  const [flash] = scoreActivities([act('a', '2026-11-03T20:00:00', 4)], settings, manual);
  assert.equal(flash.multiplier, 2);
});
