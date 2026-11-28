import { notFound, redirect } from 'next/navigation';
import SeasonEnd from '../../SeasonEnd';
import { loadAll, nowParis } from '@/lib/data';
import { rewindPublic } from '@/lib/rewind';
import { getParticipantId } from '@/lib/session';
import { currentSeasonId } from '@/lib/seasons';

export const dynamic = 'force-dynamic';

/** Récap d'une saison terminée. RunZ (saison 1) : l'écran de fin, avec le classement et le Rewind à partir de l'heure des résultats. */
export default async function SeasonPage({ params }: { params: Promise<{ n: string }> }) {
  const n = Number((await params).n);
  if (n !== 1) notFound();
  if ((await currentSeasonId()) === 1) redirect('/'); // tant que RunZ est la saison en cours, son récap est sur l'accueil
  const [data, pid] = await Promise.all([loadAll(), getParticipantId()]);
  const me = pid ? data.participants.find((p) => p.id === pid) : undefined;
  const ok = data.scored.filter((x) => x.eligible);
  return (
    <SeasonEnd teams={data.teams} km={data.teams.reduce((t, x) => t + x.totalKm, 0)} activities={ok.length}
      people={new Set(data.activities.map((a) => a.participant_id)).size}
      elevation={ok.reduce((t, x) => t + Number(x.elevation_gain_m ?? 0), 0)}
      results={rewindPublic(nowParis())} loggedIn={!!me} myTeamId={me?.team_id} admin={false} />
  );
}
