import { useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { AppState } from 'react-native';

// Read-only fallback polling needs no Realtime publication/RLS changes.
// Reload on tab focus and foreground, and while the visible screen is active.
export function useBookingRefresh(identity: string | null, refresh: () => Promise<void>) {
  const latest = useRef(refresh);
  latest.current = refresh;
  useFocusEffect(useCallback(() => {
    if (!identity) return;
    let active = true;
    let running = false;
    const reload = async () => {
      if (!active || running || AppState.currentState !== 'active') return;
      running = true;
      try { await latest.current(); }
      catch { console.warn('Booking refresh unavailable. Try refreshing again.'); }
      finally { running = false; }
    };
    void reload();
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void reload(); });
    const timer = setInterval(() => { void reload(); }, 15000);
    return () => { active = false; clearInterval(timer); listener.remove(); };
  }, [identity]));
}
