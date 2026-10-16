import { createClient } from '@supabase/supabase-js';

// import.meta.env is Vite's; under plain Node (tests, scripts) it is undefined and Vult runs as demo.
const env = import.meta.env ?? {};
const url = env.VITE_SUPABASE_URL;
// New projects issue a publishable key (sb_publishable_...); older ones an anon key. Either works.
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;

/**
 * True when Vult is connected to a Supabase project.
 * Without keys the app runs entirely on its built-in demo data, so it opens with zero setup.
 */
export const isLive = Boolean(url && key);

export const supabase = isLive
  ? createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    })
  : null;
