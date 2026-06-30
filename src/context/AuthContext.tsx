import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';

export interface AppUser {
  id: string;
  email?: string;
  fullName?: string;
  avatarUrl?: string;
  isGuest: boolean;
  createdAt: string;
}

interface AuthContextType {
  user: AppUser | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithEmail: (email: string) => Promise<{ error: any }>;
  signInAsGuest: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Load guest user from localStorage if it exists
  const getGuestUser = (): AppUser | null => {
    const saved = localStorage.getItem('guest_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      // Offline/Guest mode fallback
      const guest = getGuestUser();
      if (guest) {
        setUser(guest);
      }
      setLoading(false);
      return;
    }

    // Get active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email,
          fullName: session.user.user_metadata?.full_name,
          avatarUrl: session.user.user_metadata?.avatar_url,
          isGuest: false,
          createdAt: session.user.created_at,
        });
      } else {
        const guest = getGuestUser();
        if (guest) setUser(guest);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email,
          fullName: session.user.user_metadata?.full_name,
          avatarUrl: session.user.user_metadata?.avatar_url,
          isGuest: false,
          createdAt: session.user.created_at,
        });
        localStorage.removeItem('guest_user'); // Clear guest mode on login
      } else {
        const guest = getGuestUser();
        setUser(guest);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    if (!isSupabaseConfigured) {
      alert('Supabase is not configured. Google Sign-In is disabled.');
      return;
    }
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
  };

  const signInWithApple = async () => {
    if (!isSupabaseConfigured) {
      alert('Supabase is not configured. Apple Sign-In is disabled.');
      return;
    }
    await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: window.location.origin,
      },
    });
  };

  const signInWithEmail = async (email: string) => {
    if (!isSupabaseConfigured) {
      // Mock login for offline testing
      const mockUser: AppUser = {
        id: 'mock-user-id-' + Math.random().toString(36).substr(2, 9),
        email: email,
        fullName: email.split('@')[0],
        isGuest: false,
        createdAt: new Date().toISOString(),
      };
      setUser(mockUser);
      localStorage.setItem('guest_user', JSON.stringify(mockUser));
      return { error: null };
    }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    return { error };
  };

  const signInAsGuest = () => {
    const guestUser: AppUser = {
      id: 'guest-' + Math.random().toString(36).substr(2, 9),
      isGuest: true,
      createdAt: new Date().toISOString(),
    };
    setUser(guestUser);
    localStorage.setItem('guest_user', JSON.stringify(guestUser));
  };

  const signOut = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setSession(null);
    localStorage.removeItem('guest_user');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signInWithGoogle,
        signInWithApple,
        signInWithEmail,
        signInAsGuest,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
