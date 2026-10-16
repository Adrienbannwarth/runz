// Calcul des points RunZ. Fonctions pures (aucun accès base), testées dans tests/scoring.test.ts.
//
// Règles appliquées :
// 1. Seules les activités dont le sport_type est autorisé et dont la date locale est
//    comprise entre start_date et end_date (incluses) comptent.
// 2. Plafond journalier : si une personne dépasse daily_cap_km sur une journée, chaque
//    activité du jour est réduite au prorata pour que le total brut = plafond.
// 3. Multiplicateurs : une activité reçoit le plus grand multiplicateur qui s'applique
//    à son heure de départ (boosts horaires, sprint final le dernier jour). Ils ne se cumulent pas.
// 4. Score d'équipe = (km comptés des membres + bonus de l'équipe) / nombre de membres.

export type Settings = {
  start_date: string; // YYYY-MM-DD
  end_date: string;
  daily_cap_km: number;
  sprint_multiplier: number;
  sport_types: string[];
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
};
export type Boost = { id: number; name: string; starts_at: string; ends_at: string; multiplier: number };
export type Bonus = { id: number; team_id: number; participant_id: string | null; km: number; reason: string; awarded_on: string };

export type ScoredActivity = Activity & {
  eligible: boolean;
  reason?: string;
  day: string;
  rawKm: number;
  cappedKm: number;
  multiplier: number;
  boostName?: string;
  countedKm: number;
};

export type ParticipantStats = {
  participant: Participant;
  activities: number;
  rawKm: number;      // km éligibles avant plafond
  countedKm: number;  // km après plafond et multiplicateurs
  activeDays: number;
  elevationM: number;
  earlyKm: number;    // km démarrés avant 8 h
  todayKm: number;
};

export type TeamStats = {
  team: Team;
  members: number;
  countedKm: number;
  bonusKm: number;
  totalKm: number;
  avgKm: number;      // score de classement
  todayKm: number;
  rank: number;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Normalise un timestamp local ("2026-11-02 18:30:00", "2026-11-02T18:30:00Z"...) en "YYYY-MM-DDTHH:MM:SS". */
export function normLocal(ts: string): string {
  const s = ts.trim().replace(' ', 'T').replace(/(Z|[+-]\d\d:?\d\d)$/, '');
  const [date, time = '00:00:00'] = s.split('T');
  const t = time.split('.')[0];
  return `${date}T${t.length === 5 ? t + ':00' : t.length === 2 ? t + ':00:00' : t}`.slice(0, 19);
}

export function scoreActivities(acts: Activity[], settings: Settings, boosts: Boost[]): ScoredActivity[] {
  const allowed = new Set(settings.sport_types);
  const scored: ScoredActivity[] = acts.map((a) => {
    const local = normLocal(a.start_date_local);
    const day = local.slice(0, 10);
    const rawKm = Number(a.distance_m) / 1000;
    let eligible = true;
    let reason: string | undefined;
    if (!allowed.has(a.sport_type)) { eligible = false; reason = `Type « ${a.sport_type} » non comptabilisé`; }
    else if (day < settings.start_date || day > settings.end_date) { eligible = false; reason = 'Hors période du challenge'; }

    let multiplier = 1;
    let boostName: string | undefined;
    if (eligible) {
      for (const b of boosts) {
        if (local >= normLocal(b.starts_at) && local < normLocal(b.ends_at) && Number(b.multiplier) > multiplier) {
          multiplier = Number(b.multiplier); boostName = b.name;
        }
      }
      if (day === settings.end_date && Number(settings.sprint_multiplier) > multiplier) {
        multiplier = Number(settings.sprint_multiplier); boostName = 'Sprint final';
      }
    }
    return { ...a, start_date_local: local, eligible, reason, day, rawKm, cappedKm: 0, multiplier, boostName, countedKm: 0 };
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
  for (const list of byDay.values()) {
    const total = list.reduce((t, s) => t + s.rawKm, 0);
    const factor = cap > 0 && total > cap ? cap / total : 1;
    for (const s of list) {
      s.cappedKm = s.rawKm * factor;
      s.countedKm = s.cappedKm * s.multiplier;
    }
  }
  return scored;
}

export function computeStandings(input: {
  settings: Settings; teams: Team[]; participants: Participant[];
  activities: Activity[]; boosts: Boost[]; bonuses: Bonus[]; today: string;
}) {
  const { settings, teams, participants, activities, boosts, bonuses, today } = input;
  const scored = scoreActivities(activities, settings, boosts);

  const people: ParticipantStats[] = participants.map((p) => {
    const mine = scored.filter((s) => s.participant_id === p.id && s.eligible);
    return {
      participant: p,
      activities: mine.length,
      rawKm: r2(mine.reduce((t, s) => t + s.rawKm, 0)),
      countedKm: r2(mine.reduce((t, s) => t + s.countedKm, 0)),
      activeDays: new Set(mine.map((s) => s.day)).size,
      elevationM: Math.round(mine.reduce((t, s) => t + Number(s.elevation_gain_m ?? 0), 0)),
      earlyKm: r2(mine.filter((s) => s.start_date_local.slice(11, 13) < '08').reduce((t, s) => t + s.cappedKm, 0)),
      todayKm: r2(mine.filter((s) => s.day === today).reduce((t, s) => t + s.countedKm, 0)),
    };
  });

  const teamStats: TeamStats[] = teams.filter((t) => t.active).map((team) => {
    const members = people.filter((p) => p.participant.team_id === team.id);
    const countedKm = members.reduce((t, p) => t + p.countedKm, 0);
    const bonusKm = bonuses.filter((b) => b.team_id === team.id).reduce((t, b) => t + Number(b.km), 0);
    const totalKm = countedKm + bonusKm;
    const todayBonus = bonuses.filter((b) => b.team_id === team.id && b.awarded_on === today).reduce((t, b) => t + Number(b.km), 0);
    return {
      team, members: members.length,
      countedKm: r2(countedKm), bonusKm: r2(bonusKm), totalKm: r2(totalKm),
      avgKm: members.length ? r2(totalKm / members.length) : 0,
      todayKm: r2(members.reduce((t, p) => t + p.todayKm, 0) + todayBonus),
      rank: 0,
    };
  });
  teamStats.sort((a, b) => b.avgKm - a.avgKm);
  teamStats.forEach((t, i) => { t.rank = i > 0 && t.avgKm === teamStats[i - 1].avgKm ? teamStats[i - 1].rank : i + 1; });

  return { scored, people, teams: teamStats };
}
