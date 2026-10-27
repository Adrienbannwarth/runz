// Calcul des points RunZ, aligné sur le fichier de suivi RunZ-Suivi.xlsx (onglets Saisie km, Boost, Classement, MVP).
// Fonctions pures (aucun accès base), testées dans tests/scoring.test.ts.
//
// Règles :
// 1. Comptent les activités dont le sport_type est autorisé et dont la date locale est
//    entre start_date et end_date (incluses).
// 2. Créneau déduit de l'heure de départ : « Avant 8h » (< 8 h), « 12h-14h », « 19h-22h », sinon « Autre ».
// 3. Boost multiplicateur : s'applique si la date de l'activité est dans la période du boost et que le
//    créneau correspond (ou boost « Tous »). Plusieurs boosts : le plus fort s'applique (MAX, comme l'Excel).
//    Un boost peut aussi avoir un horaire perso (from_time → to_time, ex. 18h30-22h) appliqué chaque jour.
//    Boost « à valider » (manual) : ne s'applique qu'aux activités validées par un admin (validated_boosts).
// 4. Plafond journalier : en mode « alert » (Excel), les km comptent tous et la journée est signalée
//    « Plafond dépassé » ; en mode « cap », seuls `daily_cap_km` km réels comptent, en gardant d'abord
//    les km les plus boostés (puis les premiers de la journée) ; le reste ne compte pas.
// 5. Équipe : total = km réels + km gagnés via multiplicateurs + km bonus. Classement au « total »
//    ou à la « moyenne » par personne (réglage).

export type Slot = 'Avant 8h' | '12h-14h' | '19h-22h' | 'Autre';
export type BoostSlot = Slot | 'Tous';

export type Settings = {
  start_date: string; // YYYY-MM-DD
  end_date: string;
  daily_cap_km: number;
  sprint_multiplier: number;           // ancien réglage, 1 = désactivé (le Sprint final est un boost)
  sport_types: string[];
  ranking_mode?: 'total' | 'average';  // défaut : total
  cap_mode?: 'alert' | 'cap';          // défaut : alert
};
export type Team = { id: number; name: string; color: string; emoji: string; active: boolean };
export type Participant = { id: string; display_name: string; team_id: number | null };
export type Activity = {
  id: string;
  participant_id: string;
  source: 'strava' | 'manual';
  strava_activity_id: number | null;
  name: string | null;
  sport_type: string;
  start_date_local: string; // "YYYY-MM-DDTHH:MM:SS" (heure locale, sans fuseau)
  distance_m: number;
  moving_time_s: number | null;
  elevation_gain_m: number | null;
  strava_manual?: boolean | null;
  trainer?: boolean | null;
  has_track?: boolean | null;
  validated_boosts?: number[] | null; // boosts « à valider » accordés par un admin
};
export type Boost = { id: number; name: string; starts_at: string; ends_at: string; multiplier: number; slot?: BoostSlot | null; manual?: boolean | null;
  from_time?: string | null; to_time?: string | null; // horaire quotidien perso (ex. 18:30 → 22:00), prioritaire sur le créneau
};
export type Bonus = { id: number; team_id: number; participant_id: string | null; km: number; reason: string; awarded_on: string };

export type ScoredActivity = Activity & {
  eligible: boolean;
  reason?: string;
  day: string;
  week: number;
  slot: Slot;
  rawKm: number;
  cappedKm: number;
  multiplier: number;
  boostName?: string;
  pendingBoosts: { id: number; name: string; multiplier: number }[]; // boosts « à valider » possibles, pas encore validés
  countedKm: number;
  overCap: boolean;   // la journée de cette personne dépasse le plafond
  flag?: string;      // à vérifier par les admins (compte quand même)
};

/** Activité Strava à vérifier : saisie à la main dans Strava, ou sans tracé GPS (hors tapis / home trainer). */
export function flagOf(a: Activity): string | undefined {
  if (a.source !== 'strava') return undefined;
  if (a.strava_manual) return 'Saisie manuelle dans Strava (sans tracé)';
  const indoor = a.trainer || a.sport_type === 'VirtualRun';
  if (a.has_track === false && !indoor) return 'Aucun tracé GPS';
  return undefined;
}

export type ParticipantStats = {
  participant: Participant;
  activities: number;
  rawKm: number;       // km réels éligibles
  cappedKm: number;    // km réels retenus après plafond (= rawKm en mode alerte)
  countedKm: number;   // km comptés (multiplicateurs, plafond si mode cap)
  activeDays: number;
  longestKm: number;   // plus longue sortie
  elevationM: number;
  earlyKm: number;     // km « Avant 8h »
  lunchKm: number;     // km « 12h-14h »
  flashKm: number;     // km « 19h-22h » sous multiplicateur
  week1Km: number;
  currentWeekKm: number;
  progressKm: number;  // semaine en cours − semaine 1
  activeThisWeek: boolean; // ≥ 1 km cette semaine
  todayKm: number;
  overCapDays: string[];
};

