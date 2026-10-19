import { createClient } from '@supabase/supabase-js';

// Fallback token valid dari CT Supabase Proxmox
const DEFAULT_SUPABASE_URL = 'https://notaris-db.arsyaridwan.com';
const DEFAULT_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1cGFiYXNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDQwNjcyMDAsImV4cCI6MjA4Mjc1ODQwMH0.fet8lvjxsWIMboeMm6dlf_1uIQe9ZmPFjtXUt2bLKhY';

// Evaluasi environment variable untuk Vite & Next.js tanpa trailing slash
const rawUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_SUPABASE_URL : undefined) ||
  DEFAULT_SUPABASE_URL;

const supabaseUrl = rawUrl.replace(/\/+$/, '');

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY : undefined) ||
  DEFAULT_ANON_KEY;

// Debug log verifikasi token di browser console
if (typeof window !== 'undefined') {
  console.log(
    `[Supabase Client] URL: ${supabaseUrl} | Key Prefix: ${supabaseAnonKey.slice(0, 10)}... | Key Suffix: ...${supabaseAnonKey.slice(-10)}`
  );
}

// Fungsi pembersihan sesi kadaluwarsa saat 401
export const cleanCorruptSession = async () => {
  try {
    console.warn('[Supabase Client] 401 terdeteksi. Membersihkan sesi lokal...');
    if (typeof window !== 'undefined') {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('sb-') || key.includes('auth-token')) {
          localStorage.removeItem(key);
        }
      });
      localStorage.removeItem('notaris_active_user');
    }
    await supabase.auth.signOut({ scope: 'local' });
  } catch (err) {
    console.warn('[Supabase Client] Gagal membersihkan sesi:', err);
  }
};

// Inisialisasi Supabase Client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    fetch: async (url, options = {}) => {
      const response = await fetch(url, options);
      if (response.status === 401) {
        console.warn(`[Supabase 401 Unauthorized] URL: ${url}`);
        const headers = (options.headers as any) || {};
        const authHeader = headers.Authorization || headers.authorization;
        if (authHeader && !authHeader.includes(supabaseAnonKey)) {
          cleanCorruptSession();
        }
      }
      return response;
    },
  },
});

export default supabase;