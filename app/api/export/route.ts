import { NextRequest, NextResponse } from 'next/server';
import { loadAll } from '@/lib/data';
import { isAdmin } from '@/lib/session';

export const dynamic = 'force-dynamic';

// Export des données au format de l'onglet « Saisie km » de RunZ-Suivi.xlsx (sauvegarde / reprise à la main).
// - admin connecté : téléchargement CSV (s'ouvre dans Excel)
// - script de sauvegarde : ?format=json avec « Authorization: Bearer CRON_SECRET »
const ACTIVITE: Record<string, string> = { Walk: 'Marche', Run: 'Course', TrailRun: 'Trail', Hike: 'Randonnée', VirtualRun: 'Tapis de course' };

export async function GET(req: NextRequest) {
  const bearer = req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}` && !!process.env.CRON_SECRET;
  if (!bearer && !(await isAdmin())) return new NextResponse('Unauthorized', { status: 401 });

  const d = await loadAll();
  const name = (id: string | null) => d.participants.find((p) => p.id === id)?.display_name ?? '';
  const teamOf = (pid: string) => d.teamList.find((t) => t.id === d.participants.find((p) => p.id === pid)?.team_id)?.name ?? '';
  const boostName = (id: number) => d.boosts.find((b) => Number(b.id) === id)?.name ?? `boost ${id}`;

  const rows = d.scored
    .filter((a) => a.eligible)
    .sort((a, b) => a.start_date_local.localeCompare(b.start_date_local))
    .map((a) => {
      const notes = [
        a.source === 'strava' ? `Strava ${a.strava_activity_id}` : 'Saisie admin',
        a.start_date_local.slice(11, 16),
        a.flag && `⚠ ${a.flag}`,
        ...(a.validated_boosts ?? []).map((id) => `${boostName(Number(id))} validé`),
        ...a.pendingBoosts.map((x) => `${x.name} à valider`),
      ].filter(Boolean);
      return {
        date: a.day,
        participant: name(a.participant_id),
        equipe: teamOf(a.participant_id),
        activite: ACTIVITE[a.sport_type] ?? a.sport_type,
        km: Math.round(a.rawKm * 100) / 100,
        creneau: a.slot,
        dplus: a.elevation_gain_m == null ? null : Math.round(Number(a.elevation_gain_m)),
        justificatif: a.source === 'strava' ? 'Strava' : 'Capture',
        multiplicateur_site: a.multiplier,
        km_comptes_site: Math.round(a.countedKm * 100) / 100,
        commentaire: notes.join(' · '),
      };
    });
  const bonuses = d.bonuses.map((b) => ({
    date: b.awarded_on,
    equipe: d.teamList.find((t) => t.id === b.team_id)?.name ?? '',
    boost: b.reason,
    km: Number(b.km),
    justification: [name(b.participant_id), b.reason].filter(Boolean).join(' · '),
  }));

  if (req.nextUrl.searchParams.get('format') === 'json') {
    return NextResponse.json({
      generated_at: new Date().toISOString(),
      settings: { start_date: d.settings.start_date, end_date: d.settings.end_date },
      rows, bonuses,
      standings: d.teams.map((t) => ({ equipe: t.team.name, total_km: t.totalKm, rang: t.rank })),
    });
  }

  // CSV pour Excel FR : séparateur « ; », virgule décimale, BOM UTF-8
  const cell = (v: unknown) => {
    if (v == null) return '';
    const s = typeof v === 'number' ? String(v).replace('.', ',') : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const fr = (iso: string) => iso.split('-').reverse().join('/');
  const lines = [
    ['Date', 'Participant', 'Équipe', 'Activité', 'Km', 'Créneau', 'D+ (m)', 'Justificatif', 'Multiplicateur (site)', 'Km comptés (site)', 'Commentaire'],
    ...rows.map((r) => [fr(r.date), r.participant, r.equipe, r.activite, r.km, r.creneau, r.dplus, r.justificatif, r.multiplicateur_site, r.km_comptes_site, r.commentaire]),
    [],
    ['Bonus km'],
    ['Date', 'Équipe', 'Bonus', 'Km bonus', 'Justification'],
    ...bonuses.map((b) => [fr(b.date), b.equipe, b.boost, b.km, b.justification]),
  ];
  const csv = '﻿' + lines.map((l) => l.map(cell).join(';')).join('\r\n');
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="runz-saisie-km-${d.today}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
