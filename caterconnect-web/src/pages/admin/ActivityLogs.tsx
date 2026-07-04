import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function ActivityLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Aggregate recent activity from multiple tables
    const load = async () => {
      const [bookings, payments, caterers, complaints, consultations] = await Promise.all([
        supabase.from('bookings').select('id, status, created_at, profiles(full_name), caterers(business_name)').order('created_at', { ascending: false }).limit(15),
        supabase.from('subscription_payments').select('id, plan_id, amount, confirmed_at, caterers(business_name)').eq('status', 'confirmed').order('confirmed_at', { ascending: false }).limit(10),
        supabase.from('caterers').select('id, business_name, verification_status, reviewed_at').not('reviewed_at', 'is', null).order('reviewed_at', { ascending: false }).limit(10),
        supabase.from('complaints').select('id, subject, status, created_at, profiles(full_name)').order('created_at', { ascending: false }).limit(10),
        supabase.from('consultations').select('id, topic, status, created_at, profiles(full_name)').order('created_at', { ascending: false }).limit(10),
      ]);

      const combined: any[] = [
        ...(bookings.data ?? []).map(b => ({ type: 'booking', icon: '📅', color: '#F97316', bg: '#FEF3E8', time: b.created_at, text: `New booking from ${(b.profiles as any)?.full_name ?? '—'} to ${(b.caterers as any)?.business_name ?? '—'}`, sub: `Status: ${b.status}` })),
        ...(payments.data ?? []).map(p => ({ type: 'payment', icon: '💳', color: '#16A34A', bg: '#DCFCE7', time: p.confirmed_at, text: `${(p.caterers as any)?.business_name ?? '—'} subscribed to ${p.plan_id} plan`, sub: `₱${Number(p.amount).toLocaleString()}` })),
        ...(caterers.data ?? []).map(c => ({ type: 'verification', icon: c.verification_status === 'approved' ? '✅' : '❌', color: c.verification_status === 'approved' ? '#16A34A' : '#DC2626', bg: c.verification_status === 'approved' ? '#DCFCE7' : '#FEE2E2', time: c.reviewed_at, text: `${c.business_name} was ${c.verification_status}`, sub: 'Caterer verification' })),
        ...(complaints.data ?? []).map(c => ({ type: 'complaint', icon: '🚨', color: '#DC2626', bg: '#FEE2E2', time: c.created_at, text: `Complaint filed: "${c.subject ?? '—'}"`, sub: `By ${(c.profiles as any)?.full_name ?? '—'} — ${c.status}` })),
        ...(consultations.data ?? []).map(c => ({ type: 'consultation', icon: '💬', color: '#2563EB', bg: '#DBEAFE', time: c.created_at, text: `Consultation: ${c.topic ?? '—'}`, sub: `By ${(c.profiles as any)?.full_name ?? '—'} — ${c.status}` })),
      ].sort((a, b) => new Date(b.time ?? 0).getTime() - new Date(a.time ?? 0).getTime()).slice(0, 50);

      setLogs(combined);
      setLoading(false);
    };
    load();
  }, []);

  const timeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Activity Logs</h1>
          <p className="page-sub">Recent platform events — bookings, payments, verifications, complaints</p>
        </div>
        <button className="btn btn-outline" onClick={() => window.location.reload()}>🔄 Refresh</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="empty-state"><div className="empty-state-icon">⏳</div><div className="empty-state-sub">Loading activity...</div></div>
        ) : logs.length === 0 ? (
          <div className="empty-state"><div className="empty-state-icon">🕵️</div><div className="empty-state-title">No activity yet</div><div className="empty-state-sub">Events will appear here as the platform is used.</div></div>
        ) : (
          <div style={{ padding: '8px 0' }}>
            {logs.map((log, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 24px', borderBottom: i < logs.length - 1 ? '1px solid #F1F3F5' : 'none' }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: log.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                  {log.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 3 }}>{log.text}</div>
                  <div style={{ fontSize: 12, color: '#9CA3AF' }}>{log.sub}</div>
                </div>
                <div style={{ fontSize: 12, color: '#9CA3AF', whiteSpace: 'nowrap', marginTop: 2 }}>
                  {log.time ? timeAgo(log.time) : '—'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}