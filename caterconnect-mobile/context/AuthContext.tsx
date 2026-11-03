import { Session } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type Profile = {
  id: string;
  role: 'customer' | 'caterer' | 'staff' | 'admin';
  status: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  phone_number: string | null;
  address: string | null;
};

type AuthContextType = {
  session: Session | null;
  profile: Profile | null;
  catererData: any | null;
  loading: boolean;
  reloadProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  profile: null,
  catererData: null,
  loading: true,
  reloadProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [catererData, setCatererData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);

  // Get the profile and caterer information for the logged-in user.
  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Profile loading error:', error.message);
      setProfile(null);
      setCatererData(null);
      return;
    }

    if (!data) {
      console.error('No profile found for user:', userId);
      setProfile(null);
      setCatererData(null);
      return;
    }

    setProfile(data as Profile);

    if (data.role === 'caterer') {
      const { data: caterer, error: catererError } = await supabase
        .from('caterers')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (catererError) {
        console.error('Caterer loading error:', catererError.message);
      }

      setCatererData(caterer ?? null);
    } else {
      setCatererData(null);
    }
  };

  // Listen for login, logout, and session changes.
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (!mounted) return;

      if (error) {
        console.error('Session loading error:', error.message);
      }

      setSession(data.session);
      setAuthReady(true);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;

      // Keep the layouts from redirecting while the new profile loads.
      setLoading(true);
      setSession(newSession);
      setAuthReady(true);
    });

    initializeAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Load the profile only after the authentication state is known.
  useEffect(() => {
    if (!authReady) return;

    let active = true;

    const loadUserProfile = async () => {
      if (!session?.user) {
        setProfile(null);
        setCatererData(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        await fetchProfile(session.user.id);
      } catch (error) {
        console.error('Unable to load user profile:', error);
        if (active) {
          setProfile(null);
          setCatererData(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadUserProfile();

    return () => {
      active = false;
    };
  }, [session, authReady]);

  // Silent background reload: Updates profile and caterer data without unmounting tab layouts.
  const reloadProfile = async () => {
    if (!session?.user) return;

    try {
      await fetchProfile(session.user.id);
    } catch (error) {
      console.error('Silent profile reload error:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{ session, profile, catererData, loading, reloadProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
