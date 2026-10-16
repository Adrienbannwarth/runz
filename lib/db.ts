import 'server-only';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/** Client Supabase serveur (clé service_role). Ne jamais importer côté navigateur. */
export function db(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants');
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

/** Lève une erreur lisible si Supabase renvoie une erreur. */
export function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}
