import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Calendar, CreditCard, ShieldCheck, ShieldAlert, MessageSquare, 
  RefreshCw, Activity, AlertCircle, Filter, Clock 
} from 'lucide-react';

export default function ActivityLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const load = async () => {
    setLoading(true);
    const [bookings, payments, caterers, complaints, consultations] = await Promise.all([
      supabase.from('bookings').select('id, status, created_at, profiles(full_name), caterers(business_name)').order('created_at', { ascending: false }).limit(15),
      supabase.from('subscription_payments').select('id, plan_id, amount, confirmed_at, caterers(business_name)').eq('status', 'confirmed').order('confirmed_at', { ascending: false }).limit(10),
      supabase.from('caterers').select('id, business_name, verification_status, reviewed_at').not('reviewed_at', 'is', null).order('reviewed_at', { ascending: false }).limit(10),
      supabase.from('complaints').select('id, subject, status, created_at, profiles(full_name)').order('created_at', { ascending: false }).limit(10),
      supabase.from('consultations').select('id, topic, status, created_at, profiles(full_name)').order('created_at', { ascending: false }).limit(10),
    ]);

    const combined: any[] = [
      ...(bookings.data ?? []).map(b => ({ category: 'bookings', type: 'booking', icon: Calendar, color: '#F97316', bg: '#FFF7ED', border: '#FFEDD5', time: b.created_at, text: `New booking requested`, entity: `${(b.profiles as any)?.full_name ?? '—'} → ${(b.caterers as any)?.business_name ?? '—'}`, sub: `Status: ${b.status}` })),
      ...(payments.data ?? []).map(p => ({ category: 'payments', type: 'payment', icon: CreditCard, color: '#16A34A', bg: '#DCFCE7', border: '#BBF7D0', time: p.confirmed_at, text: `Subscription payment confirmed`, entity: `${(p.caterers as any)?.business_name ?? '—'}`, sub: `${p.plan_id.toUpperCase()} Plan • ₱${Number(p.amount).toLocaleString()}` })),
      ...(caterers.data ?? []).map(c => ({ category: 'system', type: 'verification', icon: c.verification_status === 'approved' ? ShieldCheck : ShieldAlert, color: c.verification_status === 'approved' ? '#16A34A' : '#DC2626', bg: c.verification_status === 'approved' ? '#DCFCE7' : '#FEE2E2', border: c.verification_status === 'approved' ? '#BBF7D0' : '#FECACA', time: c.reviewed_at, text: `Caterer verification ${c.verification_status}`, entity: c.business_name, sub: 'System Security' })),
      ...(complaints.data ?? []).map(c => ({ category: 'system', type: 'complaint', icon: AlertCircle, color: '#DC2626', bg: '#FEE2E2', border: '#FECACA', time: c.created_at, text: `New complaint filed: "${c.subject ?? '—'}"`, entity: `By ${(c.profiles as any)?.full_name ?? '—'}`, sub: `Status: ${c.status}` })),
      ...(consultations.data ?? []).map(c => ({ category: 'system', type: 'consultation', icon: MessageSquare, color: '#2563EB', bg: '#DBEAFE', border: '#BFDBFE', time: c.created_at, text: `Consultation requested: ${c.topic ?? '—'}`, entity: `By ${(c.profiles as any)?.full_name ?? '—'}`, sub: `Status: ${c.status}` })),
    ].sort((a, b) => new Date(b.time ?? 0).getTime() - new Date(a.time ?? 0).getTime()).slice(0, 50);

    setLogs(combined);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const timeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const filteredLogs = logs.filter(log => filter === 'all' || log.category === filter);

  return (
    <div>
      {/* Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: '#111', marginBottom: 6 }}>Activity Logs</h1>
          <p style={{ fontSize: 14, color: '#6B7280' }}>A real-time timeline of all critical platform events.</p>
        </div>
        <button 
          onClick={load}
          disabled={loading}
          style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 10, padding: '9px 16px', fontSize: 13, color: '#111', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.02)', opacity: loading ? 0.7 : 1 }}
        >
          <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> 
          {loading ? 'Refreshing...' : 'Refresh Logs'}
        </button>
      </div>

      <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        
        {/* Filters Bar */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Filter size={16} color="#9CA3AF" />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#6B7280', marginRight: 8 }}>Filter by:</span>
          {['all', 'bookings', 'payments', 'system'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, textTransform: 'capitalize', border: 'none', cursor: 'pointer', transition: 'all 0.2s ease',
                background: filter === f ? '#111' : '#F3F4F6',
                color: filter === f ? '#FFF' : '#4B5563',
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Logs Timeline */}
        <div style={{ padding: '24px', position: 'relative' }}>
          {loading && logs.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <Activity size={32} color="#F97316" style={{ animation: 'spin 1s linear infinite' }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: '#9CA3AF' }}>Compiling platform activity...</div>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={28} color="#9CA3AF" />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#111', marginBottom: 4 }}>No activity found</div>
                <div style={{ fontSize: 13, color: '#6B7280' }}>Try adjusting your filters or refresh the page.</div>
              </div>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              {/* Vertical connecting line for timeline */}
              <div style={{ position: 'absolute', top: 20, bottom: 20, left: 23, width: 2, background: '#E5E7EB', zIndex: 0 }} />
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {filteredLogs.map((log, i) => {
                  const Icon = log.icon;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 20, position: 'relative', zIndex: 1 }}>
                      
                      {/* Timeline Icon */}
                      <div style={{ width: 48, height: 48, borderRadius: '50%', background: log.bg, border: `4px solid #FFFFFF`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 0 0 1px ${log.border}` }}>
                        <Icon size={20} color={log.color} />
                      </div>
                      
                      {/* Content Card */}
                      <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: '#F9FAFB', padding: '16px 20px', borderRadius: 12, border: '1px solid #F3F4F6', transition: 'background 0.2s', cursor: 'default' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#F3F4F6')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#F9FAFB')}>
                        
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{ fontSize: 14, fontWeight: 800, color: '#111' }}>{log.text}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: log.bg, color: log.color, textTransform: 'uppercase', letterSpacing: 0.5 }}>{log.category}</span>
                          </div>
                          <div style={{ fontSize: 13, color: '#4B5563', marginBottom: 4 }}>
                            {log.entity}
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF' }}>
                            {log.sub}
                          </div>
                        </div>

                        {/* Timestamp */}
                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 800, color: log.color, background: log.bg, padding: '4px 10px', borderRadius: 8 }}>
                            {log.time ? timeAgo(log.time) : '—'}
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 500, color: '#9CA3AF', marginTop: 4 }}>
                            {log.time ? new Date(log.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''}
                          </span>
                        </div>

                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}