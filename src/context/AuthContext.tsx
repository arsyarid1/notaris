import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User as UserType } from '../data/schemaData';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';

export interface AuthContextType {
  user: UserType | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  setUser: (user: UserType | null) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Sync profile from Supabase database
  const syncProfile = async (currentSession: Session | null): Promise<UserType | null> => {
    if (!currentSession?.user) {
      return null;
    }
    const authUser = currentSession.user;
    const email = authUser.email;

    try {
      if (email) {
        const { data: profile, error } = await supabase
          .from('users')
          .select('*')
          .eq('email', email)
          .maybeSingle();

        if (!error && profile) {
          try {
            localStorage.setItem('notaris_active_user', JSON.stringify(profile));
          } catch {}
          return profile as UserType;
        }

        const cleanPrefix = email.split('@')[0].toLowerCase();
        const { data: dbUserByUsername } = await supabase
          .from('users')
          .select('*')
          .ilike('username', cleanPrefix)
          .maybeSingle();

        if (dbUserByUsername) {
          try {
            localStorage.setItem('notaris_active_user', JSON.stringify(dbUserByUsername));
          } catch {}
          return dbUserByUsername as UserType;
        }
      }

      // Check by user ID in users table
      const { data: dbUserById } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (dbUserById) {
        try {
          localStorage.setItem('notaris_active_user', JSON.stringify(dbUserById));
        } catch {}
        return dbUserById as UserType;
      }

      // Construct a valid UserType object from session metadata so session remains valid
      const fallbackUser: UserType = {
        id: authUser.id,
        tenant_id: (authUser.user_metadata?.tenant_id) || 'a0000000-0000-0000-0000-000000000001',
        name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || email?.split('@')[0] || 'User',
        username: email ? email.split('@')[0] : 'user',
        email: email || '',
        role: (authUser.user_metadata?.role as any) || 'NOTARIS',
        password: ''
      };

      try {
        localStorage.setItem('notaris_active_user', JSON.stringify(fallbackUser));
      } catch {}
      return fallbackUser;
    } catch (err) {
      console.error('Error fetching user profile for session:', err);
      return {
        id: authUser.id,
        tenant_id: 'a0000000-0000-0000-0000-000000000001',
        name: authUser.user_metadata?.full_name || email?.split('@')[0] || 'User',
        username: email ? email.split('@')[0] : 'user',
        email: email || '',
        role: 'NOTARIS',
        password: ''
      };
    }
  };

  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (!isMounted) return;

        setSession(initialSession);
        if (initialSession) {
          const profile = await syncProfile(initialSession);
          if (isMounted) setUser(profile);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error('Error getting initial session:', err);
        if (isMounted) {
          setSession(null);
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      if (!isMounted) return;

      setSession(currentSession);
      if (currentSession) {
        const profile = await syncProfile(currentSession);
        if (isMounted) setUser(profile);
      } else {
        setUser(null);
        try {
          localStorage.removeItem('notaris_active_user');
        } catch {}
      }
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const refreshUser = async () => {
    if (session) {
      const profile = await syncProfile(session);
      setUser(profile);
    }
  };

  const signOut = async () => {
    try {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('sb-') || key.includes('auth-token') || key === 'notaris_active_user')) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
      } catch {}
      await supabase.auth.signOut({ scope: 'local' });
    } catch (err) {
      console.error('Error during signOut:', err);
    } finally {
      setUser(null);
      setSession(null);
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.history.replaceState(null, '', '/login');
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 font-sans text-slate-100">
        <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-4" />
        <span className="text-sm font-medium text-slate-300">Memuat sesi...</span>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut, setUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
