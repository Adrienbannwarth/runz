import { test } from 'node:test';
import { battleResults, remainingPairs, voteEnded, voteOpen, type Shape, type Vote } from '../lib/battle-core.ts';
import assert from 'node:assert/strict';
import { decodePolyline, hasTraceTag, polylineToPath } from '../lib/polyline.ts';
import { boostActiveAt, boostsOn, computeStandings, leadSentence, speedSuspect, longestGapM, strictShapeName, tagMatch, normLocal, scoreActivities, slotOf, weekOf, type Activity, type Boost, type Settings } from '../lib/scoring.ts';

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
  assert.equal(leadSentence(res.teams, 'total'), 'Les Rouges mènent de 22,00 km.');
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
  assert.equal(leadSentence([t('Team Rouge', 30), t('Team Vert', 20)], 'total'), 'La Team Rouge mène de 10,00 km.');
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

test('boost avec horaire perso 18h30-22h, chaque jour de la période', () => {
  const b: Boost[] = [{ id: 9, name: 'Lancement ×2', starts_at: '2026-10-27T00:00:00', ends_at: '2026-10-30T23:59:59', multiplier: 2, slot: 'Tous', from_time: '18:30:00', to_time: '22:00:00' }];
  const s = scoreActivities([
    act('a', '2026-10-27T18:30:00', 3), // pile 18h30 → ×2
    act('a', '2026-10-28T18:29:00', 3), // une minute avant → ×1
    act('a', '2026-10-29T21:59:00', 3), // → ×2
    act('a', '2026-10-30T22:00:00', 3), // 22h pile → ×1
    act('a', '2026-10-31T19:00:00', 3), // hors période → ×1
  ], settings, b);
  assert.deepEqual(s.map((x) => x.multiplier), [2, 1, 2, 1, 1]);
});

test('plafond coupé : on garde les km les plus boostés, le reste ne compte pas', () => {
  const b: Boost[] = [{ id: 9, name: 'Lancement ×2', starts_at: '2026-10-27T00:00:00', ends_at: '2026-10-30T23:59:59', multiplier: 2, slot: 'Tous', from_time: '18:30:00', to_time: '22:00:00' }];
  const cap = { ...settings, cap_mode: 'cap' as const };
  const total = (l: ReturnType<typeof scoreActivities>) => l.reduce((t, x) => t + x.countedKm, 0);
  // 10 km le matin + 10 km à 19h (×2) → les 10 km boostés comptent : 20
  const a = scoreActivities([act('a', '2026-10-27T08:00:00', 10), act('a', '2026-10-27T19:00:00', 10)], cap, b);
  assert.equal(total(a), 20);
  assert.equal(a[0].countedKm, 0);
  assert.ok(a[0].overCap && a[1].overCap);
  // 4 km le matin + 6 km à 19h → pile 10 km, rien n'est coupé : 4 + 12 = 16
  assert.equal(total(scoreActivities([act('a', '2026-10-27T08:00:00', 4), act('a', '2026-10-27T19:00:00', 6)], cap, b)), 16);
  // 7 km le matin + 5 km à 19h → 5 boostés (10) + 5 du matin = 15
  assert.equal(total(scoreActivities([act('a', '2026-10-27T08:00:00', 7), act('a', '2026-10-27T19:00:00', 5)], cap, b)), 15);
  // sans boost : les premiers km de la journée
  const c = scoreActivities([act('a', '2026-11-12T08:00:00', 7), act('a', '2026-11-12T18:00:00', 5)], cap, []);
  assert.deepEqual(c.map((x) => x.countedKm), [7, 3]);
});

