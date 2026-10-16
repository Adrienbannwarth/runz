import { adminLogin } from '../actions';

export default async function Login({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  return (
    <>
      <h1>Admin</h1>
      {sp.error && <div className="alert">Mot de passe incorrect.</div>}
      <form action={adminLogin} className="card inline">
        <label>Mot de passe organisateur<input type="password" name="password" required autoFocus /></label>
        <button className="btn primary">Entrer</button>
      </form>
    </>
  );
}
