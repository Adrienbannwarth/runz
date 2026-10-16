import { db, must } from '@/lib/db';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function Join({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const p = must(await db().from('participants').select('display_name, strava_athlete_id, teams(name, emoji)')
    .eq('invite_token', token).maybeSingle()) as { display_name: string; strava_athlete_id: number | null; teams: { name: string; emoji: string } | null } | null;
  if (!p) notFound();
  return (
    <>
      <h1>Bienvenue {p.display_name} 👋</h1>
      {p.teams && <p>Tu cours avec les <b>{p.teams.emoji} {p.teams.name}</b>.</p>}
      <div className="card">
        <p style={{ marginTop: 0 }}>
          Connecte ton compte Strava pour que tes km remontent automatiquement dans le score de ton équipe.
          Seules la distance, la durée, le dénivelé et l’heure de départ de tes activités sont utilisées.
        </p>
        <a className="btn strava" href={`/api/strava/connect?invite=${token}`}>
          {p.strava_athlete_id ? 'Reconnecter Strava' : 'Se connecter avec Strava'}
        </a>
      </div>
    </>
  );
}