test('équipe : le plafond ne crée pas de « boost » négatif', () => {
  const teams = [{ id: 1, name: 'Team Rouge', color: '#f00', emoji: '', active: true }];
  const res = computeStandings({
    settings: { ...settings, cap_mode: 'cap' }, teams, participants: [{ id: 'r1', display_name: 'R1', team_id: 1 }], boosts: [], bonuses: [], today: '2026-10-28',
    activities: [act('r1', '2026-10-28T08:00:00', 10.06)],
  });
  assert.equal(res.teams[0].totalKm, 10);
  assert.equal(res.teams[0].realKm, 10);
  assert.equal(res.teams[0].multiplierKm, 0);
});

// Calendrier réel en prod (au 28/10) : ce que voient les membres chaque jour, et le bandeau heure par heure
const prod: Boost[] = [
  { id: 5, name: 'Flash HourZ', starts_at: '2026-10-27T00:00:00', ends_at: '2026-10-30T23:59:59', multiplier: 2, slot: 'Tous', from_time: '18:30:00', to_time: '22:00:00' },
  { id: 2, name: 'On vient à pied Days', starts_at: '2026-11-05T00:00:00', ends_at: '2026-11-05T23:59:59', multiplier: 3, slot: 'Tous' },
  { id: 1, name: 'Tracé GPS', starts_at: '2026-11-07T00:00:00', ends_at: '2026-11-08T23:59:59', multiplier: 5, slot: 'Tous', manual: true },
  { id: 6, name: 'Flash Morning HourZ', starts_at: '2026-11-09T00:00:00', ends_at: '2026-11-11T23:59:59', multiplier: 1.5, slot: 'Tous', from_time: '00:00:00', to_time: '09:30:00' },
  { id: 7, name: 'Photo couleur', starts_at: '2026-11-13T00:00:00', ends_at: '2026-11-15T23:59:59', multiplier: 1, slot: 'Tous', bonus_note: '+10 km par photo validée' },
  { id: 3, name: 'Sprint final', starts_at: '2026-11-23T00:00:00', ends_at: '2026-11-27T23:59:59', multiplier: 2, slot: 'Tous' },
];

test('calendrier : bloc « Boost en cours » des membres, jour par jour', () => {
  const on = (d: string) => boostsOn(prod, d).map((b) => b.name);
  assert.deepEqual(on('2026-10-26'), []);
  assert.deepEqual(on('2026-10-27'), ['Flash HourZ']);
  assert.deepEqual(on('2026-10-30'), ['Flash HourZ']);
  assert.deepEqual(on('2026-10-31'), []);
  assert.deepEqual(on('2026-11-04'), []);
  assert.deepEqual(on('2026-11-05'), ['On vient à pied Days']);
  assert.deepEqual(on('2026-11-06'), []);
  assert.deepEqual(on('2026-11-07'), ['Tracé GPS']);
  assert.deepEqual(on('2026-11-08'), ['Tracé GPS']);
  assert.deepEqual(on('2026-11-09'), ['Flash Morning HourZ']);
  assert.deepEqual(on('2026-11-11'), ['Flash Morning HourZ']);
  assert.deepEqual(on('2026-11-12'), []);
  assert.deepEqual(on('2026-11-13'), ['Photo couleur']);
  assert.deepEqual(on('2026-11-15'), ['Photo couleur']);
  assert.deepEqual(on('2026-11-16'), []);
  assert.deepEqual(on('2026-11-23'), ['Sprint final']);
  assert.deepEqual(on('2026-11-27'), ['Sprint final']);
  assert.deepEqual(on('2026-11-28'), []);
});

