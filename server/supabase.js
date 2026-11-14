import { createClient } from '@supabase/supabase-js';

export const supabaseConfigured = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY);
export function createUserClient(accessToken) {
  if (!supabaseConfigured) throw new Error('Supabase belum dikonfigurasi. Periksa SUPABASE_URL dan SUPABASE_PUBLISHABLE_KEY di .env.');
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
export function createPublicClient() {
  if (!supabaseConfigured) throw new Error('Supabase belum dikonfigurasi.');
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
