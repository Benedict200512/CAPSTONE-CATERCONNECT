
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type Profile = {
  id: string;
  role: 'customer' | 'caterer' | 'staff' | 'admin';
  full_name: string;
  email: string;
  avatar_url?: string | null;
  status?: string | null;
};

export type CatererData = {
  id: string;
  user_id: string;
  business_name: string;
  business_description: string | null;
  logo_url: string | null;
  cover_photo_url: string | null;
  verification_status: string;
  subscription_plan: string;
  subscription_expires_at: string | null;
  avg_rating: number | null;
  review_count: number | null;
  account_standing: string | null;
  rejection_reason: string | null;
  city: string | null;
  address: string | null;
};

type AuthContextType = {
  session: Session | null;
  profile: Profile | null;
  catererData: CatererData | null;
  loading: boolean;
  reloadAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  profile: null,
  catererData: null,
  loading: true,
  reloadAccount: async () => {},
});

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [catererData, setCatererData] =
    useState<CatererData | null>(null);
  const [loading, setLoading] = useState(true);

  // Load the user's profile and caterer business record.
  const reloadAccount = useCallback(async () => {
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError) throw sessionError;

    const currentSession = sessionData.session;

    setSession(currentSession);

    if (!currentSession?.user) {
      setProfile(null);
      setCatererData(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const { data: profileData, error: profileError } =
        await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentSession.user.id)
          .single();

      if (profileError) throw profileError;

      setProfile(profileData);

      if (profileData.role === 'caterer') {
        const { data: businessData, error: businessError } =
          await supabase
            .from('caterers')
            .select('*')
            .eq('user_id', currentSession.user.id)
            .maybeSingle();

        if (businessError) throw businessError;

        setCatererData(businessData);
      } else {
        setCatererData(null);
      }
    } catch (error) {
      console.error('Account loading error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get the current session and listen for authentication changes.
  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;

      if (error) {
        console.error('Session error:', error);
      }

      setSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Load account data whenever the authenticated session changes.
  useEffect(() => {
    let active = true;

    async function loadAccount() {
      if (!session?.user) {
        setProfile(null);
        setCatererData(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const { data: profileData, error: profileError } =
          await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

        if (profileError) throw profileError;

        if (!active) return;

        setProfile(profileData);

        if (profileData.role === 'caterer') {
          const { data: businessData, error: businessError } =
            await supabase
              .from('caterers')
              .select('*')
              .eq('user_id', session.user.id)
              .maybeSingle();

          if (businessError) throw businessError;

          if (!active) return;

          setCatererData(businessData);
        } else {
          setCatererData(null);
        }
      } catch (error) {
        console.error('Account loading error:', error);

        if (active) {
          setProfile(null);
          setCatererData(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadAccount();

    return () => {
      active = false;
    };
  }, [session]);

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        catererData,
        loading,
        reloadAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