test('calendrier : bandeau « en cours » heure par heure, et km comptés', () => {
  const at = (t: string) => boostActiveAt(prod, t)?.name ?? null;
  assert.equal(at('2026-10-28T18:29:00'), null);
  assert.equal(at('2026-10-28T18:30:00'), 'Flash HourZ');
  assert.equal(at('2026-10-28T21:59:00'), 'Flash HourZ');
  assert.equal(at('2026-10-28T22:00:00'), null);
  assert.equal(at('2026-11-05T07:00:00'), 'On vient à pied Days');
  assert.equal(at('2026-11-07T15:00:00'), 'Tracé GPS');
  assert.equal(at('2026-11-10T09:29:00'), 'Flash Morning HourZ');
  assert.equal(at('2026-11-10T09:30:00'), null);
  assert.equal(at('2026-11-14T12:00:00'), null); // Photo couleur : défi, pas de bandeau ×
  assert.equal(at('2026-11-25T12:00:00'), 'Sprint final');
  // km comptés pour une sortie de 4 km
  const k = (t: string, v: number[] = []) => scoreActivities([{ ...act('a', t, 4), validated_boosts: v }], { ...settings, cap_mode: 'cap' }, prod)[0].countedKm;
  assert.equal(k('2026-10-28T19:00:00'), 8);
  assert.equal(k('2026-11-05T08:00:00'), 12);
  assert.equal(k('2026-11-07T10:00:00'), 4);       // Tracé GPS pas encore validé
  assert.equal(k('2026-11-07T10:00:00', [1]), 20); // validé
  assert.equal(k('2026-11-10T08:00:00'), 6);
  assert.equal(k('2026-11-14T10:00:00'), 4);       // Photo couleur ne multiplie rien
  assert.equal(k('2026-11-24T10:00:00'), 8);
});

test('saisies manuelles Strava : ne comptent plus à partir de la date, sauf validation', () => {
  const s2 = { ...settings, manual_strava_from: '2026-10-31' };
  const m = (day: string, extra = {}) => ({ ...act('a', `${day}T10:00:00`, 5), strava_manual: true, ...extra });
  const [avant, apres, valide, capture, gps] = scoreActivities([
    m('2026-10-30'),                                  // avant la règle : compte
    m('2026-10-31'),                                  // week-end : ne compte pas
    m('2026-11-02', { manual_ok: true }),             // validée par un admin : compte
    { ...act('a', '2026-11-02T12:00:00', 4), source: 'manual' as const }, // saisie admin (capture) : pas concernée
    { ...act('a', '2026-11-03T12:00:00', 6), has_track: true },           // activité enregistrée : compte
  ], s2, []);
  assert.equal(avant.countedKm, 5);
  assert.equal(apres.eligible, false);
  assert.equal(apres.countedKm, 0);
  assert.ok(apres.manualReview);
  assert.equal(valide.countedKm, 5);
  assert.equal(capture.countedKm, 4);
  assert.equal(gps.countedKm, 6);
  // règle désactivée : tout compte comme avant
  assert.equal(scoreActivities([m('2026-11-02')], settings, [])[0].countedKm, 5);
});

