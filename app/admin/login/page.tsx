import { adminLogin } from '../actions';

export default async function Login({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  return (
    <div className="split">
      <div className="photo" role="img" aria-label="Portant de vêtements Colorz" />
      <div className="panel">
        <div>
          <p className="eyebrow">Espace organisateurs</p>
          <h1>Admin RunZ</h1>
          <p className="muted">Participants, saisie des km, bonus, boosts et récap du soir.</p>
          {sp.error && <div className="alert err">Mot de passe incorrect.</div>}
          <form action={adminLogin}>
            <label>Mot de passe organisateur<input type="password" name="password" required autoFocus /></label>
            <button className="btn primary">Se connecter</button>
          </form>
        </div>
      </div>
    </div>
  );
}
