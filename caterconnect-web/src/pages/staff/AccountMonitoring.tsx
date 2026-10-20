import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  AlertTriangle, Ban, CheckCircle2, Flag, RefreshCw, Search,
  ShieldAlert, Users, Layers, AlertCircle, Calendar, X
} from 'lucide-react';

type Account = {
  id: string; full_name: string; email: string; role: 'customer' | 'caterer';
  status: string | null; caterer_id: string | null; business_name: string | null;
  account_standing: string | null; flagged: boolean; suspended: boolean;
  reason: string | null; updated_at: string | null;
  total_bookings: number; total_cancellations: number;
  cancellations_90d: number; bookings_90d: number; refund_disputes: number;
};
type Action = 'flag' | 'unflag' | 'suspend' | 'reactivate';

const fmt = (n: number) => Number(n || 0).toLocaleString('en-PH');

const getStatusIcon = (status: string, isActive: boolean = false) => {
  const colors: Record<string, string> = {
    all: '#2563EB',
    customer: '#0284C7',
    caterer: '#7C3AED',
    warning: '#D97706',
    flagged: '#D97706',
    suspended: '#DC2626'
  };
  const color = isActive ? '#FFFFFF' : (colors[status.toLowerCase()] || '#6B7280');

  switch (status.toLowerCase()) {
    case 'all': return <Layers size={14} color={color} style={{ verticalAlign: 'middle', marginRight: 6 }} />;
    case 'customer': return <Users size={14} color={color} style={{ verticalAlign: 'middle', marginRight: 6 }} />;
    case 'caterer': return <Users size={14} color={color} style={{ verticalAlign: 'middle', marginRight: 6 }} />;
    case 'warning': return <AlertCircle size={14} color={color} style={{ verticalAlign: 'middle', marginRight: 6 }} />;
    case 'flagged': return <Flag size={14} color={color} style={{ verticalAlign: 'middle', marginRight: 6 }} />;
    case 'suspended': return <Ban size={14} color={color} style={{ verticalAlign: 'middle', marginRight: 6 }} />;
    default: return <Layers size={14} color={color} style={{ verticalAlign: 'middle', marginRight: 6 }} />;
  }
};

