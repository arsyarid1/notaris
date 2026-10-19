import { createClient } from '@supabase/supabase-js';

// Retrieve Supabase environment variables dynamically from Vercel / Vite env
const supabaseUrl =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_URL) ||
  (import.meta as any).env?.VITE_SUPABASE_URL ||
  'https://notaris-db.arsyaridwan.com/';

const supabaseAnonKey =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvdm5uaHhocWZ5cGlhaXF4Y2lmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4NDAyNTYsImV4cCI6MjA5OTQxNjI1Nn0.9zMOWjWtnhCB4y7k4YXU13l3CLcfoULsOoGTwQMgty0';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and Anon Key must be defined in environment variables.');
}

// Create and export the Supabase client with standard browser persistence
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export default supabase;
