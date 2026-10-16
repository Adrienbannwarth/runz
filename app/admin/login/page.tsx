import { adminLogin } from '../actions';
import { getParticipantId } from '@/lib/session';

export default async function Login({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const loggedIn = !!(await getParticipantId());
  return (
    <div className="split">
      <div className="photo" role="img" aria-label="Portant de vêtements Colorz" />
      <div className="panel">
        <div>
          <p className="eyebrow">Espace organisateurs</p>
          <h1>Admin RunZ</h1>
          <p className="muted">Participants, saisie des km, bonus, boosts et récap du soir.</p>
          {sp.error && <div className="alert err">Mot de passe incorrect.</div>}
          {loggedIn && <div className="alert">Ton compte n’a pas accès à l’administration. Retrouve tes activités dans <a href="/me">Mon espace</a>.</div>}
          {!loggedIn && <div style={{ marginTop: 24 }}>
            <a className="btn primary" style={{ width: '100%' }} href="/api/strava/connect">Se connecter avec Strava</a>
            <p className="muted small">L’administration est réservée aux organisatrices et organisateurs. Une fois connecté·e, elle est accessible depuis « Mon espace ».</p>
          </div>}
          <details style={{ marginTop: 24 }}>
            <summary className="small muted" style={{ cursor: 'pointer' }}>Accès de secours par mot de passe</summary>
            <form action={adminLogin}>
              <label>Mot de passe organisateur<input type="password" name="password" required /></label>
              <button className="btn">Entrer</button>
            </form>
          </details>
        </div>
      </div>
    </div>
  );
}
