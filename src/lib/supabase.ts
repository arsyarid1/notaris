import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://notaris-db.arsyaridwan.com';
const DEFAULT_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvdm5uaHhocWZ5cGlhaXF4Y2lmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4NDAyNTYsImV4cCI6MjA5OTQxNjI1Nn0.9zMOWjWtnhCB4y7k4YXU13l3CLcfoULsOoGTwQMgty0';

const rawUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_SUPABASE_URL : undefined) ||
  DEFAULT_SUPABASE_URL;

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY : undefined) ||
  DEFAULT_ANON_KEY;

const supabaseUrl = (rawUrl || DEFAULT_SUPABASE_URL).replace(/\/+$/, '');

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export default supabase;