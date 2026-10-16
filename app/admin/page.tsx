import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/session';
import { appUrl } from '@/lib/strava';
import { fmtDate, fmtKm, loadAll } from '@/lib/data';
import * as A from './actions';

export const dynamic = 'force-dynamic';

const TABS = [
  ['participants', 'Participants'], ['saisie', 'Saisie manuelle'], ['bonus', 'Bonus'],
  ['boosts', 'Boosts'], ['mvp', 'MVP'], ['recap', 'Récap zlack'], ['reglages', 'Réglages'],
] as const;
const SPORTS = ['Walk', 'Run', 'TrailRun', 'Hike', 'VirtualRun', 'Wheelchair'];
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
        <form action={A.adminLogout}><button className="btn small">Déconnexion admin</button></form>
      </div>
      <nav className="tabs">
        {TABS.map(([k, label]) => <Link key={k} href={`/admin?tab=${k}`} className={tab === k ? 'on' : ''}>{label}</Link>)}
      </nav>
      {sp.msg && <div className="alert ok">{sp.msg}</div>}

      {tab === 'participants' && (
        <>
          <h2>Participants ({d.participants.length})</h2>
          <div className="card" style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>Nom · équipe</th><th>Strava</th><th className="num">Km comptés</th><th>Lien d’invitation</th><th></th></tr></thead>
              <tbody>
                {d.participants.map((p) => {
                  const st = d.people.find((x) => x.participant.id === p.id);
                  return (
                    <tr key={p.id}>
                      <td>
                        <form action={A.updateParticipant} className="inline">
                          <input type="hidden" name="id" value={p.id} />
                          <input name="display_name" defaultValue={p.display_name} style={{ width: 170 }} />
                          <select name="team_id" defaultValue={p.team_id ?? ''}>
                            <option value="">— sans équipe —</option>
                            {teamsAll.map((t) => <option key={t.id} value={t.id}>{t.emoji} {t.name}{t.active ? '' : ' (inactive)'}</option>)}
                          </select>
                          <button className="btn small">OK</button>
                        </form>
                      </td>
                      <td>{p.strava_athlete_id ? <span className="pill">✅ connecté</span> : <span className="pill">—</span>}
                        {p.last_sync_at && <div className="small muted">{new Date(p.last_sync_at).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' })}</div>}
                      </td>
                      <td className="num">{fmtKm(st?.countedKm ?? 0)}</td>
                      <td><input readOnly value={`${appUrl()}/join/${p.invite_token}`} style={{ width: 220, fontSize: 12 }} /></td>
                      <td>
                        <form action={A.deleteParticipant}><input type="hidden" name="id" value={p.id} /><button className="btn small danger">Suppr.</button></form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <form action={A.syncAll}><button className="btn primary">↻ Resynchroniser tous les comptes Strava</button></form>
          </div>
          <h2>Ajouter des participants</h2>
          <form action={A.createParticipant} className="card inline">
            <label>Noms (un par ligne)<textarea name="names" rows={4} cols={32} placeholder={'Adrien Bannwarth\nAnne Denis'} /></label>
            <label>Équipe
              <select name="team_id"><option value="">— sans équipe —</option>{allTeams.map((t) => <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>)}</select>
            </label>
            <button className="btn primary">Ajouter</button>
          </form>
          <p className="muted small">Chaque participant reçoit un lien d’invitation personnel : en se connectant à Strava via ce lien, son compte est rattaché à sa fiche et à son équipe. Une personne qui se connecte sans lien apparaît ici « sans équipe ».</p>
        </>
      )}

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
          <p className="muted small">L’heure compte pour les boosts horaires (Flash HourZ…). Le plafond journalier s’applique aussi.</p>
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
                    <td><form action={A.deleteActivity}><input type="hidden" name="id" value={a.id} /><button className="btn small danger">Suppr.</button></form></td>
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
          <p className="muted small">Repères du kit : Photo couleur +10 km/membre · Tous au compteur +30 km · Sortie commune +20 km · ParrainZ +10 km · Z Strava Art +25 km. Les bonus s’ajoutent au total de l’équipe, puis sont divisés par le nombre de membres.</p>
          <h2>Bonus attribués</h2>
          <div className="card" style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>Date</th><th>Équipe</th><th>Membre</th><th>Motif</th><th className="num">Km</th><th></th></tr></thead>
              <tbody>
                {d.bonuses.map((b) => (
                  <tr key={b.id}>
                    <td>{fmtDate(b.awarded_on)}</td><td>{teamsAll.find((t) => t.id === b.team_id)?.name}</td>
                    <td>{pName(b.participant_id)}</td><td>{b.reason}</td><td className="num">+{fmtKm(Number(b.km))}</td>
                    <td><form action={A.deleteBonus}><input type="hidden" name="id" value={b.id} /><button className="btn small danger">Suppr.</button></form></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'boosts' && (
        <>
          <h2>Programmer un boost horaire</h2>
          <form action={A.addBoost} className="card inline">
            <label>Nom<input name="name" required defaultValue="Flash HourZ" /></label>
            <label>Jour<input type="date" name="date" required defaultValue={d.today} /></label>
            <label>De<input type="time" name="start" required defaultValue="19:00" /></label>
            <label>À<input type="time" name="end" required defaultValue="22:00" /></label>
            <label>Jusqu’au (si plusieurs jours)<input type="date" name="end_date" /></label>
            <label>Multiplicateur<input name="multiplier" defaultValue="2" style={{ width: 60 }} /></label>
            <button className="btn primary">Programmer</button>
          </form>
          <p className="muted small">Une activité est boostée si elle démarre dans la fenêtre. Les multiplicateurs ne se cumulent pas (le plus fort s’applique). Le Sprint final (dernier jour) se règle dans Réglages.</p>
          <div className="card" style={{ marginTop: 12 }}>
            <table>
              <thead><tr><th>Boost</th><th>Début</th><th>Fin</th><th className="num">×</th><th></th></tr></thead>
              <tbody>
                {d.boosts.map((b) => (
                  <tr key={b.id}>
                    <td>{b.name}</td><td>{fmtDate(b.starts_at)} {b.starts_at.slice(11, 16)}</td><td>{fmtDate(b.ends_at)} {b.ends_at.slice(11, 16)}</td>
                    <td className="num">{b.multiplier}</td>
                    <td><form action={A.deleteBoost}><input type="hidden" name="id" value={b.id} /><button className="btn small danger">Suppr.</button></form></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'mvp' && (
        <>
          <h2>Prix MVP (vue organisateurs)</h2>
          <div className="card" style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>Participant</th><th>Équipe</th><th className="num">Km comptés<br />KilomètreZ</th><th className="num">Jours actifs<br />Métronome</th><th className="num">D+<br />Mollets d’acier</th><th className="num">Km avant 8 h<br />Lève-tôt</th><th className="num">Km boostés<br />Flash Hour</th></tr></thead>
              <tbody>
                {[...d.people].sort((a, b) => b.countedKm - a.countedKm).map((p) => {
                  const t = d.teams.find((x) => x.team.id === p.participant.team_id)?.team;
                  const flash = d.scored.filter((s) => s.participant_id === p.participant.id && s.eligible && s.boostName && s.boostName !== 'Sprint final')
                    .reduce((acc, s) => acc + s.cappedKm, 0);
                  return (
                    <tr key={p.participant.id}>
                      <td>{p.participant.display_name}</td><td>{t ? `${t.emoji} ${t.name}` : '—'}</td>
                      <td className="num">{fmtKm(p.countedKm)}</td><td className="num">{p.activeDays}</td>
                      <td className="num">{p.elevationM} m</td><td className="num">{fmtKm(p.earlyKm)}</td><td className="num">{fmtKm(flash)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="muted small">Réservé aux organisateurs : ces chiffres individuels ne sont pas publiés sur la plateforme.</p>
        </>
      )}

      {tab === 'recap' && (
        <>
          <h2>Récap du soir à coller dans ~runz</h2>
          <pre className="recap">{[
            `🏃 **RunZ · Récap du ${fmtDate(d.today)}**`,
            '',
            ...d.teams.map((t) => `${['🥇', '🥈', '🥉'][t.rank - 1] ?? '▫️'} ${t.team.emoji} **${t.team.name}** · ${fmtKm(t.avgKm)} km/pers. (+${fmtKm(t.todayKm)} km aujourd’hui)`),
            '',
            `Au total : ${fmtKm(d.teams.reduce((a, t) => a + t.totalKm, 0))} km parcourus ensemble 💪`,
            `Le classement en direct : ${appUrl()}`,
          ].join('\n')}</pre>
          <p className="muted small">Pense à resynchroniser avant de copier (onglet Participants) si un webhook a pu être manqué.</p>
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
            <label>Sprint final ×<input name="sprint_multiplier" defaultValue={d.settings.sprint_multiplier} style={{ width: 60 }} /></label>
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