export default function AccountMonitoring() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<'all' | 'customer' | 'caterer'>('all');
  const [filter, setFilter] = useState<'all' | 'warning' | 'flagged' | 'suspended'>('all');
  const [chosen, setChosen] = useState<{ account: Account; action: Action } | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [history, setHistory] = useState<{ id: string; action: string; reason: string; created_at: string }[]>([]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const { data, error: e } = await supabase.rpc('staff_account_monitoring_list');
      if (e) throw e;
      if (!Array.isArray(data)) throw new Error('Unexpected account monitoring response.');
      setAccounts(data as Account[]);
    } catch (e: any) { setError(e?.message || 'Unable to load accounts.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => accounts.filter(a => {
    const query = search.trim().toLowerCase();
    const warning = a.cancellations_90d >= 5;
    return (role === 'all' || a.role === role) &&
      (filter === 'all' || (filter === 'warning' && warning) ||
       (filter === 'flagged' && a.flagged) || (filter === 'suspended' && a.suspended)) &&
      (!query || [a.full_name, a.email, a.business_name, a.id].some(x => (x || '').toLowerCase().includes(query)));
  }), [accounts, role, filter, search]);

  const act = async () => {
    if (!chosen || reason.trim().length < 10 || saving) return;
    setSaving(true); setError('');
    try {
      const { error: e } = await supabase.rpc('staff_account_monitoring_action', {
        p_user_id: chosen.account.id, p_action: chosen.action, p_reason: reason.trim()
      });
      if (e) throw e;
      setChosen(null); setReason('');
      await load();
      setHistoryId(null); setHistory([]);
    } catch (e: any) { setError(e?.message || 'Unable to apply action.'); }
    finally { setSaving(false); }
  };

  const showHistory = async (id: string) => {
    if (historyId === id) { setHistoryId(null); setHistory([]); return; }
    setHistoryId(id); setHistory([]);
    const { data, error: e } = await supabase.from('account_monitoring_events')
      .select('id,action,reason,created_at').eq('user_id', id)
      .order('created_at', { ascending: false }).limit(30);
    if (e) setError(e.message);
    else setHistory(data || []);
  };

  const start = (account: Account, action: Action) => { setChosen({ account, action }); setReason(''); };
  const count = (f: 'warning' | 'flagged' | 'suspended') =>
    accounts.filter(a => f === 'warning' ? a.cancellations_90d >= 5 : f === 'flagged' ? a.flagged : a.suspended).length;

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", paddingBottom: 40, color: '#111827' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16, marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#111', margin: '0 0 6px', letterSpacing: '-0.5px' }}>Account Monitoring</h1>
          <p style={{ margin: 0, color: '#6B7280', fontSize: 15 }}>Review booking cancellations, flag accounts, and manage platform suspensions securely.</p>
        </div>
        <button 
          style={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: 12, padding: '10px 18px', cursor: 'pointer', fontWeight: 800, fontSize: 13, color: '#374151', display: 'inline-flex', alignItems: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.02)', transition: 'all 0.2s' }} 
          disabled={loading} 
          onClick={() => void load()}
        >
          <RefreshCw size={16} style={{ animation: loading ? 'spin 1s linear infinite' : 'none', verticalAlign: 'middle', marginRight: 8 }} />
          {loading ? 'Refreshing...' : 'Refresh accounts'}
        </button>
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', padding: 16, borderRadius: 16, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 600 }}>
          <AlertTriangle size={18} /> {error}
        </div>
      )}

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Accounts', n: accounts.length, icon: Users, color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
          { label: 'Cancellation Warnings', n: count('warning'), icon: AlertTriangle, color: '#D97706', bg: '#FEF3C7', border: '#FDE68A' },
          { label: 'Flagged Accounts', n: count('flagged'), icon: Flag, color: '#D97706', bg: '#FEF3C7', border: '#FDE68A' },
          { label: 'Suspended Accounts', n: count('suspended'), icon: Ban, color: '#DC2626', bg: '#FEE2E2', border: '#FECACA' }
        ].map(({ label, n, icon: Icon, color, bg, border }) => (
          <div key={label} style={{ background: '#FFF', border: `1px solid ${border}`, borderRadius: 20, padding: 20, display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: bg, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={24} />
            </div>
            <div>
              <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 800, textTransform: 'uppercase', display: 'block', marginBottom: 2, letterSpacing: 0.5 }}>{label}</span>
              <span style={{ fontSize: 24, fontWeight: 900, color: '#111' }}>{fmt(n)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Tabs & Search Bar */}
      <div style={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: 20, padding: 20, marginBottom: 24, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(['all', 'customer', 'caterer'] as const).map(r => {
              const isActive = role === r;
              return (
                <button key={r} onClick={() => setRole(r)}
                  style={{
                    padding: '9px 18px', borderRadius: 12, border: `1px solid ${isActive ? '#111' : '#E5E7EB'}`, fontSize: 13, fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s',
                    background: isActive ? '#111' : '#FFF',
                    color: isActive ? '#FFF' : '#374151',
                    boxShadow: isActive ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                    display: 'inline-flex', alignItems: 'center'
                  }}>
                  {getStatusIcon(r, isActive)}
                  {r === 'all' ? 'All Roles' : r === 'customer' ? 'Customers' : 'Caterers'}
                </button>
              );
            })}
          </div>

          <div style={{ position: 'relative', width: '100%', maxWidth: 360 }}>
            <Search size={18} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
            <input 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              placeholder="Search by name, business, email..."
              style={{ width: '100%', boxSizing: 'border-box', padding: '12px 16px 12px 44px', border: '1px solid #E5E7EB', borderRadius: 14, fontSize: 14, background: '#FFF', outline: 'none', color: '#111', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }} 
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 12, borderTop: '1px solid #F3F4F6' }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#6B7280', display: 'flex', alignItems: 'center', marginRight: 4 }}>Status Filter:</span>
          {(['all', 'warning', 'flagged', 'suspended'] as const).map(f => {
            const isActive = filter === f;
            return (
              <button key={f} onClick={() => setFilter(f)}
                style={{
                  padding: '7px 14px', borderRadius: 10, border: `1px solid ${isActive ? '#F97316' : '#E5E7EB'}`, fontSize: 12.5, fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s',
                  background: isActive ? '#FFF7ED' : '#FFF',
                  color: isActive ? '#C2410C' : '#4B5563',
                  display: 'inline-flex', alignItems: 'center'
                }}>
                {f !== 'all' && getStatusIcon(f, false)}
                {f === 'all' ? 'All Statuses' : f === 'warning' ? '5+ Cancellations / 90d' : f[0].toUpperCase() + f.slice(1)}
              </button>
            );
          })}
        </div>
      </div>

      <p style={{ color: '#6B7280', fontSize: 13, marginBottom: 20, fontWeight: 500 }}>
        ℹ️ Warnings are advisory only. Count includes Customer-initiated or Caterer-initiated cancellations. Staff must review context before taking action.
      </p>

      {/* Account Cards List */}
      <div style={{ display: 'grid', gap: 16 }}>
        {!loading && filtered.length === 0 && (
          <div style={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: 20, textAlign: 'center', padding: 60, color: '#6B7280' }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#111', marginBottom: 6 }}>No matching accounts found</div>
            <p style={{ margin: 0, fontSize: 14 }}>Try clearing search terms or changing your status filters.</p>
          </div>
        )}

        {filtered.map(a => {
          const isCaterer = a.role === 'caterer';
          const primaryName = isCaterer ? a.business_name || a.full_name : a.full_name;
          const isWarning = a.cancellations_90d >= 5;

          return (
            <div key={a.id} style={{ 
              background: '#FFF', 
              border: '1px solid #E5E7EB', 
              borderRadius: 20, 
              padding: 24, 
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)',
              borderLeft: a.suspended ? '5px solid #DC2626' : a.flagged || isWarning ? '5px solid #D97706' : '5px solid #16A34A',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                
                {/* User Info Section */}
                <div style={{ minWidth: 260, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: 17, fontWeight: 900, color: '#111', margin: 0 }}>{primaryName}</h3>
                    <span style={{ 
                      fontSize: 11, fontWeight: 800, textTransform: 'uppercase', padding: '3px 10px', borderRadius: 8, 
                      background: isCaterer ? '#F5F3FF' : '#EFF6FF', 
                      color: isCaterer ? '#7C3AED' : '#2563EB',
                      border: `1px solid ${isCaterer ? '#DDD6FE' : '#BFDBFE'}`
                    }}>
                      {a.role}
                    </span>
                    {isCaterer && a.business_name && (
                      <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>Owner: {a.full_name}</span>
                    )}
                  </div>
                  <div style={{ color: '#4B5563', fontSize: 13.5, marginBottom: 12, fontFamily: 'monospace' }}>{a.email}</div>

                  {/* Badges / Status Tags */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                    {a.cancellations_90d >= 10 && (
                      <span style={{ background: '#FEE2E2', color: '#991B1B', border: '1px solid #FECACA', padding: '4px 10px', borderRadius: 8, fontSize: 11.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <AlertTriangle size={12} /> High Cancellation Warning (10+ in 90d)
                      </span>
                    )}
                    {a.cancellations_90d >= 5 && a.cancellations_90d < 10 && (
                      <span style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A', padding: '4px 10px', borderRadius: 8, fontSize: 11.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <AlertTriangle size={12} /> Cancellation Warning (5+ in 90d)
                      </span>
                    )}
                    {a.flagged && (
                      <span style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A', padding: '4px 10px', borderRadius: 8, fontSize: 11.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Flag size={12} /> Flagged Account
                      </span>
                    )}
                    {a.suspended && (
                      <span style={{ background: '#FEE2E2', color: '#DC2626', border: '1px solid #FECACA', padding: '4px 10px', borderRadius: 8, fontSize: 11.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Ban size={12} /> Suspended
                      </span>
                    )}
                    {!a.flagged && !a.suspended && (
                      <span style={{ background: '#DCFCE7', color: '#166534', border: '1px solid #BBF7D0', padding: '4px 10px', borderRadius: 8, fontSize: 11.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <CheckCircle2 size={12} /> Account in Good Standing
                      </span>
                    )}
                  </div>

                  {/* Modern Metric Cards Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, background: '#F9FAFB', padding: 12, borderRadius: 14, border: '1px solid #E5E7EB' }}>
                    <div>
                      <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>Cancellations (90d)</span>
                      <span style={{ fontSize: 16, fontWeight: 900, color: a.cancellations_90d >= 5 ? '#DC2626' : '#111' }}>{fmt(a.cancellations_90d)}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>Lifetime Cancels</span>
                      <span style={{ fontSize: 16, fontWeight: 900, color: '#111' }}>{fmt(a.total_cancellations)}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>Total Bookings</span>
                      <span style={{ fontSize: 16, fontWeight: 900, color: '#2563EB' }}>{fmt(a.total_bookings)}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>Refund Disputes</span>
                      <span style={{ fontSize: 16, fontWeight: 900, color: a.refund_disputes > 0 ? '#D97706' : '#111' }}>{fmt(a.refund_disputes)}</span>
                    </div>
                  </div>

                  {a.reason && (
                    <div style={{ marginTop: 12, fontSize: 13, color: '#4B5563', background: '#FFFBEB', border: '1px solid #FEF3C7', padding: '8px 12px', borderRadius: 10 }}>
                      <strong style={{ color: '#92400E' }}>Last Staff Reason:</strong> {a.reason}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 150 }}>
                  <button 
                    style={{ background: '#FFF', border: '1px solid #D1D5DB', borderRadius: 10, padding: '10px 14px', cursor: 'pointer', fontWeight: 800, fontSize: 13, color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'background 0.2s' }} 
                    onClick={() => void showHistory(a.id)}
                  >
                    <ShieldAlert size={15} color="#4B5563" /> {historyId === a.id ? 'Hide History' : 'View History'}
                  </button>
                  <button 
                    style={{ background: '#FFF', border: '1px solid #D1D5DB', borderRadius: 10, padding: '10px 14px', cursor: 'pointer', fontWeight: 800, fontSize: 13, color: a.flagged ? '#D97706' : '#4B5563', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'background 0.2s' }} 
                    onClick={() => start(a, a.flagged ? 'unflag' : 'flag')}
                  >
                    <Flag size={15} color={a.flagged ? '#D97706' : '#4B5563'} /> {a.flagged ? 'Remove Flag' : 'Flag Account'}
                  </button>
                  <button 
                    style={{ 
                      background: a.suspended ? '#16A34A' : '#FEF2F2', 
                      border: `1px solid ${a.suspended ? '#16A34A' : '#FECACA'}`, 
                      borderRadius: 10, padding: '10px 14px', cursor: 'pointer', fontWeight: 800, fontSize: 13, 
                      color: a.suspended ? '#FFF' : '#DC2626', 
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.2s' 
                    }} 
                    onClick={() => start(a, a.suspended ? 'reactivate' : 'suspend')}
                  >
                    <Ban size={15} /> {a.suspended ? 'Reactivate Access' : 'Suspend Account'}
                  </button>
                </div>
              </div>

              {/* History Dropdown Section */}
              {historyId === a.id && (
                <div style={{ marginTop: 20, borderTop: '1px solid #E5E7EB', paddingTop: 16, background: '#F9FAFB', padding: 16, borderRadius: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: '#111', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Calendar size={15} color="#F97316" /> Recent Staff Audit History
                  </div>
                  {history.length === 0 && <p style={{ color: '#6B7280', fontSize: 13, margin: 0 }}>No audit actions recorded for this account.</p>}
                  <div style={{ display: 'grid', gap: 8 }}>
                    {history.map(h => (
                      <div key={h.id} style={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: 10, padding: 12, fontSize: 13 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontWeight: 800, color: h.action === 'suspend' ? '#DC2626' : h.action === 'flag' ? '#D97706' : '#16A34A', textTransform: 'uppercase' }}>
                            {h.action}
                          </span>
                          <span style={{ color: '#9CA3AF', fontSize: 12 }}>{new Date(h.created_at).toLocaleString('en-PH')}</span>
                        </div>
                        <div style={{ color: '#4B5563', whiteSpace: 'pre-wrap' }}>{h.reason}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Confirmation Modal */}
      {chosen && (
        <div role="presentation" style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: 20 }} onMouseDown={e => { if (e.target === e.currentTarget) setChosen(null); }}>
          <div role="dialog" aria-modal="true" aria-label="Confirm account action" style={{ background: '#FFF', borderRadius: 24, padding: 32, width: '100%', maxWidth: 480, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid #E5E7EB', paddingBottom: 16 }}>
              <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0, color: '#111', textTransform: 'capitalize' }}>Confirm {chosen.action}</h2>
              <button style={{ background: 'transparent', border: '1px solid #E5E7EB', borderRadius: '50%', width: 36, height: 36, display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#4B5563' }} onClick={() => setChosen(null)}>
                <X size={18} />
              </button>
            </div>

            <p style={{ color: '#4B5563', fontSize: 14, margin: '0 0 16px', lineHeight: 1.5 }}>
              Account: <strong style={{ color: '#111' }}>{chosen.account.full_name}</strong> ({chosen.account.role}). {chosen.action === 'suspend' ? 'Suspension blocks new bookings and certain booking status changes; existing refunds remain accessible.' : 'This action will be recorded permanently in the Staff audit history.'}
            </p>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 800, display: 'block', marginBottom: 6, color: '#374151' }}>Reason for action (at least 10 characters)</label>
              <textarea 
                value={reason} 
                onChange={e => setReason(e.target.value)} 
                maxLength={2000} 
                rows={4} 
                placeholder="Explain the evidence or reason for this action..."
                style={{ width: '100%', boxSizing: 'border-box', padding: 12, border: '1px solid #D1D5DB', borderRadius: 12, resize: 'vertical', fontFamily: 'inherit', fontSize: 14, outline: 'none', background: '#FFF', color: '#111' }} 
              />
            </div>

            <div style={{ display: 'flex', gap: 12, borderTop: '1px solid #E5E7EB', paddingTop: 16 }}>
              <button 
                style={{ flex: 1, padding: '12px 16px', background: '#F3F4F6', color: '#374151', border: '1px solid #E5E7EB', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }} 
                disabled={saving} 
                onClick={() => setChosen(null)}
              >
                Cancel
              </button>
              <button 
                style={{ 
                  flex: 1, padding: '12px 16px', 
                  background: chosen.action === 'suspend' ? '#DC2626' : '#111', 
                  color: '#FFF', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  opacity: saving || reason.trim().length < 10 ? 0.7 : 1 
                }}
                disabled={saving || reason.trim().length < 10} 
                onClick={() => void act()}
              >
                <CheckCircle2 size={16} /> {saving ? 'Saving...' : 'Confirm Action'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}