export type TeamStats = {
  team: Team;
  members: number;
  realKm: number;
  multiplierKm: number; // km gagnés via multiplicateurs
  countedKm: number;    // réels + multiplicateurs
  bonusKm: number;
  totalKm: number;
  avgKm: number;
  score: number;        // valeur de tri selon ranking_mode
  todayKm: number;
  notYetThisWeek: number;
  rank: number;
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const dayMs = 86400000;

/** Normalise un timestamp local ("2026-11-02 18:30:00", "2026-11-02T18:30:00Z"...) en "YYYY-MM-DDTHH:MM:SS". */
export function normLocal(ts: string): string {
  const s = ts.trim().replace(' ', 'T').replace(/(Z|[+-]\d\d:?\d\d)$/, '');
  const [date, time = '00:00:00'] = s.split('T');
  const t = time.split('.')[0];
  return `${date}T${t.length === 5 ? t + ':00' : t.length === 2 ? t + ':00:00' : t}`.slice(0, 19);
}

export function slotOf(local: string): Slot {
  const h = Number(local.slice(11, 13));
  if (h < 8) return 'Avant 8h';
  if (h >= 12 && h < 14) return '12h-14h';
  if (h >= 19 && h < 22) return '19h-22h';
  return 'Autre';
}

/** Numéro de semaine du challenge (1 = première semaine), comme Paramètres!B7. */
export function weekOf(day: string, startDate: string): number {
  const d = (Date.parse(`${day}T12:00:00Z`) - Date.parse(`${startDate}T12:00:00Z`)) / dayMs;
  return Math.max(1, Math.floor(d / 7) + 1);
}

function boostApplies(b: Boost, local: string, slot: Slot) {
  const day = local.slice(0, 10);
  const from = normLocal(b.starts_at).slice(0, 10);
  const to = normLocal(b.ends_at).slice(0, 10);
  if (day < from || day > to) return false;
  if (b.from_time && b.to_time) {
    // horaire perso, chaque jour de la période, d'après l'heure de départ de l'activité
    const t = local.slice(11, 16);
    return t >= b.from_time.slice(0, 5) && t < b.to_time.slice(0, 5);
  }
  const bs = b.slot || 'Tous';
  if (bs === 'Tous') {
    // compatibilité : un boost « Tous » limité à une fenêtre horaire le même jour (ex. ancien Flash HourZ)
    const s = normLocal(b.starts_at), e = normLocal(b.ends_at);
    const hasHours = s.slice(11) !== '00:00:00' || !['00:00:00', '23:59:59'].includes(e.slice(11));
    return hasHours ? local >= s && local < e : true;
  }
  return bs === slot;
}

export function scoreActivities(acts: Activity[], settings: Settings, boosts: Boost[]): ScoredActivity[] {
  const allowed = new Set(settings.sport_types);
  const scored: ScoredActivity[] = acts.map((a) => {
    const local = normLocal(a.start_date_local);
    const day = local.slice(0, 10);
    const slot = slotOf(local);
    const rawKm = Number(a.distance_m) / 1000;
    let eligible = true;
    let reason: string | undefined;
    if (!allowed.has(a.sport_type)) { eligible = false; reason = `Type « ${a.sport_type} » non comptabilisé`; }
    else if (day < settings.start_date || day > settings.end_date) { eligible = false; reason = 'Hors période du challenge'; }

    let multiplier = 1;
    let boostName: string | undefined;
    const pendingBoosts: ScoredActivity['pendingBoosts'] = [];
    if (eligible) {
      const validated = new Set((a.validated_boosts ?? []).map(Number));
      for (const b of boosts) {
        if (!boostApplies(b, local, slot)) continue;
        if (b.manual && !validated.has(Number(b.id))) {
          pendingBoosts.push({ id: Number(b.id), name: b.name, multiplier: Number(b.multiplier) });
          continue;
        }
        if (Number(b.multiplier) > multiplier) { multiplier = Number(b.multiplier); boostName = b.name; }
      }
      if (day === settings.end_date && Number(settings.sprint_multiplier) > multiplier) {
        multiplier = Number(settings.sprint_multiplier); boostName = 'Sprint final';
      }
    }
    return {
      ...a, start_date_local: local, eligible, reason, day, week: weekOf(day, settings.start_date), slot,
      rawKm, cappedKm: eligible ? rawKm : 0, multiplier, boostName, pendingBoosts, countedKm: 0, overCap: false, flag: flagOf(a),
    };
  });

  // Plafond journalier par personne
  const byDay = new Map<string, ScoredActivity[]>();
  for (const s of scored) {
    if (!s.eligible) continue;
    const k = `${s.participant_id}|${s.day}`;
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(s);
  }
  const cap = Number(settings.daily_cap_km);
  const capMode = settings.cap_mode ?? 'alert';
  for (const list of byDay.values()) {
    const total = list.reduce((t, s) => t + s.rawKm, 0);
    const over = cap > 0 && total > cap;
    for (const s of list) { s.overCap = over; s.cappedKm = s.rawKm; }
    if (over && capMode === 'cap') {
      // On garde les km qui rapportent le plus (multiplicateur le plus fort d'abord, puis ordre chronologique)
      // jusqu'à `cap` km réels ; le reste de la journée ne compte pas.
      let left = cap;
      const order = [...list].sort((a, b) => b.multiplier - a.multiplier || a.start_date_local.localeCompare(b.start_date_local));
      for (const s of order) { s.cappedKm = Math.min(s.rawKm, left); left -= s.cappedKm; }
    }
    for (const s of list) s.countedKm = s.cappedKm * s.multiplier;
  }
  return scored;
}

export function computeStandings(input: {
  settings: Settings; teams: Team[]; participants: Participant[];
  activities: Activity[]; boosts: Boost[]; bonuses: Bonus[]; today: string;
}) {
  const { settings, teams, participants, activities, boosts, bonuses, today } = input;
  const scored = scoreActivities(activities, settings, boosts);
  const currentWeek = weekOf(today, settings.start_date);
  const sum = (l: ScoredActivity[], f: (s: ScoredActivity) => number) => r2(l.reduce((t, s) => t + f(s), 0));

  const people: ParticipantStats[] = participants.map((p) => {
    const mine = scored.filter((s) => s.participant_id === p.id && s.eligible);
    const week1Km = sum(mine.filter((s) => s.week === 1), (s) => s.rawKm);
    const currentWeekKm = sum(mine.filter((s) => s.week === currentWeek), (s) => s.rawKm);
    return {
      participant: p,
      activities: mine.length,
      rawKm: sum(mine, (s) => s.rawKm),
      cappedKm: sum(mine, (s) => s.cappedKm),
      countedKm: sum(mine, (s) => s.countedKm),
      activeDays: new Set(mine.map((s) => s.day)).size,
      longestKm: r2(Math.max(0, ...mine.map((s) => s.rawKm))),
      elevationM: Math.round(mine.reduce((t, s) => t + Number(s.elevation_gain_m ?? 0), 0)),
      earlyKm: sum(mine.filter((s) => s.slot === 'Avant 8h'), (s) => s.rawKm),
      lunchKm: sum(mine.filter((s) => s.slot === '12h-14h'), (s) => s.rawKm),
      flashKm: sum(mine.filter((s) => s.slot === '19h-22h' && s.multiplier > 1), (s) => s.rawKm),
      week1Km, currentWeekKm, progressKm: r2(currentWeekKm - week1Km),
      activeThisWeek: currentWeekKm >= 1,
      todayKm: sum(mine.filter((s) => s.day === today), (s) => s.countedKm),
      overCapDays: [...new Set(mine.filter((s) => s.overCap).map((s) => s.day))].sort(),
    };
  });

  const mode = settings.ranking_mode ?? 'total';
  const teamStats: TeamStats[] = teams.filter((t) => t.active).map((team) => {
    const members = people.filter((p) => p.participant.team_id === team.id);
    const realKm = members.reduce((t, p) => t + p.cappedKm, 0); // km réels retenus (plafond appliqué)
    const countedKm = members.reduce((t, p) => t + p.countedKm, 0);
    const bonusKm = bonuses.filter((b) => b.team_id === team.id).reduce((t, b) => t + Number(b.km), 0);
    const totalKm = countedKm + bonusKm;
    const avgKm = members.length ? totalKm / members.length : 0;
    const todayBonus = bonuses.filter((b) => b.team_id === team.id && b.awarded_on === today).reduce((t, b) => t + Number(b.km), 0);
    return {
      team, members: members.length,
      realKm: r2(realKm), multiplierKm: r2(countedKm - realKm), countedKm: r2(countedKm),
      bonusKm: r2(bonusKm), totalKm: r2(totalKm), avgKm: r2(avgKm),
      score: r2(mode === 'average' ? avgKm : totalKm),
      todayKm: r2(members.reduce((t, p) => t + p.todayKm, 0) + todayBonus),
      notYetThisWeek: members.filter((p) => !p.activeThisWeek).length,
      rank: 0,
    };
  });
  teamStats.sort((a, b) => b.score - a.score);
  teamStats.forEach((t, i) => { t.rank = i > 0 && t.score === teamStats[i - 1].score ? teamStats[i - 1].rank : i + 1; });

  return { scored, people, teams: teamStats, currentWeek, mode };
}

/** Phrase du titre du récap (Classement!B22). */
export function leadSentence(teams: TeamStats[], mode: 'total' | 'average') {
  if (teams.length < 2) return '';
  const gap = teams[0].score - teams[1].score;
  if (gap < 0.05) return 'Égalité parfaite en tête !';
  const km = gap.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const n = teams[0].team.name;
  const who = /^team /i.test(n) ? `La ${n} mène` : `Les ${n} mènent`;
  return `${who} de ${km} km${mode === 'total' ? '' : ' par personne'}.`;
}
