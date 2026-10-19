import { createClient } from '@supabase/supabase-js';

// Retrieve Supabase environment variables
const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || 'https://fovnnhxhqfypiaiqxcif.supabase.co';
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvdm5uaHhocWZ5cGlhaXF4Y2lmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4NDAyNTYsImV4cCI6MjA5OTQxNjI1Nn0.9zMOWjWtnhCB4y7k4YXU13l3CLcfoULsOoGTwQMgty0';

// Create and export the Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
