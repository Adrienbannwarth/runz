import Link from 'next/link';
import Countdown from './Countdown';
import { fmtKm } from '@/lib/data';
import { RESULTS_AT_ISO } from '@/lib/rewind';
import type { TeamStats } from '@/lib/scoring';

/**
 * Écran de fin de saison (page d'accueil des membres une fois le challenge terminé).
 * Avant l'heure des résultats : chiffres collectifs + compte à rebours. Après : podium + accès au Rewind.
 */
export default function SeasonEnd({ teams, km, activities, people, elevation, results, loggedIn, myTeamId, admin }: {
  teams: TeamStats[]; km: number; activities: number; people: number; elevation: number;
  results: boolean; loggedIn: boolean; myTeamId?: number | null; admin: boolean;
}) {
  const podium = [...teams].sort((a, b) => a.rank - b.rank);
  const winner = podium[0];
  const stats: [string, string][] = [
    [fmtKm(Math.round(km)), 'km au compteur, tous ensemble'],
    [String(activities), 'sorties enregistrées'],
    [String(people), 'participant·es'],
    [Math.round(elevation).toLocaleString('fr-FR'), 'mètres de dénivelé'],
  ];
  return (
    <div className="season-end">
      <section className="se-hero">
        <p className="se-eyebrow">RunZ · Saison 1 · du 27 octobre au 27 novembre</p>
        <h1>{results ? <>Et la gagnante est…</> : <>C’est terminé&nbsp;!</>}</h1>
        {results && winner
          ? <p className="se-winner"><span className="dot" style={{ background: winner.team.color }} /> {winner.team.name} <small>{fmtKm(winner.totalKm)} km</small></p>
          : <p className="se-lead">Un mois à marcher, courir, dessiner des formes et chasser les couleurs. Merci à toutes et à tous&nbsp;!</p>}
        <div className="se-stats">
          {stats.map(([v, l]) => <div key={l}><b>{v}</b><span>{l}</span></div>)}
        </div>
      </section>

      {results ? (
        <section className="se-next">
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
          <div className="se-cta">
            {loggedIn
              ? <Link className="btn primary" href="/rewind">Voir mon Rewind</Link>
              : <a className="btn strava" href="/api/strava/connect">Se connecter pour voir mon Rewind</a>}
          </div>
        </section>
      ) : (
        <section className="se-next">
          <h2>Rendez-vous lundi 30 novembre à 18h</h2>
          <p>Les derniers km sont vérifiés ce week-end. Lundi soir : le classement final, et ton Rewind, le récap de ta saison en stories.</p>
          <Countdown to={RESULTS_AT_ISO} />
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
