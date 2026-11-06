import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadAll } from '@/lib/data';
import { battleBoost, battleResults, battleShapes, loadVotes } from '@/lib/battle';
import { db } from '@/lib/db';
import { REWIND_PUBLIC, buildRewind } from '@/lib/rewind';
import { getParticipantId, isAdmin } from '@/lib/session';
import { fetchTracks } from '@/lib/strava';
import RewindStories from './RewindStories';

export const dynamic = 'force-dynamic';

export default async function RewindPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const admin = await isAdmin();
  if (!REWIND_PUBLIC && !admin) notFound();
  const myId = await getParticipantId();
  if (!myId && !admin) {
    return (
      <>
        <h1>Ton RunZ Rewind</h1>
        <div className="card"><p style={{ marginTop: 0 }}>Connecte-toi avec Strava pour voir ton Rewind.</p>
          <a className="btn strava" href="/api/strava/connect">Se connecter avec Strava</a></div>
      </>
    );
  }

  const data = await loadAll();
  // Les admins peuvent prévisualiser le Rewind de n'importe quel participant (?p=)
  const pid = (admin && sp.p) || myId || data.participants[0]?.id;
  const person = data.participants.find((p) => p.id === pid);
  if (!person) notFound();

  const bBoost = battleBoost(data.boosts);
  const shapes = bBoost ? battleShapes(bBoost, data.scored) : [];
  const votes = shapes.length > 1 ? await loadVotes() : [];
  const battle = votes.length ? battleResults(shapes, votes).map((r, i) => ({ activityId: r.shape.id, wins: r.wins, duels: r.duels, rank: i + 1 })) : [];

  // Photo de profil Strava (colonne ajoutée par la migration 021 ; absente = initiale)
  const avatar = await db().from('participants').select('avatar_url').eq('id', person.id).maybeSingle()
    .then((r) => (r.error ? null : (r.data as { avatar_url?: string | null } | null)?.avatar_url ?? null), () => null);

  // Tracés de ses sorties, lus chez Strava au moment de l'affichage (jamais enregistrés)
  const tracks = person.strava_athlete_id
    ? await fetchTracks(person.id, data.settings.start_date, data.settings.end_date).catch((e) => { console.error('Rewind : tracés', e); return []; })
    : [];

  const rewind = buildRewind({
    participantId: person.id, name: person.display_name, teamId: person.team_id,
    scored: data.scored, teams: data.teams, boosts: data.boosts,
    counted: data.people.map((p) => ({ participantId: p.participant.id, teamId: p.participant.team_id, km: p.countedKm })),
    start: data.settings.start_date, end: data.settings.end_date, today: data.today,
    cap: Number(data.settings.daily_cap_km) || 10, battle, avatar,
    tracks,
    gallery: shapes.map((x) => ({ participantId: x.participant_id, path: x.path, label: x.label, km: x.km })),
  });

  return (
    <>
      {!REWIND_PUBLIC && (
        <div className="alert">
          Aperçu admin : le Rewind n’est visible que par les admins. Pour l’ouvrir à tous, passer <code>REWIND_PUBLIC</code> à <code>true</code> dans <code>lib/rewind.ts</code>.
        </div>
      )}
      {admin && (
        <form className="rewind-pick" method="get">
          <label className="muted small" htmlFor="p">Voir le Rewind de</label>
          <select id="p" name="p" defaultValue={person.id}>
            {data.participants.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
          </select>
          <button className="btn">Afficher</button>
        </form>
      )}
      <RewindStories r={rewind} key={person.id} />
      <p className="muted small" style={{ textAlign: 'center' }}>
        {rewind.final ? 'Chiffres définitifs du challenge.' : `Chiffres provisoires au ${new Date(`${data.today}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}, le Rewind se met à jour jusqu’au ${new Date(`${data.settings.end_date}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}.`}
        {' '}<Link href="/me">Retour à Mon espace</Link>
      </p>
    </>
  );
}
