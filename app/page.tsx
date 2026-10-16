import Link from 'next/link';
import { activeBoost, fmtDate, fmtKm, loadAll } from '@/lib/data';
import { getParticipantId } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const [data, pid] = await Promise.all([loadAll(), getParticipantId()]);
  const { settings, teams, boosts, today } = data;
  const leader = Math.max(1, ...teams.map((t) => t.avgKm));
  const boost = activeBoost(boosts, settings);
  const started = today >= settings.start_date;
  const ended = today > settings.end_date;
  const totalKm = teams.reduce((t, x) => t + x.totalKm, 0);
  const people = teams.reduce((t, x) => t + x.members, 0);
  const upcoming = boosts.filter((b) => b.starts_at.slice(0, 10) >= today).slice(0, 3);

  return (
    <>
      {sp.error && <div className="alert">{sp.error}</div>}
      {sp.disconnected && <div className="alert ok">Ton compte Strava est déconnecté et tes données Strava ont été effacées.</div>}

      <h1>{settings.challenge_name} · Chaque pas compte</h1>
      <p className="muted">
        Du {fmtDate(settings.start_date)} au {fmtDate(settings.end_date)} ·{' '}
        {ended ? 'Challenge terminé' : started ? 'En cours' : 'Bientôt le coup d’envoi'} · {people} participant·es ·{' '}
        {fmtKm(totalKm)} km au compteur
      </p>

      {boost && (
        <div className="banner">⚡ <span><b>{boost.name}</b> en cours : chaque km compte ×{boost.multiplier}</span></div>
      )}

      <div className="grid">
        {teams.map((t) => (
          <div className="card team" key={t.team.id}>
            <div className="bar" style={{ background: t.team.color }} />
            <div className="rank">{t.rank === 1 ? '🏆 1er' : `${t.rank}e`}</div>
            <div className="name">{t.team.emoji} {t.team.name}</div>
            <div className="score">{fmtKm(t.avgKm)} <small>km / pers.</small></div>
            <div className="progress"><div style={{ width: `${(t.avgKm / leader) * 100}%`, background: t.team.color }} /></div>
            <div className="kv"><span>Total équipe</span><span>{fmtKm(t.totalKm)} km</span></div>
            <div className="kv"><span>Dont bonus</span><span>{fmtKm(t.bonusKm)} km</span></div>
            <div className="kv"><span>Aujourd’hui</span><span>+{fmtKm(t.todayKm)} km</span></div>
            <div className="kv"><span>Membres</span><span>{t.members}</span></div>
          </div>
        ))}
      </div>
      <p className="muted small">
        Classement à la moyenne de km par participant (bonus inclus). Marche, rando, course, trail et tapis comptent ;
        plafond {settings.daily_cap_km} km / jour / personne.
      </p>

      {upcoming.length > 0 && (
        <>
          <h2>Boosts à venir</h2>
          <div className="card">
            {upcoming.map((b) => (
              <div className="kv" key={b.id} style={{ padding: '4px 0' }}>
                <span>⚡ {b.name} · ×{b.multiplier}</span>
                <span>{fmtDate(b.starts_at)} {b.starts_at.slice(11, 16)} → {b.ends_at.slice(11, 16)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <h2>Participer</h2>
      <div className="card">
        {pid ? (
          <p style={{ margin: 0 }}>Tu es connecté·e. <Link href="/me">Voir mes activités →</Link></p>
        ) : (
          <>
            <p style={{ marginTop: 0 }}>
              Connecte ton compte Strava : tes marches et courses sont importées automatiquement. Seules la distance, la durée,
              le dénivelé et l’heure de départ sont utilisées, jamais ton tracé GPS.
            </p>
            <a className="btn strava" href="/api/strava/connect">Se connecter avec Strava</a>
            <p className="muted small">Pas de Strava ? Envoie une capture d’écran de ton appli à l’organisation, tes km seront saisis à la main.</p>
          </>
        )}
      </div>
    </>
  );
}