test('#TRACEZ : tag, polyline, boost réservé aux activités taguées', () => {
  assert.ok(hasTraceTag('Mon cœur #TRACEZ'));
  assert.ok(hasTraceTag('licorne #tracez'));
  assert.ok(!hasTraceTag('Footing du midi'));
  assert.ok(tagMatch('#TRACEZ', 'Dessin # TraceZ du dimanche'));
  // exemple officiel de l'algorithme Google
  assert.deepEqual(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@'), [[38.5, -120.2], [40.7, -120.95], [43.252, -126.453]]);
  const path = polylineToPath('_p~iF~ps|U_ulLnnqC_mqNvxq`@')!;
  assert.match(path, /^M[\d.]+ [\d.]+L/);
  for (const n of path.match(/[\d.]+/g)!.map(Number)) assert.ok(n >= 0 && n <= 100);
  assert.equal(polylineToPath(null), null);
  // Tracé GPS ×5 à valider, réservé aux activités #TRACEZ
  const b: Boost[] = [{ id: 1, name: 'Tracé GPS', starts_at: '2026-11-07T00:00:00', ends_at: '2026-11-08T23:59:59', multiplier: 5, slot: 'Tous', manual: true, tag: '#TRACEZ' }];
  const cap = { ...settings, cap_mode: 'cap' as const };
  const [normale, forme, formeValidee] = scoreActivities([
    { ...act('a', '2026-11-07T10:00:00', 6), name: 'Run du samedi' },
    { ...act('a', '2026-11-08T10:00:00', 4), name: 'Cœur #TRACEZ' },
    { ...act('a', '2026-11-08T15:00:00', 12), name: 'Licorne #TRACEZ', validated_boosts: [1] },
  ], cap, b);
  assert.equal(normale.pendingBoosts.length, 0);   // pas taguée : n'apparaît pas à valider
  assert.equal(normale.countedKm, 6);
  assert.equal(forme.pendingBoosts.length, 1);     // taguée : à valider
  // dimanche : 4 + 12 = 16 km réels → plafond 10, la forme validée (×5) passe d'abord : 10 × 5 = 50
  assert.equal(formeValidee.countedKm, 50);
  assert.equal(forme.countedKm, 0);
});

test('Battle TraceZ : ouverture lundi 14h, duels, % de victoires', () => {
  const tb: Boost = { id: 1, name: 'Tracé GPS', starts_at: '2026-11-07T00:00:00', ends_at: '2026-11-08T23:59:59', multiplier: 5, tag: '#TRACEZ', vote_from: '2026-11-09', vote_to: '2026-11-13' };
  assert.equal(voteOpen(tb, '2026-11-09T13:59:59'), false);
  assert.equal(voteOpen(tb, '2026-11-09T14:00:00'), true);
  assert.equal(voteOpen(tb, '2026-11-13T23:59:00'), true);
  assert.equal(voteOpen(tb, '2026-11-14T00:00:00'), false);
  assert.equal(voteEnded(tb, '2026-11-13T23:59:00'), false);
  assert.equal(voteEnded(tb, '2026-11-14T08:00:00'), true);
  // Tirage « battle royale » : chaque forme n'apparaît qu'une fois par votant
  const mk = (n: number, owner = (i: number) => `p${i}`) => Array.from({ length: n }, (_, i) => ({ id: `S${String(i).padStart(2, '0')}`, participant_id: owner(i), path: 'M0 0L1 1', km: 0, label: '' }));
  const sixteen: Shape[] = mk(16, (i) => (i < 8 ? 'me' : 'christelle'));
  const draw = remainingPairs(sixteen, [], 'me', { allowOwn: true });
  assert.equal(draw.length, 8);                                    // 16 formes → 8 duels, pas 120
  assert.equal(new Set(draw.flat()).size, 16);                     // chaque forme une seule fois
  assert.deepEqual(remainingPairs(sixteen, [], 'me', { allowOwn: true }), draw); // tirage stable d'un chargement à l'autre
  assert.notDeepEqual(remainingPairs(sixteen, [], 'christelle', { allowOwn: true }), draw); // tirage propre à chaque votant
  // après un vote, les deux formes du duel ne reviennent plus jamais (gagnante comme perdante)
  const [x0, y0] = draw[0];
  const after = remainingPairs(sixteen, [{ voter_id: 'me', a: x0, b: y0, winner: x0 }], 'me', { allowOwn: true });
  assert.equal(after.length, 7);
  assert.ok(after.every(([x, y]) => ![x0, y0].includes(x) && ![x0, y0].includes(y)));
  // hors test, jamais sa propre forme ; nombre impair → une forme ne joue pas
  const sh = mk(4, (i) => (i === 3 ? 'me' : `p${i}`));
  const pairs = remainingPairs(sh, [], 'me');
  assert.equal(pairs.length, 1);
  assert.ok(pairs.every(([x, y]) => x !== 'S03' && y !== 'S03'));
  // % = victoires ÷ duels
  const votes: Vote[] = [
    { voter_id: 'x', a: 'A', b: 'B', winner: 'A' }, { voter_id: 'y', a: 'A', b: 'C', winner: 'A' },
    { voter_id: 'z', a: 'A', b: 'B', winner: 'B' }, { voter_id: 'x', a: 'B', b: 'C', winner: 'C' },
  ];
  const r = battleResults(['A', 'B', 'C'].map((id) => ({ id, participant_id: id, path: 'M0 0L1 1', km: 0, label: '' })), votes);
  assert.deepEqual(r.map((x) => [x.shape.id, x.wins, x.duels]), [['A', 2, 3], ['C', 1, 2], ['B', 1, 3]]); // C (50 %) passe devant B (33 %)
  assert.equal(Math.round(r[0].pct * 100), 67);
  assert.equal(r[1].pct, 0.5);
});

test('On vient à pied Days : ×3 sur la marche et la rando seulement', () => {
  const b: Boost[] = [{ id: 2, name: 'On vient à pied Days', starts_at: '2026-11-05T00:00:00', ends_at: '2026-11-05T23:59:59', multiplier: 3, slot: 'Tous', sport_types: ['Walk', 'Hike'] }];
  const s = scoreActivities([
    act('a', '2026-11-05T08:30:00', 3, 'Walk'),   // marche → ×3
    act('b', '2026-11-05T12:00:00', 4, 'Hike'),   // rando → ×3
    act('c', '2026-11-05T19:00:00', 5, 'Run'),    // course → compte normalement, sans ×3
    act('d', '2026-11-06T08:30:00', 3, 'Walk'),   // lendemain → ×1
  ], settings, b);
  assert.deepEqual(s.map((x) => x.multiplier), [3, 3, 1, 1]);
  assert.deepEqual(s.map((x) => x.countedKm), [9, 12, 5, 3]);
});

test('nom de la forme et variantes du tag', async () => {
  const { shapeLabel } = await import('../lib/polyline.ts');
  assert.equal(shapeLabel('#TRACEZ (Cœur de Colorz)'), 'Cœur de Colorz');
  assert.equal(shapeLabel('Licorne #TRACEZ'), ''); // sans parenthèses : pas de nom affiché
  assert.equal(shapeLabel('#tracé (Étoile)'), 'Étoile');
  assert.equal(shapeLabel('#TRACEZ'), '');
  for (const t of ['#TRACEZ (Cœur)', '#tracez', '# Tracé (Z)', '#TRACE (Chat)']) assert.ok(hasTraceTag(t) && tagMatch('#TRACEZ', t), t);
  for (const t of ['Footing', '#tracer la route', 'Mon parcours']) assert.ok(!tagMatch('#TRACEZ', t), t);
});

test('vitesse suspecte et exclusion manuelle', () => {
  const fast = { ...act('v', '2026-11-03T10:00:00', 10), moving_time_s: 300 };            // 10 km en 5 min = 120 km/h
  const okRun = { ...act('v', '2026-11-04T10:00:00', 10), moving_time_s: 3000 };          // 12 km/h
  const fastWalk = { ...act('v', '2026-11-05T10:00:00', 6, 'Walk'), moving_time_s: 1500 }; // 14,4 km/h en marche
  const validated = { ...fast, id: 'val', speed_ok: true };
  const excluded = { ...okRun, id: 'exc', excluded: true };
  assert.equal(speedSuspect(fast), true);
  assert.equal(speedSuspect(okRun), false);
  assert.equal(speedSuspect(fastWalk), true);
  const s = scoreActivities([fast, okRun, fastWalk, validated, excluded], settings, []);
  const by = (id: string) => s.find((x) => x.id === id)!;
  assert.equal(by(fast.id).eligible, false);
  assert.match(by(fast.id).reason!, /Vitesse suspecte \(120 km\/h\)/);
  assert.equal(by(okRun.id).eligible, true);
  assert.equal(by(fastWalk.id).eligible, false);
  assert.equal(by('val').eligible, true);   // validée par un admin
  assert.equal(by('exc').eligible, false);  // exclue, même si tout est normal
  assert.equal(by('exc').reason, 'Exclue par l’organisation');
});

test('Tracé GPS automatique : titre avec #TRACEZ, tracé sans ligne droite, une forme par personne (la plus longue)', () => {
  const enc = (pts: [number, number][]) => { let out = '', pl = 0, pg = 0; const e = (v: number) => { v = v < 0 ? ~(v << 1) : v << 1; let s = ''; while (v >= 0x20) { s += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; } return s + String.fromCharCode(v + 63); };
    for (const [la, lo] of pts) { const a = Math.round(la * 1e5), b = Math.round(lo * 1e5); out += e(a - pl) + e(b - pg); pl = a; pg = b; } return out; };
  const walk = enc(Array.from({ length: 40 }, (_, i) => [48.85 + i * 0.001, 2.35] as [number, number]));          // points tous les ~110 m
  const metro = enc([[48.85, 2.35], [48.851, 2.35], [48.875, 2.35], [48.876, 2.35]]);                           // ligne droite de ~2,7 km
  assert.ok(longestGapM(walk) < 200 && longestGapM(metro) > 2500);
  assert.equal(strictShapeName('Sortie #TRACEZ (Cœur)'), true);
  assert.equal(strictShapeName('#tracé(étoile)'), true);
  assert.equal(strictShapeName('Sortie #TRACEZ'), false);
  assert.equal(strictShapeName('#TRACEZ ()'), false);
  const tb: Boost = { id: 7, name: 'Tracé GPS', starts_at: '2026-11-07T00:00:00', ends_at: '2026-11-08T23:59:59', multiplier: 4, tag: '#TRACEZ', manual: false };
  const shape = (pid: string, when: string, km: number, name: string, polyline: string | null, extra: Partial<Activity> = {}): Activity =>
    ({ ...act(pid, when, km, 'Walk'), name, polyline, has_track: true, moving_time_s: km * 600, ...extra });
  const acts = [
    shape('t1', '2026-11-07T10:00:00', 6, 'Matin #TRACEZ (Cœur)', walk),
    shape('t1', '2026-11-08T10:00:00', 8, 'Dimanche #TRACEZ (Étoile)', walk),            // plus longue : retenue
    shape('t2', '2026-11-07T10:00:00', 2.64, 'Colorz Runz Challenge Stravart #TRACEZ', walk), // sans (forme) : ×4 quand même
    shape('t3', '2026-11-07T10:00:00', 4, 'Métro #TRACEZ (Escargot)', metro),             // ligne droite → à valider
    shape('t4', '2026-11-07T10:00:00', 9, 'Vélo #TRACEZ (Z)', walk, { moving_time_s: 900 }), // 36 km/h → ne compte pas
    shape('t5', '2026-11-07T10:00:00', 5, 'Choix admin #TRACEZ (Lune)', metro, { validated_boosts: [7] }),
  ];
  const s = scoreActivities(acts, settings, [tb]);
  const by = (name: string) => s.find((x) => x.name?.startsWith(name))!;
  assert.equal(by('Dimanche').multiplier, 4); assert.equal(by('Dimanche').tagWinner, 7);
  assert.equal(by('Matin').multiplier, 1);
  assert.equal(by('Colorz').multiplier, 4); assert.equal(by('Colorz').countedKm, 10.56);
  assert.equal(by('Métro').multiplier, 1); assert.equal(by('Métro').pendingBoosts[0]?.id, 7);
  assert.equal(by('Vélo').eligible, false); assert.equal(by('Vélo').multiplier, 1);
  assert.equal(by('Choix admin').multiplier, 4);
  // une forme retenue exclue : la suivante prend le relais automatiquement
  const s2 = scoreActivities(acts.map((a) => (a.name?.startsWith('Dimanche') ? { ...a, excluded: true } : a)), settings, [tb]);
  assert.equal(s2.find((x) => x.name?.startsWith('Matin'))!.multiplier, 4);
});
