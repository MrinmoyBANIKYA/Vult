import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.117.1';

/**
 * A client that acts as the calling user, so every query is filtered by row-level security.
 * Edge functions never need the service role for user actions.
 */
export function userClient(req: Request): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set');
  return createClient(url, key, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
