import Link from 'next/link';
import { fmtDate, fmtKm, loadAll } from '@/lib/data';
import { getParticipantId } from '@/lib/session';
import { disconnectMe, logout, syncMe } from '../actions';

export const dynamic = 'force-dynamic';

export default async function Me({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const pid = await getParticipantId();
  if (!pid) {
    return (
      <>
        <h1>Mon espace</h1>
        <div className="card">
          <p style={{ marginTop: 0 }}>Connecte-toi avec Strava pour voir tes activités et ta contribution à l’équipe.</p>
          <a className="btn strava" href="/api/strava/connect">Se connecter avec Strava</a>
        </div>
      </>
    );
  }
  const data = await loadAll();
  const me = data.participants.find((p) => p.id === pid);
  if (!me) {
    return <div className="alert">Compte introuvable. <form action={logout}><button className="btn">Se déconnecter</button></form></div>;
  }
  const stats = data.people.find((p) => p.participant.id === pid)!;
  const team = data.teams.find((t) => t.team.id === me.team_id);
  const mine = data.scored.filter((s) => s.participant_id === pid);

  return (
    <>
      {sp.welcome && <div className="alert ok">Strava est connecté ✅ Tes activités depuis le début du challenge sont en cours d’import.</div>}
      {sp.sync && <div className={`alert ${sp.sync === 'ok' ? 'ok' : ''}`}>{sp.sync === 'ok' ? 'Synchronisation terminée.' : sp.sync}</div>}

      <h1>{me.display_name}</h1>
      <p className="muted">
        {team ? <>Équipe <b>{team.team.emoji} {team.team.name}</b> · {team.rank}e au classement</> : 'Équipe pas encore attribuée'}
        {me.last_sync_at && <> · dernière synchro {new Date(me.last_sync_at).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}</>}
      </p>

      <div className="grid">
        <div className="card"><div className="muted small">Km comptés (boosts inclus)</div><div className="team"><div className="score">{fmtKm(stats.countedKm)}</div></div></div>
        <div className="card"><div className="muted small">Km parcourus</div><div className="team"><div className="score">{fmtKm(stats.rawKm)}</div></div></div>
        <div className="card"><div className="muted small">Jours actifs · Dénivelé</div><div className="team"><div className="score">{stats.activeDays} <small>j · {stats.elevationM} m D+</small></div></div></div>
      </div>

      <div style={{ display: 'flex', gap: 8, margin: '16px 0', flexWrap: 'wrap' }}>
        {me.strava_athlete_id ? (
          <form action={syncMe}><button className="btn primary">↻ Resynchroniser Strava</button></form>
        ) : (
          <a className="btn strava" href="/api/strava/connect">Se connecter avec Strava</a>
        )}
        <form action={logout}><button className="btn">Se déconnecter</button></form>
        {me.strava_athlete_id && (
          <form action={disconnectMe}><button className="btn danger">Retirer l’accès Strava et effacer mes données</button></form>
        )}
      </div>

      {me.is_admin && (
        <div className="admin-block">
          <div>
            <p className="eyebrow">Organisation</p>
            <h2 style={{ margin: '0 0 6px' }}>Administration</h2>
            <p className="muted" style={{ margin: 0 }}>Participants, saisie des km, bonus, boosts, MVP et récap du soir.</p>
          </div>
          <div className="tabs" style={{ margin: 0 }}>
            <Link href="/admin?tab=participants">Participants</Link>
            <Link href="/admin?tab=saisie">Saisie manuelle</Link>
            <Link href="/admin?tab=bonus">Bonus</Link>
            <Link href="/admin?tab=recap">Récap zlack</Link>
            <Link className="on" href="/admin">Ouvrir l’admin →</Link>
          </div>
        </div>
      )}

      <h2>Mes activités</h2>
      <div className="card" style={{ overflowX: 'auto' }}>
        {mine.length === 0 ? <p className="muted" style={{ margin: 0 }}>Aucune activité pour l’instant.</p> : (
          <table>
            <thead><tr><th>Date</th><th>Activité</th><th>Type</th><th className="num">Distance</th><th className="num">Comptés</th><th></th></tr></thead>
            <tbody>
              {mine.map((a) => (
                <tr key={a.id} className={a.eligible ? '' : 'off'}>
                  <td>{fmtDate(a.day)} {a.start_date_local.slice(11, 16)}</td>
                  <td>{a.name || (a.source === 'manual' ? 'Saisie manuelle' : '—')}
                    {!a.eligible && <div className="small">{a.reason}</div>}
                    {a.eligible && a.cappedKm < a.rawKm - 0.01 && <div className="small muted">Plafond journalier appliqué</div>}
                  </td>
                  <td>{a.sport_type}</td>
                  <td className="num">{fmtKm(a.rawKm)} km</td>
                  <td className="num">{a.eligible ? <>{fmtKm(a.countedKm)} km{a.multiplier > 1 && <div><span className="pill">⚡ ×{a.multiplier} {a.boostName}</span></div>}</> : '—'}</td>
                  <td>{a.strava_activity_id && <a className="strava-link" href={`https://www.strava.com/activities/${a.strava_activity_id}`} target="_blank">Voir sur Strava</a>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="muted small">Tu ne vois que tes propres activités. Le classement public n’affiche que des totaux par équipe. <Link href="/confidentialite">En savoir plus</Link></p>
    </>
  );
}
