import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isAdmin, isPasswordAdmin } from '@/lib/session';
import { appCapacity, appUrl, stravaApps } from '@/lib/strava';
import { boostOfDay, daysLeft, fmtDate, fmtKm, loadAll, windowLabel } from '@/lib/data';
import { leadSentence } from '@/lib/scoring';
import * as A from './actions';
import TeamSelect from './TeamSelect';
import CopyLink from './CopyLink';

export const dynamic = 'force-dynamic';

const TABS = [
  ['participants', 'Participants'], ['activites', 'Activités'], ['saisie', 'Saisie manuelle'], ['bonus', 'Bonus'],
  ['boosts', 'Boosts'], ['validations', 'Validations'], ['mvp', 'MVP'], ['recap', 'Récap zlack'], ['reglages', 'Réglages'],
] as const;
const SPORTS = ['Walk', 'Run', 'TrailRun', 'Hike', 'VirtualRun'];
const SLOTS = ['Tous', 'Avant 8h', '12h-14h', '19h-22h'];
const SPORT_FR: Record<string, string> = { Walk: 'Marche', Run: 'Course', TrailRun: 'Trail', Hike: 'Randonnée', VirtualRun: 'Tapis', Wheelchair: 'Fauteuil' };

export default async function Admin({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  if (!(await isAdmin())) redirect('/admin/login');
  const sp = await searchParams;
  const tab = sp.tab || 'participants';
  const d = await loadAll();
  const teamsAll = d.teamList;                       // toutes les équipes (y compris inactives)
  const allTeams = teamsAll.filter((t) => t.active); // équipes en jeu
  const pName = (id: string | null) => d.participants.find((p) => p.id === id)?.display_name ?? '';

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Admin</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <a className="btn small" href="/api/export" download>Exporter (format Saisie km)</a>
          <Link className="btn small" href="/me">← Mon espace</Link>
          {(await isPasswordAdmin()) && <form action={A.adminLogout}><button className="btn small">Déconnexion admin</button></form>}
        </div>
      </div>
      <nav className="tabs">
        {TABS.map(([k, label]) => <Link key={k} href={`/admin?tab=${k}`} className={tab === k ? 'on' : ''}>{label}</Link>)}
      </nav>
      {sp.msg && <div className="alert ok">{sp.msg}</div>}

      {tab === 'participants' && (
        <>
          <h2>Participants · {d.participants.filter((p) => p.strava_athlete_id).length} connecté·es à Strava sur {d.participants.length} fiches</h2>
          <div className="tabs" style={{ margin: '0 0 8px' }}>
            {stravaApps().map((a) => {
              const used = d.participants.filter((p) => p.strava_athlete_id && (p.strava_app || 'a') === a.key).length;
              return <span key={a.key} className={`pill${used >= appCapacity() ? ' on' : ''}`}>App {a.key.toUpperCase()} · {used}/{appCapacity()}</span>;
            })}
          </div>
          <nav className="tabs sub">
            <Link href="/admin?tab=participants" className={!sp.team ? 'on' : ''}>Toutes les équipes</Link>
            {allTeams.map((t) => (
              <Link key={t.id} href={`/admin?tab=participants&team=${t.id}`} className={sp.team === String(t.id) ? 'on' : ''}>
                <span className="dot" style={{ background: t.color }} /> {t.name} · {d.participants.filter((p) => p.team_id === t.id).length}
              </Link>
            ))}
            {d.participants.some((p) => !p.team_id) && <Link href="/admin?tab=participants&team=none" className={sp.team === 'none' ? 'on' : ''}>Sans équipe</Link>}
          </nav>
          <p className="muted small">Les fiches sont créées à l’avance (liens d’invitation, saisie manuelle). Côté participants, une personne n’apparaît qu’une fois connectée à Strava ou avec des km saisis.</p>
          <div className="card" style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>Nom · équipe</th><th style={{ minWidth: 150 }}>Strava</th><th className="num">Km réels</th><th>Lien d’invitation</th><th></th></tr></thead>
              <tbody>
                {d.participants
                  .filter((p) => !sp.team || (sp.team === 'none' ? !p.team_id : String(p.team_id) === sp.team))
                  .sort((a, b) => (teamsAll.findIndex((t) => t.id === a.team_id) + 1 || 99) - (teamsAll.findIndex((t) => t.id === b.team_id) + 1 || 99) || a.display_name.localeCompare(b.display_name, 'fr'))
                  .map((p) => {
                  const st = d.people.find((x) => x.participant.id === p.id);
                  return (
                    <tr key={p.id}>
                      <td>
                        <form action={A.updateParticipant} className="inline">
                          <input type="hidden" name="id" value={p.id} />
                          <input name="display_name" defaultValue={p.display_name} style={{ width: 170 }} />
                          <TeamSelect teams={teamsAll} defaultValue={p.team_id} />
                          <button className="btn small ok-btn">OK</button>
                        </form>
                      </td>
                      <td>{p.strava_athlete_id
                        ? <span className="check" title={p.last_sync_at ? `Connecté · dernière synchro ${new Date(p.last_sync_at).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' })}` : 'Connecté à Strava'}>App {(p.strava_app || 'a').toUpperCase()}</span>
                        : <span className="muted">—</span>}
                        {p.strava_athlete_id && (
                          <a className="strava-link" style={{ marginLeft: 8, whiteSpace: 'nowrap' }} href={`https://www.strava.com/athletes/${p.strava_athlete_id}`} target="_blank" rel="noopener noreferrer">Profil Strava ↗</a>
                        )}
                      </td>
                      <td className="num">{fmtKm(st?.rawKm ?? 0)}</td>
                      <td><CopyLink url={`${appUrl()}/join/${p.invite_token}`} /></td>
                      <td>
                        <form action={A.deleteParticipant}><input type="hidden" name="id" value={p.id} /><button className="btn small danger icon-x" aria-label="Supprimer" title="Supprimer">×</button></form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {(() => {
            const toCheck = d.scored.filter((a) => a.eligible && a.flag);
            if (!toCheck.length) return null;
            return (
              <>
                <h2>À vérifier · activités sans tracé ({toCheck.length})</h2>
                <div className="card" style={{ overflowX: 'auto' }}>
                  <table>
                    <thead><tr><th>Date</th><th>Participant</th><th>Type</th><th className="num">Km</th><th>Pourquoi</th><th></th></tr></thead>
                    <tbody>
                      {toCheck.map((a) => (
                        <tr key={a.id}>
                          <td>{fmtDate(a.day)} {a.start_date_local.slice(11, 16)}</td><td>{pName(a.participant_id)}</td>
                          <td>{SPORT_FR[a.sport_type] ?? a.sport_type}</td><td className="num">{fmtKm(a.rawKm)}</td>
                          <td><span className="pill" style={{ color: 'var(--red)' }}>{a.flag}</span></td>
                          <td>{a.strava_activity_id && <a className="strava-link" href={`https://www.strava.com/activities/${a.strava_activity_id}`} target="_blank">Voir sur Strava</a>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="muted small">Ces activités comptent dans les scores. En cas de doute, demande une capture au participant ; pour retirer des km, ajoute un bonus négatif à l’équipe.</p>
              </>
            );
          })()}
          {d.people.some((x) => x.overCapDays.length) && (
            <>
              <h2>Alertes plafond ({d.settings.daily_cap_km} km / jour)</h2>
              <div className="card">
                {d.people.filter((x) => x.overCapDays.length).map((x) => (
                  <div className="kv" key={x.participant.id}><span>{x.participant.display_name}</span><span>{x.overCapDays.map(fmtDate).join(', ')}</span></div>
                ))}
              </div>
            </>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <form action={A.syncAll}><button className="btn primary">↻ Resynchroniser tous les comptes Strava</button></form>
          </div>
          <h2>Ajouter des participants</h2>
          <form action={A.createParticipant} className="card inline">
            <label>Noms (un par ligne)<textarea name="names" rows={4} cols={32} placeholder={'Adrien Bannwarth\nAnne Denis'} /></label>
            <label>Équipe
              <TeamSelect teams={allTeams} />
            </label>
            <button className="btn primary">Ajouter</button>
          </form>
          <p className="muted small">Chaque participant reçoit un lien d’invitation personnel : en se connectant à Strava via ce lien, son compte est rattaché à sa fiche et à son équipe. Une personne qui se connecte sans lien apparaît ici « sans équipe ».</p>
        </>
      )}

      {tab === 'activites' && (() => {
        const teamOf = (pid: string) => d.participants.find((p) => p.id === pid)?.team_id ?? null;
        const rows = d.scored
          .filter((a) => !sp.team || (sp.team === 'none' ? !teamOf(a.participant_id) : String(teamOf(a.participant_id)) === sp.team))
          .sort((a, b) => b.start_date_local.localeCompare(a.start_date_local));
        const ok = rows.filter((a) => a.eligible);
        const sum = (f: (a: (typeof rows)[number]) => number) => ok.reduce((t, a) => t + f(a), 0);
        const ts = sp.team ? d.teams.find((t) => String(t.team.id) === sp.team) : undefined;
        const bonusRows = d.bonuses.filter((b) => !sp.team || String(b.team_id) === sp.team)
          .sort((a, b) => b.awarded_on.localeCompare(a.awarded_on));
        const bonusKm = bonusRows.reduce((t, b) => t + Number(b.km), 0);
        return (
          <>
            <nav className="tabs sub">
              <Link href="/admin?tab=activites" className={!sp.team ? 'on' : ''}>Toutes les équipes</Link>
              {allTeams.map((t) => (
                <Link key={t.id} href={`/admin?tab=activites&team=${t.id}`} className={sp.team === String(t.id) ? 'on' : ''}>
                  <span className="dot" style={{ background: t.color }} /> {t.name}
                </Link>
              ))}
            </nav>
            <p className="muted small">
              {ok.length} activité{ok.length > 1 ? 's' : ''} comptée{ok.length > 1 ? 's' : ''} · {fmtKm(sum((a) => a.rawKm))} km réels · {fmtKm(sum((a) => a.countedKm))} km comptés
              {' · '}{fmtKm(bonusKm)} km de bonus
              {ts ? <> · total équipe : <b>{fmtKm(ts.totalKm)} km</b></> : null}
              {rows.length > ok.length ? ` · ${rows.length - ok.length} non comptée${rows.length - ok.length > 1 ? 's' : ''} (grisées)` : ''}
            </p>
            <div className="card" style={{ overflowX: 'auto' }}>
              {rows.length === 0 ? <p className="muted" style={{ margin: 0 }}>Aucune activité pour l’instant.</p> : (
                <table>
                  <thead><tr><th>Date</th><th>Participant</th><th>Activité</th><th className="num">Distance</th><th className="num">Comptés</th><th>Infos</th><th></th></tr></thead>
                  <tbody>
                    {rows.map((a) => {
                      const t = allTeams.find((x) => x.id === teamOf(a.participant_id));
                      return (
                        <tr key={a.id} className={a.eligible ? '' : 'off'}>
                          <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(a.day)} {a.start_date_local.slice(11, 16)}</td>
                          <td style={{ whiteSpace: 'nowrap' }}><span className="dot" style={{ display: 'inline-block', background: t?.color }} /> {pName(a.participant_id)}</td>
                          <td>{a.name || (a.source === 'manual' ? 'Saisie manuelle' : '—')} <span className="muted small">{SPORT_FR[a.sport_type] ?? a.sport_type}</span></td>
                          <td className="num">{fmtKm(a.rawKm)} km</td>
                          <td className="num">{a.eligible ? `${fmtKm(a.countedKm)} km` : '—'}</td>
                          <td className="small">
                            {!a.eligible && <div>{a.reason}</div>}
                            {a.multiplier > 1 && <div>⚡ ×{a.multiplier.toLocaleString('fr-FR')} {a.boostName}</div>}
                            {a.pendingBoosts.filter((x) => x.multiplier > a.multiplier).map((x) => <div key={x.id} className="muted">×{x.multiplier} {x.name} à valider</div>)}
                            {a.eligible && a.overCap && <div style={{ color: 'var(--red)' }}>Plafond {d.settings.daily_cap_km} km dépassé ce jour</div>}
                            {a.flag && <div style={{ color: 'var(--red)' }}>⚠ {a.flag}</div>}
                            {a.source === 'manual' && <div className="muted">Saisie admin</div>}
                          </td>
                          <td>{a.strava_activity_id && <a className="strava-link" href={`https://www.strava.com/activities/${a.strava_activity_id}`} target="_blank" rel="noopener noreferrer">Voir sur Strava</a>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <h2>Bonus</h2>
            <div className="card" style={{ overflowX: 'auto' }}>
              {bonusRows.length === 0 ? <p className="muted" style={{ margin: 0 }}>Aucun bonus pour l’instant (onglet Bonus pour en ajouter).</p> : (
                <table>
                  <thead><tr><th>Date</th><th>Équipe</th><th>Membre</th><th>Motif</th><th className="num">Km</th></tr></thead>
                  <tbody>
                    {bonusRows.map((b) => {
                      const t = allTeams.find((x) => x.id === b.team_id);
                      return (
                        <tr key={b.id}>
                          <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(b.awarded_on)}</td>
                          <td style={{ whiteSpace: 'nowrap' }}><span className="dot" style={{ display: 'inline-block', background: t?.color }} /> {t?.name}</td>
                          <td>{b.participant_id ? pName(b.participant_id) : <span className="muted">toute l’équipe</span>}</td>
                          <td>{b.reason}</td>
                          <td className="num">+{fmtKm(Number(b.km))} km</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        );
      })()}

      {tab === 'saisie' && (
        <>
          <h2>Saisir des km (capture d’écran, appli hors Strava)</h2>
          <form action={A.addManualActivity} className="card inline">
            <label>Participant
              <select name="participant_id" required>{d.participants.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}</select>
            </label>
            <label>Date<input type="date" name="date" required defaultValue={d.today} /></label>
            <label>Heure<input type="time" name="time" defaultValue="12:00" /></label>
            <label>Type<select name="sport_type">{SPORTS.map((x) => <option key={x} value={x}>{SPORT_FR[x]}</option>)}</select></label>
            <label>Km<input name="km" inputMode="decimal" required style={{ width: 80 }} /></label>
            <label>D+ (m)<input name="elevation" inputMode="numeric" style={{ width: 70 }} /></label>
            <label>Note<input name="note" placeholder="Capture Garmin" /></label>
            <button className="btn primary">Ajouter</button>
          </form>
          <p className="muted small">L’heure donne le créneau (Avant 8h, 12h-14h, 19h-22h) utilisé par les boosts et les prix MVP.</p>
          <h2>Saisies manuelles</h2>
          <div className="card" style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>Date</th><th>Participant</th><th>Type</th><th className="num">Km</th><th>Note</th><th></th></tr></thead>
              <tbody>
                {d.activities.filter((a) => a.source === 'manual').map((a) => (
                  <tr key={a.id}>
                    <td>{fmtDate(a.start_date_local)} {String(a.start_date_local).slice(11, 16)}</td>
                    <td>{pName(a.participant_id)}</td><td>{SPORT_FR[a.sport_type] ?? a.sport_type}</td>
                    <td className="num">{fmtKm(Number(a.distance_m) / 1000)}</td><td>{a.name}</td>
                    <td><form action={A.deleteActivity}><input type="hidden" name="id" value={a.id} /><button className="btn small danger icon-x" aria-label="Supprimer" title="Supprimer">×</button></form></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'bonus' && (
        <>
          <h2>Attribuer un bonus</h2>
          <form action={A.addBonus} className="card inline">
            <label>Équipe<select name="team_id" required>{allTeams.map((t) => <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>)}</select></label>
            <label>Membre (facultatif)
              <select name="participant_id"><option value="">— toute l’équipe —</option>{d.participants.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}</select>
            </label>
            <label>Km<input name="km" inputMode="decimal" required style={{ width: 70 }} /></label>
            <label>Motif
              <input name="reason" list="reasons" required placeholder="Photo couleur" />
              <datalist id="reasons">{['Photo couleur', 'Tous au compteur', 'Sortie commune', 'ParrainZ', 'Z Strava Art', 'On vient à pied'].map((r) => <option key={r} value={r} />)}</datalist>
            </label>
            <label>Date<input type="date" name="awarded_on" defaultValue={d.today} /></label>
            <button className="btn primary">Ajouter</button>
          </form>
          <p className="muted small">Repères du kit : Photo couleur +10 km/membre · Tous au compteur +30 km · Sortie commune +20 km · ParrainZ +10 km · Z Strava Art +25 km. Les bonus s’ajoutent au total de l’équipe.</p>
          <h2>Bonus attribués</h2>
          <div className="card" style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>Date</th><th>Équipe</th><th>Membre</th><th>Motif</th><th className="num">Km</th><th></th></tr></thead>
              <tbody>
                {d.bonuses.map((b) => (
                  <tr key={b.id}>
                    <td>{fmtDate(b.awarded_on)}</td><td>{teamsAll.find((t) => t.id === b.team_id)?.name}</td>
                    <td>{pName(b.participant_id)}</td><td>{b.reason}</td><td className="num">+{fmtKm(Number(b.km))}</td>
                    <td><form action={A.deleteBonus}><input type="hidden" name="id" value={b.id} /><button className="btn small danger icon-x" aria-label="Supprimer" title="Supprimer">×</button></form></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'boosts' && (
        <>
          <h2>Programmer un boost multiplicateur</h2>
          <form action={A.addBoost} className="card inline">
            <label>Nom<input name="name" required defaultValue="Flash HourZ ×2" /></label>
            <label>Du<input type="date" name="date" required defaultValue={d.today} /></label>
            <label>Au<input type="date" name="end_date" /></label>
            <label>Créneau<select name="slot">{SLOTS.map((x) => <option key={x} value={x}>{x}</option>)}</select></label>
            <label>ou horaire de<input type="time" name="from_time" style={{ width: 100 }} /></label>
            <label>à<input type="time" name="to_time" style={{ width: 100 }} /></label>
            <label>Multiplicateur<input name="multiplier" defaultValue="2" style={{ width: 60 }} /></label>
            <label className="inline-check"><input type="checkbox" name="manual" /> À valider par un admin</label>
            <button className="btn primary">Programmer</button>
          </form>
          <p className="muted small">Comme dans l’onglet Boost de l’Excel : une activité est boostée si son jour est dans la période et que son heure de départ tombe dans le créneau. Plusieurs boosts : le plus fort s’applique. Un horaire perso (ex. 18:30 à 22:00) remplace le créneau et s’applique chaque jour de la période, d’après l’heure de départ de l’activité. Un boost « à valider » ne s’applique qu’aux activités que vous validez dans l’onglet Validations.</p>
          <div className="card" style={{ marginTop: 12 }}>
            <table>
              <thead><tr><th>Boost</th><th>Début</th><th>Fin</th><th>Créneau</th><th className="num">×</th><th>Application</th><th></th></tr></thead>
              <tbody>
                {d.boosts.map((b) => (
                  <tr key={b.id}>
                    <td>{b.name}</td><td>{fmtDate(b.starts_at)}</td><td>{fmtDate(b.ends_at)}</td><td>{windowLabel(b)}</td>
                    <td className="num">{b.bonus_note ?? b.multiplier}</td>
                    <td>
                      <form action={A.setBoostManual} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input type="hidden" name="id" value={b.id} /><input type="hidden" name="manual" value={b.manual ? '0' : '1'} />
                        {b.manual ? <Link href={`/admin?tab=validations&boost=${b.id}`}>À valider</Link> : <span>Automatique</span>}
                        <button className="btn small">{b.manual ? 'Rendre automatique' : 'Passer en validation'}</button>
                      </form>
                    </td>
                    <td><form action={A.deleteBoost}><input type="hidden" name="id" value={b.id} /><button className="btn small danger icon-x" aria-label="Supprimer" title="Supprimer">×</button></form></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'validations' && (() => {
        const manual = d.boosts.filter((b) => b.manual);
        if (!manual.length) return <div className="card"><p className="muted" style={{ margin: 0 }}>Aucun boost « à valider ». Passe un boost en validation dans l’onglet Boosts.</p></div>;
        const current = manual.find((b) => String(b.id) === sp.boost) ?? manual[0];
        const rows = d.scored.filter((a) => a.eligible && (a.pendingBoosts.some((x) => x.id === current.id) || (a.validated_boosts ?? []).map(Number).includes(current.id)));
        const isOn = (a: (typeof rows)[number]) => (a.validated_boosts ?? []).map(Number).includes(current.id);
        const teamOf = (pid: string) => allTeams.find((t) => t.id === d.participants.find((p) => p.id === pid)?.team_id);
        return (
          <>
            <nav className="tabs sub">
              {manual.map((b) => <Link key={b.id} href={`/admin?tab=validations&boost=${b.id}`} className={b.id === current.id ? 'on' : ''}>{b.name} ×{b.multiplier}</Link>)}
            </nav>
            <p className="muted small">{current.name} : du {fmtDate(current.starts_at)} au {fmtDate(current.ends_at)}, créneau {windowLabel(current)}. Tant qu’une activité n’est pas validée, elle compte sans ce multiplicateur. {rows.filter(isOn).length} validée(s) sur {rows.length}.</p>
            <div className="card" style={{ overflowX: 'auto' }}>
              {rows.length === 0 ? <p className="muted" style={{ margin: 0 }}>Aucune activité sur cette période pour l’instant.</p> : (
                <table>
                  <thead><tr><th>Date</th><th>Participant</th><th>Activité</th><th className="num">Distance</th><th className="num">Comptés</th><th></th><th></th></tr></thead>
                  <tbody>
                    {rows.map((a) => {
                      const t = teamOf(a.participant_id);
                      return (
                        <tr key={a.id}>
                          <td>{fmtDate(a.day)} {a.start_date_local.slice(11, 16)}</td>
                          <td><span className="dot" style={{ background: t?.color }} /> {pName(a.participant_id)}</td>
                          <td>{a.name || (a.source === 'manual' ? 'Saisie manuelle' : '—')} <span className="muted small">{SPORT_FR[a.sport_type] ?? a.sport_type}</span>
                            {a.flag && <div className="small" style={{ color: 'var(--red)' }}>⚠ {a.flag}</div>}</td>
                          <td className="num">{fmtKm(a.rawKm)} km</td>
                          <td className="num">{fmtKm(a.countedKm)} km{a.multiplier > 1 && <div className="small">×{a.multiplier}</div>}</td>
                          <td>{a.strava_activity_id && <a className="strava-link" href={`https://www.strava.com/activities/${a.strava_activity_id}`} target="_blank">Voir sur Strava</a>}</td>
                          <td>
                            <form action={A.toggleBoostValidation}>
                              <input type="hidden" name="activity" value={a.id} /><input type="hidden" name="boost" value={current.id} /><input type="hidden" name="on" value={isOn(a) ? '0' : '1'} />
                              {isOn(a) ? <button className="btn small">✓ Validé · retirer</button> : <button className="btn small primary">Valider ×{current.multiplier}</button>}
                            </form>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        );
      })()}

      {tab === 'mvp' && (() => {
        const prizes: [string, string, (x: (typeof d.people)[number]) => number, string][] = [
          ['Machine à KilomètreZ', 'Le plus de km réels', (x) => x.rawKm, 'km'],
          ['Le Métronome', 'Le plus de jours actifs', (x) => x.activeDays, 'jours'],
          ['Lève-tôt d’or', 'Le plus de km avant 8 h', (x) => x.earlyKm, 'km'],
          ['Prix Pause Déj’', 'Le plus de km entre 12 h et 14 h', (x) => x.lunchKm, 'km'],
          ['Mollets d’acier', 'Le plus de dénivelé cumulé', (x) => x.elevationM, 'm'],
        ];
        const teamOf = (id: number | null) => d.teamList.find((t) => t.id === id);
        return (
          <>
            <h2>Prix calculés</h2>
            <div className="card" style={{ overflowX: 'auto' }}>
              <table>
                <thead><tr><th>Prix</th><th>Critère</th><th>Gagnant·e</th><th className="num">Valeur</th></tr></thead>
                <tbody>
                  {prizes.map(([name, crit, f, unit]) => {
                    const best = [...d.people].sort((x, y) => f(y) - f(x))[0];
                    const v = best ? f(best) : 0;
                    return (
                      <tr key={name}><td><b>{name}</b></td><td>{crit}</td><td>{v > 0 ? best.participant.display_name : '—'}</td>
                        <td className="num">{unit === 'km' ? fmtKm(v) : v} {unit}</td></tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="muted small">En cas d’égalité, une seule personne s’affiche : vérifier dans le détail avant d’annoncer.</p>
            <h2>Prix votés</h2>
            <div className="card">
              {[['Paparazzi RunZ', 'La meilleure photo couleur'], ['Capitaine Courage', 'Le capitaine qui a le mieux motivé'], ['Picasso du GPS', 'Le plus beau tracé']].map(([n, c]) => (
                <div className="kv" key={n}><span><b style={{ color: 'var(--ink)' }}>{n}</b> · {c}</span><span>vote sur zlack</span></div>
              ))}
            </div>
            <h2>Détail par participant</h2>
            <div className="card" style={{ overflowX: 'auto' }}>
              <table>
                <thead><tr><th>Participant</th><th>Équipe</th><th className="num">Km réels</th><th className="num">Km comptés</th><th className="num">Jours</th><th className="num">Plus longue</th><th className="num">Avant 8 h</th><th className="num">12h-14h</th><th className="num">Flash Hour</th><th className="num">D+</th><th className="num">Sem. 1 → en cours</th></tr></thead>
                <tbody>
                  {[...d.people].sort((x, y) => y.rawKm - x.rawKm).map((p) => {
                    const t = teamOf(p.participant.team_id);
                    return (
                      <tr key={p.participant.id}>
                        <td>{p.participant.display_name}</td><td>{t ? `${t.emoji} ${t.name}` : '—'}</td>
                        <td className="num">{fmtKm(p.rawKm)}</td><td className="num">{fmtKm(p.countedKm)}</td><td className="num">{p.activeDays}</td>
                        <td className="num">{fmtKm(p.longestKm)}</td><td className="num">{fmtKm(p.earlyKm)}</td><td className="num">{fmtKm(p.lunchKm)}</td>
                        <td className="num">{fmtKm(p.flashKm)}</td><td className="num">{p.elevationM} m</td>
                        <td className="num">{fmtKm(p.week1Km)} → {fmtKm(p.currentWeekKm)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="muted small">Réservé aux organisateurs : ces chiffres individuels ne sont pas publiés sur la plateforme.</p>
          </>
        );
      })()}

      {tab === 'recap' && (
        <>
          <h2>Récap du soir à coller dans ~runz</h2>
          <pre className="recap">{[
            `🏃 **RunZ · Récap du ${fmtDate(d.today)}** · semaine ${d.currentWeek} · J-${daysLeft(d.settings.end_date, d.today)}`,
            leadSentence(d.teams, d.mode),
            '',
            ...d.teams.map((t) => `${['🥇', '🥈', '🥉'][t.rank - 1] ?? '▫️'} ${t.team.emoji} **${t.team.name}** · ${fmtKm(t.totalKm)} km · ${fmtKm(t.avgKm)} km/pers. (+${fmtKm(t.todayKm)} km aujourd’hui)`),
            '',
            `⚡ Boost du jour : ${boostOfDay(d.boosts, d.today)}`,
            `Au total : ${fmtKm(d.teams.reduce((a, t) => a + t.totalKm, 0))} km parcourus ensemble 💪`,
            `Le classement en direct : ${appUrl()}`,
          ].join('\n')}</pre>
          <h2>Pas encore au compteur cette semaine</h2>
          <div className="card">
            {d.teams.map((t) => (
              <div className="kv" key={t.team.id}><span>{t.team.emoji} {t.team.name}</span><span>{t.notYetThisWeek} / {t.members}</span></div>
            ))}
          </div>
          <p className="muted small">Utile pour le boost « Tous au compteur » et les relances (sans nommer personne). Pense à resynchroniser avant de copier si un webhook a pu être manqué.</p>
        </>
      )}

      {tab === 'reglages' && (
        <>
          <h2>Challenge</h2>
          <form action={A.saveSettings} className="card inline">
            <label>Nom<input name="challenge_name" defaultValue={(d.settings as { challenge_name?: string }).challenge_name} /></label>
            <label>Début<input type="date" name="start_date" defaultValue={d.settings.start_date} /></label>
            <label>Fin<input type="date" name="end_date" defaultValue={d.settings.end_date} /></label>
            <label>Plafond km/jour<input name="daily_cap_km" defaultValue={d.settings.daily_cap_km} style={{ width: 70 }} /></label>
            <label>Plafond<select name="cap_mode" defaultValue={d.settings.cap_mode ?? 'alert'}><option value="alert">Alerte (comme l’Excel)</option><option value="cap">Coupe à {d.settings.daily_cap_km} km (km boostés d’abord)</option></select></label>
            <label>Classement<select name="ranking_mode" defaultValue={d.settings.ranking_mode ?? 'total'}><option value="total">Total</option><option value="average">Moyenne par personne</option></select></label>
            <input type="hidden" name="sprint_multiplier" value={d.settings.sprint_multiplier} />
            <fieldset style={{ border: 0, padding: 0, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {SPORTS.map((x) => (
                <label key={x} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <input type="checkbox" name="sport_types" value={x} defaultChecked={d.settings.sport_types.includes(x)} /> {SPORT_FR[x]}
                </label>
              ))}
            </fieldset>
            <button className="btn primary">Enregistrer</button>
          </form>
          <h2>Équipes</h2>
          <div className="card">
            {teamsAll.map((t) => (
              <form key={t.id} action={A.updateTeam} className="inline" style={{ marginBottom: 8 }}>
                <input type="hidden" name="id" value={t.id} />
                <input name="emoji" defaultValue={t.emoji} style={{ width: 50 }} />
                <input name="name" defaultValue={t.name} />
                <input type="color" name="color" defaultValue={t.color} />
                <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}><input type="checkbox" name="active" defaultChecked={t.active} /> active</label>
                <button className="btn small">OK</button>
              </form>
            ))}
          </div>
        </>
      )}
    </>
  );
}
