import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://notaris-db.arsyaridwan.com';
const DEFAULT_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1cGFiYXNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDQwNjcyMDAsImV4cCI6MjA4Mjc1ODQwMH0.fet8lvjxsWIMboeMm6dlf_1uIQe9ZmPFjtXUt2bLKhY';

const rawUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_SUPABASE_URL : undefined) ||
  DEFAULT_SUPABASE_URL;

const supabaseUrl = rawUrl.replace(/\/+$/, '');

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY : undefined) ||
  DEFAULT_ANON_KEY;

if (typeof window !== 'undefined') {
  console.log(
    `[Supabase Client] URL: ${supabaseUrl} | Key: ...${supabaseAnonKey.slice(-10)}`
  );
}

// Inisialisasi murni tanpa custom global fetch interceptor
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export default supabase;