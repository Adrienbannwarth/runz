import Link from 'next/link';
import { fmtKm } from '@/lib/data';
import type { TeamStats } from '@/lib/scoring';

/**
 * Écran de fin de saison (accueil des membres une fois le challenge terminé) :
 * bandeau « C'est terminé » + grande bannière Mon Rewind (cliquable dès l'heure des résultats) + classement final.
 */
export default function SeasonEnd({ teams, km, activities, people, elevation, results, loggedIn, myTeamId, admin }: {
  teams: TeamStats[]; km: number; activities: number; people: number; elevation: number;
  results: boolean; loggedIn: boolean; myTeamId?: number | null; admin: boolean;
}) {
  const podium = [...teams].sort((a, b) => a.rank - b.rank);
  const stats: [string, string][] = [
    [Math.round(km).toLocaleString('fr-FR'), 'km au compteur'],
    [activities.toLocaleString('fr-FR'), 'sorties'],
    [String(people), 'participant·es'],
    [Math.round(elevation).toLocaleString('fr-FR'), 'm de dénivelé'],
  ];
  const open = results || admin; // les admins peuvent ouvrir leur Rewind avant tout le monde
  const banner = (
    <>
      <span className="se-rw-text">
        <span className="se-rw-eyebrow">{open ? 'Ta saison en stories' : 'Disponible lundi 30 novembre à 18h'}</span>
        <span className="se-rw-title">Mon Rewind</span>
      </span>
      <span className="se-rw-arrow" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
      </span>
    </>
  );
  return (
    <div className="season-end">
      <section className="se-hero">
        <p className="se-season">RunZ · Saison 1</p>
        <h1>C’est terminé&nbsp;!</h1>
        <p className="se-lead">Un mois à marcher, courir, dessiner des formes et chasser les couleurs. Merci à toutes et à tous&nbsp;!</p>
        <div className="se-stats">
          {stats.map(([v, l]) => <div key={l}><b>{v}</b><span>{l}</span></div>)}
        </div>
      </section>

      {open && loggedIn
        ? <Link href="/rewind" className="se-rewind">{banner}</Link>
        : open
          ? <a href="/api/strava/connect" className="se-rewind">{banner}</a>
          : <div className="se-rewind off" aria-disabled="true">{banner}</div>}

      {results && (
        <section className="se-final">
          <h2>Le classement final</h2>
          <ol className="se-podium">
            {podium.map((t) => (
              <li key={t.team.id} className={t.team.id === myTeamId ? 'mine' : ''}>
                <span className="se-rank">{t.rank === 1 ? '🏆' : `${t.rank}e`}</span>
                <span className="dot" style={{ background: t.team.color }} />
                <span className="se-name">{t.team.name}{t.team.id === myTeamId ? ' · ton équipe' : ''}</span>
                <span className="se-km">{fmtKm(t.totalKm)} km</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {admin && (
        <p className="se-admin muted small">
          Vue organisateurs : les membres voient cet écran. <Link href="/?suite=1">Continuer vers le site →</Link>
        </p>
      )}
    </div>
  );
}
