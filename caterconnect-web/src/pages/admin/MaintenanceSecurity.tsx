import { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Clock, Database, History, Loader2, RefreshCw, ShieldCheck, ShieldAlert, Wrench, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

type Settings = { id: string; maintenance_enabled: boolean; maintenance_message: string; estimated_end_at: string | null; updated_at: string; updated_by: string | null };
type Audit = { id: string; actor_id: string | null; action: string; details: Record<string, unknown> | null; created_at: string };
type Event = { id: string; action: string; reason: string | null; created_at: string; actor_id: string | null; user_id: string | null };
const card: React.CSSProperties = { background: '#FFF', border: '1px solid #E8E4DE', borderRadius: 20, padding: 24, boxShadow: '0 4px 16px rgba(0,0,0,.035)' };
const btn: React.CSSProperties = { border: 0, borderRadius: 11, padding: '11px 17px', fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 };
const field: React.CSSProperties = { width: '100%', border: '1px solid #D1D5DB', borderRadius: 10, padding: '11px 13px', fontSize: 14, outlineColor: '#F97316', background: '#FFF' };
const date = (v: string | null | undefined) => v ? new Date(v).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not set';
const toLocalDateTimeInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};
const formatAction = (v: string) => v.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
export default function MaintenanceSecurity() {
  const { profile } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [health, setHealth] = useState<'checking' | 'connected' | 'error'>('checking');
  const [healthTime, setHealthTime] = useState<string | null>(null);
  const [healthError, setHealthError] = useState('');
  const [securityError, setSecurityError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [message, setMessage] = useState('');
  const [reason, setReason] = useState('');
  const [endAt, setEndAt] = useState('');
  const [confirm, setConfirm] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    setError(''); setSecurityError(''); setHealth('checking'); setRefreshing(true);
    try {
      const [settingsRes, auditRes, eventRes] = await Promise.all([
        supabase.from('system_settings').select('id, maintenance_enabled, maintenance_message, estimated_end_at, updated_at, updated_by').eq('id', 'main').single(),
        supabase.from('system_audit_logs').select('id, actor_id, action, details, created_at').in('action', ['maintenance_enabled', 'maintenance_disabled', 'maintenance_deadline_session_started', 'maintenance_deadline_session_completed']).order('created_at', { ascending: false }).limit(15),
        supabase.from('account_monitoring_events').select('id, action, reason, created_at, actor_id, user_id').order('created_at', { ascending: false }).limit(10)
      ]);
      setHealthTime(new Date().toISOString());
      if (settingsRes.error) { setHealth('error'); setHealthError(settingsRes.error.message); setError('Unable to load maintenance settings: ' + settingsRes.error.message); }
      else {
        const row = settingsRes.data as Settings;
        setSettings(row); setMessage(row.maintenance_message); setEndAt(toLocalDateTimeInput(row.estimated_end_at)); setHealth('connected'); setHealthError('');
      }
      if (auditRes.error || eventRes.error) setSecurityError([auditRes.error?.message, eventRes.error?.message].filter(Boolean).join(' | '));
      setAudits((auditRes.data ?? []) as Audit[]);
      setEvents((eventRes.data ?? []) as Event[]);
    } catch (e) { setHealth('error'); setHealthError(String(e)); setError(String(e)); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const save = async () => {
    if (confirm === null || saving || !settings || profile?.role !== 'admin') return;
    const cleanMessage = message.trim(), cleanReason = reason.trim();
    if (cleanMessage.length < 10 || cleanMessage.length > 500) { setError('Maintenance message must be 10–500 characters.'); setConfirm(null); return; }
    if (cleanReason.length < 5 || cleanReason.length > 500) { setError('Change reason must be 5–500 characters.'); setConfirm(null); return; }
    let end: string | null = null;
    if (confirm && endAt) {
      const parsed = new Date(endAt);
      if (Number.isNaN(parsed.getTime())) { setError('Invalid estimated restoration date.'); setConfirm(null); return; }
      end = parsed.toISOString();
    }
    setSaving(true); setError(''); setNotice('');
    try {
      const { error: rpcError } = await supabase.rpc('set_maintenance_mode', {
        p_enabled: confirm,
        p_message: cleanMessage,
        p_reason: cleanReason,
        p_estimated_end_at: end
      });
      if (rpcError) throw rpcError;
      const enabled = confirm;
      setReason('');
      setConfirm(null);
      await load();
      setNotice(enabled
        ? 'Maintenance notice enabled successfully. Application operations are not automatically blocked.'
        : 'Maintenance notice disabled successfully.');
    } catch (e) {
      setError('Unable to change maintenance mode: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };
  const isAdmin = profile?.role === 'admin';
  return (
    <div style={{ paddingBottom: 40, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 26 }}>
        <div><h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 6, color: '#111' }}>Maintenance & Security</h1><p style={{ fontSize: 14, color: '#6B7280' }}>Manage maintenance settings, review system connectivity and monitor security activity.</p></div>
        <button style={{ ...btn, background: '#FFF', border: '1px solid #E5E7EB', color: '#374151' }} disabled={refreshing} onClick={() => void load()}><RefreshCw size={16} className={refreshing ? 'spin' : ''} /> Refresh</button>
      </div>
      {error && <div role="alert" style={{ padding: 15, marginBottom: 16, borderRadius: 12, background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' }}>{error}</div>}
      {notice && <div role="status" style={{ padding: 15, marginBottom: 16, borderRadius: 12, background: '#F0FDF4', color: '#166534', border: '1px solid #BBF7D0' }}>{notice}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18, marginBottom: 24 }}>
        <div style={card}><div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#6B7280', fontWeight: 700, fontSize: 13 }}><Wrench size={19} color="#F97316" /> Maintenance Status</div><div style={{ fontSize: 23, fontWeight: 900, marginTop: 16, color: settings?.maintenance_enabled ? '#B45309' : '#15803D' }}>{loading ? 'Loading...' : settings ? (settings.maintenance_enabled ? 'Enabled' : 'Disabled') : 'Unavailable'}</div></div>
        <div style={card}><div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#6B7280', fontWeight: 700, fontSize: 13 }}><Database size={19} color="#2563EB" /> Database Connection</div><div style={{ fontSize: 23, fontWeight: 900, marginTop: 16, color: health === 'connected' ? '#15803D' : health === 'error' ? '#DC2626' : '#6B7280' }}>{health === 'connected' ? 'Connected' : health === 'error' ? 'Check Failed' : 'Checking...'}</div><div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6 }}>Last checked: {date(healthTime)}</div></div>
        <div style={card}><div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#6B7280', fontWeight: 700, fontSize: 13 }}><ShieldCheck size={19} color="#7C3AED" /> Recent Admin Actions</div><div style={{ fontSize: 23, fontWeight: 900, marginTop: 16 }}>{audits.length}</div><div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6 }}>Maintenance-related records in the latest 15 results</div></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 370px), 1fr))', gap: 22, alignItems: 'start' }}>
        <section style={card}>
          <h2 style={{ fontSize: 19, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 }}><Wrench size={21} color="#F97316" /> Maintenance Mode</h2>
          <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, marginBottom: 19 }}>Configure the maintenance notice, optional restoration time, and reason for the change. All changes are recorded in the audit history.</p>
          <div style={{ padding: 12, borderRadius: 10, background: '#FFF7ED', border: '1px solid #FED7AA', fontSize: 12, color: '#9A3412', marginBottom: 18 }}><AlertTriangle size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />Maintenance Mode temporarily restricts customer and caterer access to the CaterConnect mobile application and displays a scheduled maintenance notice. Normal application access is restored when maintenance mode is disabled.</div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 800, marginBottom: 7 }}>Maintenance message</label>
          <textarea style={{ ...field, minHeight: 90, resize: 'vertical', marginBottom: 15 }} value={message} maxLength={500} onChange={e => setMessage(e.target.value)} disabled={!isAdmin || loading || saving || !settings} placeholder="Message shown during maintenance" />
          <label style={{ display: 'block', fontSize: 13, fontWeight: 800, marginBottom: 7 }}>Estimated restoration (optional)</label>
          <input type="datetime-local" style={{ ...field, marginBottom: 15 }} value={endAt} onChange={e => setEndAt(e.target.value)} disabled={!isAdmin || loading || saving || !settings} />
          <label style={{ display: 'block', fontSize: 13, fontWeight: 800, marginBottom: 7 }}>Reason for change (required)</label>
          <textarea style={{ ...field, minHeight: 70, resize: 'vertical', marginBottom: 17 }} value={reason} maxLength={500} onChange={e => setReason(e.target.value)} disabled={!isAdmin || loading || saving || !settings} placeholder="Explain why maintenance is being changed" />
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button style={{ ...btn, background: '#F97316', color: '#FFF', opacity: !settings || settings.maintenance_enabled ? .5 : 1 }} disabled={!isAdmin || !settings || saving || settings.maintenance_enabled} onClick={() => setConfirm(true)}><Wrench size={16} /> Enable Maintenance</button>
            <button style={{ ...btn, background: '#111827', color: '#FFF', opacity: !settings || !settings.maintenance_enabled ? .5 : 1 }} disabled={!isAdmin || !settings || saving || !settings.maintenance_enabled} onClick={() => setConfirm(false)}><CheckCircle2 size={16} /> Disable Maintenance</button>
          </div>
          <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 17 }}>Last changed: {date(settings?.updated_at)} · By: {settings?.updated_by ?? 'System'}</p>
        </section>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <section style={card}>
            <h2 style={{ fontSize: 19, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}><Activity size={21} color="#16A34A" /> System Health</h2>
            <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 12 }}>Basic Supabase connectivity check using the maintenance settings query. This does not test every Supabase service or production uptime.</p>
            <div style={{ color: health === 'connected' ? '#15803D' : '#DC2626', fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 9 }}>{health === 'connected' ? <CheckCircle2 size={18} /> : health === 'checking' ? <Loader2 size={18} className="spin" /> : <AlertTriangle size={18} />}{health === 'connected' ? 'Database query successful' : health === 'checking' ? 'Checking database...' : 'Database query failed'}</div>
            {healthError && <p style={{ fontSize: 12, color: '#B91C1C', marginTop: 9 }}>{healthError}</p>}
          </section>
          <section style={card}>
            <h2 style={{ fontSize: 19, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}><ShieldAlert size={21} color="#F97316" /> Security Overview</h2>
            <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 13 }}>Latest Staff account moderation events from your existing account monitoring log. This is not a failed-login or threat-detection feed.</p>
            {securityError && <p style={{ fontSize: 12, color: '#B91C1C', marginBottom: 10 }}>Some events could not be loaded: {securityError}</p>}
            {events.length === 0 ? <p style={{ color: '#9CA3AF', fontSize: 13 }}>No recent account monitoring events.</p> : events.map(e => <div key={e.id} style={{ borderTop: '1px solid #F3F4F6', padding: '11px 0' }}><div style={{ fontSize: 13, fontWeight: 800 }}>{formatAction(e.action)}</div><div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>{e.reason || 'No reason recorded'} · {date(e.created_at)}</div></div>)}
          </section>
        </div>
      </div>
      <section style={{ ...card, marginTop: 22 }}>
        <h2 style={{ fontSize: 19, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}><History size={21} color="#7C3AED" /> Maintenance Audit History</h2>
        <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>Up to 15 recent maintenance-related audit entries, recorded by the maintenance workflow.</p>
        {audits.length === 0 ? <p style={{ fontSize: 13, color: '#9CA3AF' }}>No maintenance changes recorded yet.</p> : <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th>Action</th><th>Reason</th><th>Administrator ID</th><th>Date</th></tr></thead><tbody>{audits.map(a => <tr key={a.id}><td style={{ fontWeight: 700 }}>{formatAction(a.action)}</td><td>{String(a.details?.reason ?? '—')}</td><td style={{ fontFamily: 'monospace', fontSize: 11 }}>{a.actor_id ?? '—'}</td><td>{date(a.created_at)}</td></tr>)}</tbody></table></div>}
      </section>
      {confirm !== null && <div role="presentation" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }}>
        <div role="dialog" aria-modal="true" aria-labelledby="maintenance-confirm-title" style={{ ...card, width: '100%', maxWidth: 470, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}><h2 id="maintenance-confirm-title" style={{ fontSize: 20, fontWeight: 900 }}>{confirm ? 'Enable Maintenance?' : 'Disable Maintenance?'}</h2><button aria-label="Close dialog" style={{ ...btn, background: '#F3F4F6', padding: 8 }} onClick={() => setConfirm(null)} disabled={saving}><X size={17} /></button></div>
          <p style={{ fontSize: 14, color: '#4B5563', lineHeight: 1.6, marginBottom: 14 }}>This action will update the maintenance flag and create a permanent audit entry. {confirm ? 'The maintenance notice will be enabled, but bookings and payments will not be automatically blocked.' : 'The maintenance flag will be cleared.'}</p>
          <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 18 }}><Clock size={14} style={{ verticalAlign: 'middle' }} /> Reason: {reason.trim() || 'Not provided'}</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}><button style={{ ...btn, background: '#F3F4F6' }} onClick={() => setConfirm(null)} disabled={saving}>Cancel</button><button style={{ ...btn, background: confirm ? '#F97316' : '#111827', color: '#FFF' }} disabled={saving} onClick={() => void save()}>{saving ? <Loader2 size={16} className="spin" /> : <ShieldCheck size={16} />}{saving ? 'Saving...' : 'Confirm Change'}</button></div>
        </div>
      </div>}
    </div>
  );
}
