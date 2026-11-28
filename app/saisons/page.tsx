import Link from 'next/link';
import { getParticipantId } from '@/lib/session';
import { canPreview, currentSeasonId, loadSeasons } from '@/lib/seasons';

export const dynamic = 'force-dynamic';

const fmt = (d: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'dates à venir');

/** Historique des saisons : une carte par saison (les saisons en préparation ne sont visibles que des comptes autorisés). */
export default async function SeasonsPage() {
  const [seasons, current, preview] = await Promise.all([loadSeasons(), currentSeasonId(), getParticipantId().then(canPreview)]);
  const shown = seasons.filter((s) => s.status !== 'draft' || preview);
  return (
    <>
      <p className="eyebrow">L’historique</p>
      <h1>Les saisons</h1>
      <div className="seasons-grid">
        {shown.map((s) => {
          const href = s.status === 'draft' ? `/${s.kind}` : s.id === current ? '/' : `/saisons/${s.id}`;
          return (
            <Link key={s.id} href={href} className={`season-card ${s.status}`}>
              <span className="season-num">Saison {s.id}</span>
              <span className="season-name">{s.name}</span>
              <span className="season-dates">{s.status === 'draft' ? 'En préparation · visible par toi seul' : `${fmt(s.starts_on)} → ${fmt(s.ends_on)}`}</span>
              <span className="season-cta">{s.status === 'done' ? 'Revoir le récap →' : s.status === 'live' ? 'En cours →' : 'Ouvrir l’aperçu →'}</span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
