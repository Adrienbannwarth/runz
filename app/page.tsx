import Link from 'next/link';
import { activeBoost, fmtDate, fmtKm, loadAll } from '@/lib/data';
import { getParticipantId } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** Texte sombre sur les couleurs claires (ex. Jaunes). */
function isLight(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 170;
}

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
      {sp.error && <div className="alert err">{sp.error}</div>}
      {sp.disconnected && <div className="alert ok">Ton compte Strava est déconnecté et tes données Strava ont été effacées.</div>}

      <section className="hero">
        <div>
          <p className="eyebrow" style={{ color: '#bdbdbd' }}>
            {ended ? 'Challenge terminé' : started ? 'Challenge en cours' : 'Bientôt le coup d’envoi'} · du {fmtDate(settings.start_date)} au {fmtDate(settings.end_date)}
          </p>
          <h1>{settings.challenge_name} :<br />chaque pas compte</h1>
          <p>{people} participant·es · {fmtKm(totalKm)} km parcourus ensemble</p>
        </div>
        <div className="actions">
          {pid ? <Link className="btn white" href="/me">Mon espace</Link>
               : <a className="btn white" href="/api/strava/connect">Se connecter avec Strava</a>}
          <a className="btn ghost" href="#classement">Voir le classement</a>
        </div>
      </section>

      {boost && (
        <div className="banner">⚡ {boost.name} en cours : chaque km compte ×{boost.multiplier}</div>
      )}

      <p className="eyebrow" id="classement">Classement à la moyenne de km par personne</p>
      <h2 style={{ marginTop: 0 }}>Les équipes</h2>
      <div className="teams-row">
        {teams.map((t) => (
          <div className="card team" key={t.team.id}>
            <div className={`visual ${isLight(t.team.color) ? 'light' : ''}`} style={{ background: t.team.color }}>
              <span className="badge">{t.rank === 1 ? '🏆 1er' : `${t.rank}e`}</span>
              <div className="score">{fmtKm(t.avgKm)} <small>km / pers.</small></div>
            </div>
            <div className="name">{t.team.name}</div>
            <div className="rank">{t.members} membre{t.members > 1 ? 's' : ''} · +{fmtKm(t.todayKm)} km aujourd’hui</div>
            <div className="progress"><div style={{ width: `${(t.avgKm / leader) * 100}%` }} /></div>
            <div className="kv"><span>Total équipe</span><span>{fmtKm(t.totalKm)} km</span></div>
            <div className="kv"><span>Dont bonus</span><span>{fmtKm(t.bonusKm)} km</span></div>
          </div>
        ))}
      </div>
      <p className="muted small" style={{ marginTop: 20 }}>
        Bonus inclus. Marche, rando, course, trail et tapis comptent ; plafond {settings.daily_cap_km} km / jour / personne.
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
