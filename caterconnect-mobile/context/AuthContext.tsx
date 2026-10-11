// context/AuthContext.tsx
import { Session } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type Profile = {
  id: string;
  role: 'customer' | 'caterer' | 'staff' | 'admin';
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
  session: null, profile: null, catererData: null, loading: true,
  reloadProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [catererData, setCatererData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) setProfile(data);

    if (data?.role === 'caterer') {
      let { data: caterer } = await supabase
        .from('caterers')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (caterer) {
        const now = new Date();
        let updates: any = {};
        let needsUpdate = false;

        // 1. Check and revert expired subscriptions to free
        if (caterer.subscription_plan && caterer.subscription_plan !== 'free' && caterer.subscription_expires_at) {
          const expiresAt = new Date(caterer.subscription_expires_at);
          if (expiresAt < now) {
            updates.subscription_plan = 'free';
            updates.subscription_expires_at = null;
            caterer.subscription_plan = 'free';
            caterer.subscription_expires_at = null;
            needsUpdate = true;
          }
        }

        // 2. Check and reset monthly booking count if a new month has started
        const resetAt = caterer.booking_count_reset_at ? new Date(caterer.booking_count_reset_at) : null;
        if (!resetAt || now >= resetAt) {
          // Calculate the 1st day of next month for the next reset milestone
          const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          
          updates.monthly_booking_count = 0;
          updates.booking_count_reset_at = nextReset.toISOString();

          caterer.monthly_booking_count = 0;
          caterer.booking_count_reset_at = nextReset.toISOString();
          needsUpdate = true;
        }

        // Apply updates to Supabase if any rule triggered
        if (needsUpdate) {
          await supabase
            .from('caterers')
            .update(updates)
            .eq('id', caterer.id);
        }
      }

      setCatererData(caterer ?? null);
    }
  };

  useEffect(() => {
    if (!session?.user) { setProfile(null); setCatererData(null); return; }
    fetchProfile(session.user.id);
  }, [session]);

  const reloadProfile = async () => {
    if (!session?.user) return;
    await fetchProfile(session.user.id);
  };

  return (
    <AuthContext.Provider value={{ session, profile, catererData, loading, reloadProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);