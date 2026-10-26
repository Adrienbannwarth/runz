import Link from 'next/link';
import { activeBoost, fmtDate, fmtKm, loadAll, windowLabel } from '@/lib/data';
import { getParticipantId, isAdmin } from '@/lib/session';
import type { TeamStats } from '@/lib/scoring';

export const dynamic = 'force-dynamic';

/** Texte sombre sur les couleurs claires (ex. Jaunes). */
function isLight(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 170;
}

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const [data, pid, admin] = await Promise.all([loadAll(), getParticipantId(), isAdmin()]);
  const { settings, teams, boosts, today } = data;
  const isTotal = data.mode === 'total';
  const leader = Math.max(1, ...teams.map((t) => t.score));
  const boost = activeBoost(boosts, settings);
  const started = today >= settings.start_date;
  const ended = today > settings.end_date;
  const totalKm = teams.reduce((t, x) => t + x.totalKm, 0);
  const people = teams.reduce((t, x) => t + x.members, 0);
  const upcoming = boosts.filter((b) => b.ends_at.slice(0, 10) >= today).slice(0, 4);
  const current = boosts.filter((b) => b.starts_at.slice(0, 10) <= today && today <= b.ends_at.slice(0, 10))
    .sort((a, c) => Number(c.multiplier) - Number(a.multiplier))[0];
  // Vue : admin = toutes les équipes ; membre = sa propre équipe ; visiteur = invitation à se connecter
  const me = pid ? data.participants.find((p) => p.id === pid) : undefined;
  const myTeam = me ? teams.find((t) => t.team.id === me.team_id) : undefined;
  // Un admin peut prévisualiser la vue membre avec ?vue=membre
  const preview = admin && sp.vue === 'membre' && !!me;
  const view: 'admin' | 'member' | 'visitor' = admin && !preview ? 'admin' : me ? 'member' : 'visitor';
  // Une personne « remonte » côté membres quand elle est connectée à Strava ou a des km saisis
  const withKm = new Set(data.activities.map((a) => a.participant_id));
  const isOn = (p: (typeof data.participants)[number]) => !!p.strava_athlete_id || withKm.has(p.id);
  const connected = data.participants.filter(isOn);
  const mates = me ? data.participants.filter((p) => p.team_id === me.team_id) : [];

  const card = (t: TeamStats, big = false) => (
    <div className={`card team${big ? ' big' : ''}`} key={t.team.id}>
      <div className={`visual ${isLight(t.team.color) ? 'light' : ''}`} style={{ background: t.team.color }}>
        {(view === 'admin' || ended) && (
          <span className="badge">{view !== 'admin' && t.rank === 1 ? '🏆 Équipe gagnante !' : t.rank === 1 ? '🏆 1er' : `${t.rank}e`}{big && t.rank > 1 ? ` sur ${teams.length}` : ''}</span>
        )}
        <div className="score">{fmtKm(isTotal ? t.totalKm : t.avgKm)} <small>{isTotal ? 'km' : 'km / pers.'}</small></div>
      </div>
      <div className="name">{t.team.name}</div>
      <div className="rank">{view === 'admin' ? `${t.members} membre${t.members > 1 ? 's' : ''}` : `${mates.filter(isOn).length} connecté·e${mates.filter(isOn).length > 1 ? 's' : ''}`} · +{fmtKm(t.todayKm)} km aujourd’hui</div>
      {view === 'admin' && <div className="progress"><div style={{ width: `${(t.score / leader) * 100}%` }} /></div>}
      {isTotal ? <div className="kv"><span>Moyenne / pers.</span><span>{fmtKm(t.avgKm)} km</span></div>
               : <div className="kv"><span>Total équipe</span><span>{fmtKm(t.totalKm)} km</span></div>}
      <div className="kv"><span>Dont boosts ×</span><span>{fmtKm(t.multiplierKm)} km</span></div>
      <div className="kv"><span>Dont bonus</span><span>{fmtKm(t.bonusKm)} km</span></div>
    </div>
  );

  return (
    <>
      {sp.error && <div className="alert err">{sp.error}</div>}
      {sp.disconnected && <div className="alert ok">Ton compte Strava est déconnecté et tes données Strava ont été effacées.</div>}

      {view === 'visitor' ? (
        <section className="hero">
          <div>
            <p className="eyebrow" style={{ color: '#bdbdbd' }}>
              {ended ? 'Challenge terminé' : started ? 'Challenge en cours' : 'Bientôt le coup d’envoi'} · du {fmtDate(settings.start_date)} au {fmtDate(settings.end_date)}
            </p>
            <h1>{settings.challenge_name} :<br />chaque pas compte</h1>
            <p>{connected.length} participant·es connecté·es · {fmtKm(totalKm)} km parcourus ensemble</p>
          </div>
          <div className="actions">
            <a className="btn white" href="/api/strava/connect">Se connecter avec Strava</a>
          </div>
        </section>
      ) : (
        <section className="hero rules">
          <div>
            <p className="eyebrow" style={{ color: '#bdbdbd' }}>
              {ended ? 'Challenge terminé' : started ? 'Challenge en cours' : 'Bientôt le coup d’envoi'} · du {fmtDate(settings.start_date)} au {fmtDate(settings.end_date)}
            </p>
            <h1>Les règles du jeu</h1>
          </div>
          <ol>
            <li><b>Marche, rando, course, trail ou tapis</b> : tout compte, à ton rythme. Le vélo ne compte pas.</li>
            <li><b>Tes activités Strava remontent toutes seules.</b> Pas de Strava ? Envoie une capture à l’organisation.</li>
            <li><b>Chaque km compte pour ton équipe</b>, qui est classée au {isTotal ? 'total des km' : 'nombre moyen de km par personne'}.</li>
            <li><b>Les boosts multiplient tes km</b> sur certains jours ou créneaux : surveille le boost en cours.</li>
            <li><b>Des bonus d’équipe</b> se gagnent aussi : photo aux couleurs, sortie commune, ParrainZ…</li>
            <li><b>Au-delà de {settings.daily_cap_km} km par jour</b>, l’organisation vérifie l’activité. Écoute ton corps !</li>
            <li><b>Le classement reste secret</b> jusqu’au {fmtDate(settings.end_date)} : résultats et prix à la fin du challenge.</li>
          </ol>
        </section>
      )}

      {boost && (
        <div className="banner">⚡ {boost.name} en cours : chaque km compte ×{boost.multiplier}{boost.slot !== 'Tous' ? ` (${boost.slot})` : ''}{boost.manual ? ', après validation des organisateurs' : ''}</div>
      )}

      {view === 'admin' && (
        <>
          <p className="eyebrow" id="classement">Vue organisateurs · {isTotal ? 'classement au total des km de l’équipe' : 'classement à la moyenne de km par personne'}{me && <> · <Link href="/?vue=membre#classement">Voir comme un membre</Link></>}</p>
          <h2 style={{ marginTop: 0 }}>Les équipes</h2>
          <div className="teams-row">{teams.map((t) => card(t))}</div>
          <p className="muted small" style={{ marginTop: 20 }}>
            Les participants ne voient que leur équipe et son rang. Au-delà de {settings.daily_cap_km} km sur une journée, l’activité est signalée dans l’admin.
          </p>
        </>
      )}

      {view === 'member' && (
        <>
          {preview && <div className="banner">👀 Aperçu de la vue membre (ce que voient les participants). <Link href="/#classement">Revenir à la vue organisateurs</Link></div>}
          <p className="eyebrow" id="classement">Ton équipe{!ended ? ' · le classement sera dévoilé à la fin du challenge' : ''}</p>
          {myTeam ? (
            <div className="my-team">
              {card(myTeam, true)}
              <div className="card">
                <h2 style={{ margin: '0 0 12px' }}>{/^team /i.test(myTeam.team.name) ? myTeam.team.name : `Les ${myTeam.team.name}`}</h2>
                {mates.filter(isOn).map((p) => (
                  <div className="kv" key={p.id}>
                    <span style={{ color: 'var(--ink)' }}>{p.display_name}{p.id === me!.id ? ' (toi)' : ''}{p.is_captain ? ' · capitaine' : ''}</span>
                    <span>{p.strava_athlete_id ? 'Strava' : 'saisie manuelle'}</span>
                  </div>
                ))}
                {mates.filter((p) => !isOn(p)).length > 0 && (
                  <p className="muted small" style={{ marginBottom: 0 }}>
                    + {mates.filter((p) => !isOn(p)).length} coéquipier·e{mates.filter((p) => !isOn(p)).length > 1 ? 's' : ''} pas encore connecté·e{mates.filter((p) => !isOn(p)).length > 1 ? 's' : ''}. Motive-les !
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="card">Ton équipe n’a pas encore été attribuée : l’organisation s’en occupe.</div>
          )}
        </>
      )}

      {view === 'admin' ? (
        upcoming.length > 0 && (
          <>
            <h2>Boosts du challenge</h2>
            <div className="card">
              {upcoming.map((b) => (
                <div className="kv" key={b.id} style={{ padding: '4px 0' }}>
                  <span>⚡ {b.name}{b.name.includes('×') ? '' : ` · ×${b.multiplier}`}</span>
                  <span>{b.starts_at.slice(0, 10) === b.ends_at.slice(0, 10) ? fmtDate(b.starts_at) : `du ${fmtDate(b.starts_at)} au ${fmtDate(b.ends_at)}`} · {windowLabel(b)}</span>
                </div>
              ))}
            </div>
          </>
        )
      ) : (
        <>
          <h2>Boost en cours</h2>
          <div className="card">
            {current ? (
              <div className="kv" style={{ padding: '4px 0' }}>
                <span style={{ color: 'var(--ink)' }}>⚡ <b>{current.name}</b>{current.name.includes('×') ? '' : ` · ×${current.multiplier}`}</span>
                <span>{current.starts_at.slice(0, 10) === current.ends_at.slice(0, 10) ? `aujourd’hui` : `jusqu’au ${fmtDate(current.ends_at)}`} · {windowLabel(current)}</span>
              </div>
            ) : null}
            {current?.manual && (
              <p className="muted small" style={{ margin: '6px 0 0' }}>Boost validé par les organisateurs : ton activité compte d’abord normalement, le multiplicateur s’ajoute une fois vérifiée.</p>
            )}
            {!current && (
              <p className="muted" style={{ margin: 0 }}>Pas de boost en ce moment. Le prochain sera annoncé sur zlack, ouvre l’œil !</p>
            )}
          </div>
        </>
      )}

      {!pid && <h2>Participer</h2>}
      {!pid && <div className="card">
        {(
          <>
            <p style={{ marginTop: 0 }}>
              Connecte ton compte Strava : tes marches et courses sont importées automatiquement. Seules la distance, la durée,
              le dénivelé et l’heure de départ sont utilisées, jamais ton tracé GPS.
            </p>
            <a className="btn strava" href="/api/strava/connect">Se connecter avec Strava</a>
            <p className="muted small">Pas de Strava ? Envoie une capture d’écran de ton appli à l’organisation, tes km seront saisis à la main.</p>
          </>
        )}
      </div>}
    </>
  );
}
