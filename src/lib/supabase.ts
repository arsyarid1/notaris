import { createClient } from '@supabase/supabase-js';

// Retrieve Supabase environment variables dynamically from Vercel / Vite env
const supabaseUrl =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_URL) ||
  (import.meta as any).env?.VITE_SUPABASE_URL ||
  'https://notaris-db.arsyaridwan.com/';

const supabaseAnonKey =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
  '';

// Debug log for verifying environment variables in browser console
if (typeof window !== 'undefined') {
  console.log(
    `[Supabase Client] URL: ${supabaseUrl} | Anon Key: ${
      supabaseAnonKey
        ? `${supabaseAnonKey.slice(0, 8)}...${supabaseAnonKey.slice(-6)} (length: ${supabaseAnonKey.length})`
        : 'EMPTY/MISSING!'
    }`
  );
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Supabase URL or Anon Key is missing! Pastikan VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY (atau NEXT_PUBLIC_SUPABASE_*) terdefinisi di Environment Variables Vercel/Cloudflare.'
  );
}

// Function to cleanly purge stale or corrupt auth sessions when 401 Unauthorized occurs
export const cleanCorruptSession = async () => {
  try {
    console.warn('[Supabase Client] 401 Unauthorized detected. Purging invalid/corrupt session tokens...');
    if (typeof window !== 'undefined') {
      // Remove any supabase auth tokens from localStorage
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('sb-') || key.includes('auth-token')) {
          localStorage.removeItem(key);
        }
      });
      // Clear active user session if invalidated
      localStorage.removeItem('notaris_active_user');
    }
    await supabase.auth.signOut({ scope: 'local' });
  } catch (err) {
    console.warn('[Supabase Client] Error during session cleanup:', err);
  }
};

// Create and export the Supabase client with standard browser persistence
export const supabase = createClient(supabaseUrl, supabaseAnonKey || 'dummy-anon-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    fetch: async (url, options = {}) => {
      const response = await fetch(url, options);
      if (response.status === 401) {
        console.warn(`[Supabase 401 Unauthorized] on URL: ${url}`);
        // If a request returns 401 and had an Authorization Bearer header that is not the anon key,
        // it means the user's JWT session is expired/invalid on this database instance.
        const authHeader = (options.headers as any)?.Authorization || (options.headers as any)?.authorization;
        if (authHeader && !authHeader.includes(supabaseAnonKey)) {
          cleanCorruptSession();
        }
      }
      return response;
    },
  },
});

export default supabase;

