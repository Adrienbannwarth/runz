import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStandings, normLocal, scoreActivities, type Activity, type Settings } from '../lib/scoring.ts';

const settings: Settings = {
  start_date: '2026-11-02', end_date: '2026-12-06', daily_cap_km: 15, sprint_multiplier: 2,
  sport_types: ['Walk', 'Run', 'TrailRun', 'Hike', 'VirtualRun'],
};
let n = 0;
const act = (pid: string, when: string, km: number, sport = 'Run', elev = 0): Activity => ({
  id: String(++n), participant_id: pid, source: 'strava', strava_activity_id: n, name: null, sport_type: sport,
  start_date_local: when, distance_m: km * 1000, moving_time_s: 0, elevation_gain_m: elev,
});

test('normLocal', () => {
  assert.equal(normLocal('2026-11-02T18:30:00Z'), '2026-11-02T18:30:00');
  assert.equal(normLocal('2026-11-02 18:30:00'), '2026-11-02T18:30:00');
  assert.equal(normLocal('2026-11-02T18:30'), '2026-11-02T18:30:00');
  assert.equal(normLocal('2026-11-02T18:30:00.123+01:00'), '2026-11-02T18:30:00');
});

test('filtre type et période', () => {
  const s = scoreActivities([
    act('a', '2026-11-03T10:00:00', 5, 'Ride'),
    act('a', '2026-11-01T10:00:00', 5),
    act('a', '2026-11-03T10:00:00', 5, 'Walk'),
  ], settings, []);
  assert.deepEqual(s.map((x) => x.eligible), [false, false, true]);
  assert.equal(s[2].countedKm, 5);
});

test('plafond journalier au prorata', () => {
  const s = scoreActivities([act('a', '2026-11-03T08:00:00', 12), act('a', '2026-11-03T18:00:00', 8), act('b', '2026-11-03T18:00:00', 8)], settings, []);
  assert.ok(Math.abs(s[0].countedKm + s[1].countedKm - 15) < 1e-9);
  assert.equal(s[2].countedKm, 8); // autre personne, non affectée
});

test('boost horaire, fenêtre [début, fin[ et pas de cumul', () => {
  const boosts = [
    { id: 1, name: 'Flash HourZ', starts_at: '2026-11-05T19:00:00', ends_at: '2026-11-05T22:00:00', multiplier: 2 },
    { id: 2, name: 'Mega', starts_at: '2026-11-05T20:00:00', ends_at: '2026-11-05T21:00:00', multiplier: 3 },
  ];
  const s = scoreActivities([
    act('a', '2026-11-05T19:30:00', 4), act('a', '2026-11-05T22:00:00', 4), act('b', '2026-11-05T20:15:00', 4),
  ], settings, boosts);
  assert.equal(s[0].countedKm, 8);
  assert.equal(s[1].countedKm, 4);
  assert.equal(s[2].countedKm, 12);
});

test('plafond appliqué avant le multiplicateur + sprint final', () => {
  const s = scoreActivities([act('a', '2026-12-06T09:00:00', 20)], settings, []);
  assert.equal(s[0].cappedKm, 15);
  assert.equal(s[0].countedKm, 30);
  assert.equal(s[0].boostName, 'Sprint final');
});

test('classement à la moyenne avec bonus', () => {
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
    settings, teams, participants, boosts: [], today: '2026-11-03',
    activities: [act('r1', '2026-11-03T10:00:00', 10), act('r2', '2026-11-03T10:00:00', 6, 'Walk', 120), act('b1', '2026-11-02T07:00:00', 9)],
    bonuses: [{ id: 1, team_id: 2, participant_id: null, km: 3, reason: 'Photo', awarded_on: '2026-11-03' }],
  });
  assert.equal(res.teams.length, 2); // Jaunes inactive
  assert.equal(res.teams[0].team.name, 'Bleus'); // (9+3)/1 = 12 > 16/2 = 8
  assert.equal(res.teams[0].avgKm, 12);
  assert.equal(res.teams[0].todayKm, 3);
  assert.equal(res.teams[1].avgKm, 8);
  assert.equal(res.teams[1].todayKm, 16);
  const b1 = res.people.find((p) => p.participant.id === 'b1')!;
  assert.equal(b1.earlyKm, 9);
  assert.equal(res.people.find((p) => p.participant.id === 'r2')!.elevationM, 120);
});
