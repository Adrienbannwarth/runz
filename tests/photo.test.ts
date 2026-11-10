import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasPhotoTag, photoEntries, photoResults, photoTeamBonus, photosToVote, photoTitle, type PhotoVote } from '../lib/photo-core.ts';
import { computeStandings, scoreActivities, type Activity, type Boost, type Settings } from '../lib/scoring.ts';

const settings: Settings = { start_date: '2026-10-27', end_date: '2026-11-27', daily_cap_km: 10, sprint_multiplier: 1, sport_types: ['Walk', 'Run', 'TrailRun', 'Hike'], cap_mode: 'cap' };
const pb: Boost = { id: 5, name: 'Photo couleur', starts_at: '2026-11-14T00:00:00', ends_at: '2026-11-15T23:59:59', multiplier: 1, tag: '#COULEURZ', bonus_km: 25, team_bonus_km: 50, bonus_note: '+25 km', vote_from: '2026-11-16' };
let n = 0;
const act = (pid: string, km: number, name: string, extra: Partial<Activity> = {}): Activity => ({
  id: `a${++n}`, participant_id: pid, source: 'strava', strava_activity_id: n, name, sport_type: 'Walk', start_date_local: '2026-11-14T10:00:00',
  distance_m: km * 1000, moving_time_s: km * 720, elevation_gain_m: 0, has_track: true, photo_url: 'https://x/p.jpg', photo_caption: 'Une porte rouge', ...extra,
});

test('Photo couleur : tag, titre, une photo par personne, contrôles', () => {
  for (const t of ['Sortie #COULEURZ (Porte)', '#couleur (x)', '# Couleurs']) assert.ok(hasPhotoTag(t), t);
  assert.ok(!hasPhotoTag('Les couleurs du matin'));
  assert.equal(photoTitle('Balade #COULEURZ ( Porte  rouge )'), 'Porte rouge');
  assert.equal(photoTitle('Balade #COULEURZ'), '');
  const acts = [
    act('a', 3, '#COULEURZ (Porte)'), act('a', 5, '#COULEURZ (Vélo)'),            // la plus longue est retenue
    act('b', 4, '#COULEURZ (Banc)', { photo_url: null }),                           // pas de photo
    act('c', 4, '#COULEURZ (Bus)', { strava_manual: true }),                        // saisie manuelle
    act('d', 4, '#COULEURZ (Toit)', { start_date_local: '2026-11-16T10:00:00' }),   // hors week-end
    act('e', 4, 'Footing', {}),                                                     // pas de tag
    act('f', 4, '#COULEURZ (Ville)', { moving_time_s: 600 }),                       // 24 km/h en marche : vitesse suspecte
  ];
  const e = photoEntries(pb, scoreActivities(acts, settings, [pb]));
  assert.deepEqual(e.map((x) => [x.participant_id, x.title]), [['a', 'Vélo']]);
});

test('Photo couleur : +25 km par personne, +50 km si toute l’équipe', () => {
  const participants = [{ id: 'a', display_name: 'A', team_id: 1 }, { id: 'b', display_name: 'B', team_id: 1 }, { id: 'c', display_name: 'C', team_id: 2 }, { id: 'd', display_name: 'D', team_id: 2 }];
  const acts = [act('a', 3, '#COULEURZ (1)'), act('b', 3, '#COULEURZ (2)'), act('c', 3, '#COULEURZ (3)')];
  const scored = scoreActivities(acts, settings, [pb]);
  const t = photoTeamBonus(pb, photoEntries(pb, scored), participants);
  assert.deepEqual([t.get(1)?.km, t.get(1)?.all, t.get(2)?.km, t.get(2)?.all], [100, true, 25, false]);
  const teams = [{ id: 1, name: 'R', color: '#f00', emoji: '', active: true }, { id: 2, name: 'B', color: '#00f', emoji: '', active: true }];
  const st = computeStandings({ settings, teams, participants, activities: acts, boosts: [pb], bonuses: [], today: '2026-11-16' });
  assert.equal(st.teams.find((x) => x.team.id === 1)?.bonusKm, 100);
  assert.equal(st.teams.find((x) => x.team.id === 2)?.bonusKm, 25);
});

test('Photo couleur : vote oui / non, pas sa photo, une fois, MVP au nombre de oui', () => {
  const acts = ['a', 'b', 'c', 'd'].map((p) => act(p, 3, `#COULEURZ (${p})`));
  const e = photoEntries(pb, scoreActivities(acts, settings, [pb]));
  assert.equal(photosToVote(e, [], 'a').length, 3);                                 // pas la sienne
  assert.equal(photosToVote(e, [], 'a', { allowOwn: true }).length, 4);             // aperçu admin
  assert.deepEqual(photosToVote(e, [], 'a').map((x) => x.id), photosToVote(e, [], 'a').map((x) => x.id)); // ordre stable
  const id = (p: string) => e.find((x) => x.participant_id === p)!.id;
  const votes: PhotoVote[] = [
    { voter_id: 'a', activity_id: id('b'), liked: true }, { voter_id: 'c', activity_id: id('b'), liked: true },
    { voter_id: 'a', activity_id: id('c'), liked: true }, { voter_id: 'b', activity_id: id('c'), liked: false },
  ];
  assert.equal(photosToVote(e, votes, 'a').length, 1);                              // déjà voté b et c
  const r = photoResults(e, votes);
  assert.deepEqual(r.slice(0, 2).map((x) => [x.entry.participant_id, x.likes, x.votes]), [['b', 2, 2], ['c', 1, 2]]);
});
