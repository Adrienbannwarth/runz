import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRewind } from '../lib/rewind.ts';
import { computeStandings, type Activity, type Boost, type Settings } from '../lib/scoring.ts';

const settings: Settings = {
  start_date: '2026-10-27', end_date: '2026-11-27', daily_cap_km: 10, sprint_multiplier: 1,
  sport_types: ['Walk', 'Run', 'TrailRun', 'Hike', 'VirtualRun'], ranking_mode: 'total', cap_mode: 'cap',
};
const boosts: Boost[] = [
  { id: 1, name: 'Morning HourZ', starts_at: '2026-11-10T00:00:00', ends_at: '2026-11-13T23:59:59', multiplier: 2, from_time: '06:00', to_time: '09:30' },
  { id: 2, name: 'Sprint final', starts_at: '2026-11-23T00:00:00', ends_at: '2026-11-27T23:59:59', multiplier: 2 },
];
let n = 0;
const act = (pid: string, when: string, km: number, sport = 'Run', min = 0, elev = 0): Activity => ({
  id: String(++n), participant_id: pid, source: 'strava', strava_activity_id: n, name: null, sport_type: sport,
  start_date_local: when, distance_m: km * 1000, moving_time_s: min * 60, elevation_gain_m: elev, has_track: true,
});

test('Rewind : km, répartition, série, créneaux, boosts, équipe', () => {
  const activities = [
    act('a', '2026-11-10T07:00:00', 6, 'Run', 36, 50),   // matin, boosté ×2
    act('a', '2026-11-11T12:45:00', 4, 'Walk', 48, 10),  // midi
    act('a', '2026-11-12T18:00:00', 12, 'Run', 72, 100), // soir, plafonné à 10
    act('a', '2026-11-20T18:00:00', 3, 'Walk', 36),
    act('b', '2026-11-10T18:00:00', 8, 'Walk', 96),
  ];
  const teams = [{ id: 1, name: 'ORANGE', color: '#FA8F18', emoji: '🟠', active: true }, { id: 2, name: 'BLEU', color: '#3847C4', emoji: '🔵', active: true }];
  const participants = [{ id: 'a', display_name: 'Camille D.', team_id: 1 }, { id: 'b', display_name: 'Léo M.', team_id: 1 }];
  const st = computeStandings({ settings, teams, participants, activities, boosts, bonuses: [], today: '2026-11-28' });
  const r = buildRewind({
    participantId: 'a', name: 'Camille D.', teamId: 1, scored: st.scored, teams: st.teams, boosts,
    counted: st.people.map((p) => ({ participantId: p.participant.id, teamId: p.participant.team_id, km: p.countedKm })),
    start: settings.start_date, end: settings.end_date, today: '2026-11-28', cap: 10,
    tracks: [{ stravaId: activities[0].strava_activity_id!, polyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' }, { stravaId: activities[2].strava_activity_id!, polyline: '_p~iF~ps|U_ulLnnqC' }, { stravaId: 424242, polyline: '_p~iF~ps|U_ulLnnqC' }],
    gallery: [{ participantId: 'b', path: 'M0 0L1 1', label: 'Cœur', km: 8 }, { participantId: 'a', path: 'M0 0L2 2', label: 'Étoile', km: 10 }],
  });
  assert.equal(r.totalKm, 25);
  assert.deepEqual(r.split, { run: 18, walk: 7, trail: 0, hike: 0 });
  assert.equal(r.runPace, `6'00"`);
  assert.equal(r.activeDays, 4);
  assert.equal(r.longestStreak, 3);
  assert.equal(r.capDays, 1);
  assert.equal(r.calendar.length, 32);
  assert.equal(r.calendar.filter((d) => d.streak).length, 3);
  assert.equal(r.boostKm, 6);
  assert.deepEqual(r.boosts, [{ name: 'Morning HourZ', count: 1 }]);
  assert.equal(r.boostsCaught, 1);
  assert.equal(r.boostsTotal, 2);
  assert.equal(r.elevation, 160);
  assert.equal(r.earliest?.time, '07h00');
  assert.equal(r.trip?.label, 'Paris → Versailles');
  assert.ok(Math.abs(r.slots.morning - 6 / 25) < 1e-9);
  assert.ok(Math.abs(r.slots.lunch - 4 / 25) < 1e-9);
  assert.ok(Math.abs(r.slots.evening - 15 / 25) < 1e-9);
  assert.equal(r.slots.day, 0);
  assert.deepEqual(r.tracks.map((x) => x.km), [12, 6]); // plus longue d'abord, activité inconnue ignorée
  assert.equal(r.tracksTotal, 2);
  assert.deepEqual(r.gallery.map((g) => [g.label, g.mine]), [['Étoile', true], ['Cœur', false]]);
  assert.equal(r.teamRankInside, 1);
  assert.equal(r.final, true);
  assert.equal(r.podium.find((t) => t.mine)?.rank, 1);
});
