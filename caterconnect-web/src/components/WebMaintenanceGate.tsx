import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, ShieldCheck, Wrench } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

type MaintenanceSettings = {
  maintenance_enabled: boolean;
  maintenance_message: string | null;
  estimated_end_at: string | null;
};
type GateStatus = 'checking' | 'available' | 'maintenance' | 'error';

/**
 * Place INSIDE existing protected route(s), not around the login/password-reset routes.
 * Existing role checks remain responsible for admitting staff/admin to their routes.
 * This component blocks Customer/Caterer UI access during maintenance, including
 * direct navigation to a protected URL and already-open sessions.
 * This is a UI gate; server-side RLS/Edge/RPC policies still govern data writes.
 */
export default function WebMaintenanceGate({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const role = profile?.role;
  const privileged = role === 'admin' || role === 'staff';
  const [status, setStatus] = useState<GateStatus>('checking');
  const [settings, setSettings] = useState<MaintenanceSettings | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const checkSequence = useRef(0);

  const refresh = useCallback(async (manual = false) => {
    const sequence = ++checkSequence.current;
    if (manual) setRefreshing(true);
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('maintenance_enabled, maintenance_message, estimated_end_at')
        .eq('id', 'main')
        .single();
      if (error || !data) throw error ?? new Error('Maintenance settings unavailable');
      if (sequence !== checkSequence.current) return;
      const next = data as MaintenanceSettings;
      setSettings(next);
      setStatus(next.maintenance_enabled ? 'maintenance' : 'available');
    } catch {
      if (sequence !== checkSequence.current) return;
      // Fail closed for customers/caterers: no access if status cannot be checked.
      setStatus('error');
    } finally {
      if (sequence === checkSequence.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onFocus = () => { void refresh(); };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    const timer = window.setInterval(() => void refresh(), 15_000);
    return () => {
      checkSequence.current += 1;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refresh]);

  // Staff/Admin remain on their existing restricted web routes during maintenance.
  // Do not use this exception to grant access to a route without its own role guard.
  if (privileged) return <>{children}</>;

  if (status === 'available') return <>{children}</>;

  const activeMaintenance = status === 'maintenance';
  const until = settings?.estimated_end_at ? new Date(settings.estimated_end_at) : null;
  const endLabel = until && !Number.isNaN(until.getTime())
    ? until.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' })
    : null;

  return (
    <main style={{ minHeight: '100vh', padding: '36px 18px', background: '#FFF8F3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <section role={activeMaintenance ? 'status' : 'alert'} style={{ width: '100%', maxWidth: 480, padding: '38px 30px', background: '#fff', borderRadius: 22, border: '1px solid #FED7AA', boxShadow: '0 12px 40px rgba(124,45,18,.08)', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 22, color: '#EA580C', fontWeight: 900, letterSpacing: 2 }}>CATERCONNECT</div>
        <div style={{ color: '#EA580C', display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          {activeMaintenance ? <Wrench size={42} /> : status === 'error' ? <AlertTriangle size={42} /> : <ShieldCheck size={42} />}
        </div>
        <h1 style={{ fontSize: 25, margin: '0 0 14px', color: '#1F2937' }}>
          {status === 'checking' ? 'Checking Platform Status' : activeMaintenance ? 'Scheduled Maintenance' : 'Connection Unavailable'}
        </h1>
        <p style={{ lineHeight: 1.65, color: '#64748B', marginBottom: 18 }}>
          {status === 'checking'
            ? 'Preparing your CaterConnect experience.'
            : activeMaintenance
              ? settings?.maintenance_message || 'CaterConnect is temporarily undergoing maintenance. Please check again later.'
              : 'The platform status could not be checked. Please check your connection and try again.'}
        </p>
        {activeMaintenance && endLabel && <p style={{ color: '#475569', fontSize: 13 }}>Estimated restoration: <strong>{endLabel} (Philippine time)</strong></p>}
        <button type="button" onClick={() => void refresh(true)} disabled={refreshing} style={{ border: 0, borderRadius: 12, padding: '13px 22px', background: '#F97316', color: 'white', fontWeight: 700, cursor: refreshing ? 'wait' : 'pointer', display: 'inline-flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
          <RefreshCw size={17} /> {refreshing ? 'Checking…' : 'Check Again'}
        </button>
        <p style={{ color: '#94A3B8', fontSize: 12, marginTop: 20 }}>Your existing account and booking records are preserved.</p>
      </section>
    </main>
  );
}
