import 'server-only';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { db } from './db';

const USER_COOKIE = 'runz_session';
const ADMIN_COOKIE = 'runz_admin';
const secret = () => new TextEncoder().encode(process.env.SESSION_SECRET || 'dev-secret-change-me');

async function sign(payload: Record<string, unknown>, days: number) {
  return new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt()
    .setExpirationTime(`${days}d`).sign(secret());
}
async function read(name: string) {
  const token = (await cookies()).get(name)?.value;
  if (!token) return null;
  try { return (await jwtVerify(token, secret())).payload; } catch { return null; }
}
const opts = (days: number) => ({
  httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const,
  path: '/', maxAge: days * 86400,
});

export async function setUserSession(participantId: string) {
  (await cookies()).set(USER_COOKIE, await sign({ pid: participantId }, 60), opts(60));
}
export async function getParticipantId(): Promise<string | null> {
  const p = await read(USER_COOKIE);
  return (p?.pid as string) ?? null;
}
export async function clearUserSession() { (await cookies()).delete(USER_COOKIE); }

export async function setAdminSession() {
  (await cookies()).set(ADMIN_COOKIE, await sign({ admin: true }, 7), opts(7));
}
/** Connexion admin par mot de passe (accès de secours). */
export async function isPasswordAdmin(): Promise<boolean> {
  return (await read(ADMIN_COOKIE))?.admin === true;
}
/** Le participant connecté a-t-il le rôle admin ? */
export async function isParticipantAdmin(): Promise<boolean> {
  const pid = await getParticipantId();
  if (!pid) return false;
  const { data } = await db().from('participants').select('is_admin').eq('id', pid).maybeSingle();
  return data?.is_admin === true;
}
export async function isAdmin(): Promise<boolean> {
  return (await isParticipantAdmin()) || (await isPasswordAdmin());
}
export async function clearAdminSession() { (await cookies()).delete(ADMIN_COOKIE); }
