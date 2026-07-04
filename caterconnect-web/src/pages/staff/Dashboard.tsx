import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export default function StaffDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ pending: 0, consultations: 0, complaints: 0, bookings: 0, approved: 0, rejected: 0 });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [pendingRes, consultRes, complaintRes, bookingRes, approvedRes, rejectedRes, recentBookings, recentConsult] = await Promise.all([
        supabase.from('caterers').select('id', { count: 'exact', head: true }).eq('verification_status', 'pending'),
        supabase.from('consultations').select('id', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('complaints').select('id', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('bookings').select('id', { count: 'exact', head: true }),
        supabase.from('caterers').select('id', { count: 'exact', head: true }).eq('verification_status', 'approved'),
        supabase.from('caterers').select('id', { count: 'exact', head: true }).eq('verification_status', 'rejected'),
        supabase.from('bookings').select('id, status, created_at, profiles(full_name), caterers(business_name)').order('created_at', { ascending: false }).limit(4),
        supabase.from('consultations').select('id, subject, from_name, status, created_at').eq('status', 'open').order('created_at', { ascending: false }).limit(4),
      ]);

      setStats({
        pending: pendingRes.count ?? 0,
        consultations: consultRes.count ?? 0,
        complaints: complaintRes.count ?? 0,
        bookings: bookingRes.count ?? 0,
        approved: approvedRes.count ?? 0,
        rejected: rejectedRes.count ?? 0,
      });

      const activity = [
        ...(recentBookings.data ?? []).map((b: any) => ({
          icon: '📅', color: '#F97316', bg: '#FEF3E8',
          text: `${(b.profiles as any)?.full_name ?? '—'} booked ${(b.caterers as any)?.business_name ?? '—'}`,
          sub: `Status: ${b.status}`, time: b.created_at,
        })),
        ...(recentConsult.data ?? []).map((c: any) => ({
          icon: '💬', color: '#2563EB', bg: '#DBEAFE',
          text: `New consultation from ${c.from_name ?? '—'}`,
          sub: c.subject, time: c.created_at,
        })),
      ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 5);

      setRecentActivity(activity);
      setLoading(false);
    };
    load();
  }, []);

  const timeAgo = (ts: string) => {
    const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const cards = [
    { icon: '⏳', label: 'Pending Verifications', value: stats.pending,       color: '#D97706', bg: '#FEF3C7', path: '/staff/verification',  urgent: stats.pending > 0  },
    { icon: '💬', label: 'Open Consultations',    value: stats.consultations, color: '#2563EB', bg: '#DBEAFE', path: '/staff/consultations', urgent: stats.consultations > 0 },
    { icon: '🚨', label: 'Open Complaints',       value: stats.complaints,    color: '#DC2626', bg: '#FEE2E2', path: '/staff/complaints',    urgent: stats.complaints > 0 },
    { icon: '📅', label: 'Total Bookings',        value: stats.bookings,      color: '#16A34A', bg: '#DCFCE7', path: '/staff/bookings',      urgent: false },
  ];

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Staff Dashboard</h1>
          <p className="page-sub">Welcome back, {profile?.full_name?.split(' ')[0] ?? 'Staff'} 👋 — Here's your platform overview</p>
        </div>
        <div style={s.datePill}>
          {new Date().toLocaleDateString('en-PH', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}
        </div>
      </div>

      {/* Stat cards */}
      <div className="stat-grid">
        {cards.map((card) => (
          <div key={card.label} className="card stat-card"
            onClick={() => navigate(card.path)}
            style={{ cursor: 'pointer', position: 'relative', borderLeft: card.urgent ? `4px solid ${card.color}` : '1px solid #E8EAED', transition: 'transform 0.15s, box-shadow 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.10)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)'; }}>
            <div className="stat-icon" style={{ background: card.bg }}>{card.icon}</div>
            <div>
              <div className="stat-val" style={{ color: card.color }}>{loading ? '—' : card.value}</div>
              <div className="stat-lbl">{card.label}</div>
            </div>
            {card.urgent && card.value > 0 && (
              <div style={s.urgentDot} />
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, marginTop: 24 }}>
        {/* Quick actions */}
        <div>
          <h2 style={s.sectionTitle}>Quick Actions</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {[
              { icon: '✅', title: 'Review Applications',  desc: 'Check pending caterer verification requests', path: '/staff/verification',  color: '#D97706', bg: '#FEF3C7', count: stats.pending },
              { icon: '💬', title: 'Answer Consultations', desc: 'Respond to customer & caterer inquiries',     path: '/staff/consultations', color: '#2563EB', bg: '#DBEAFE', count: stats.consultations },
              { icon: '🚨', title: 'Handle Complaints',    desc: 'Investigate and resolve active disputes',     path: '/staff/complaints',    color: '#DC2626', bg: '#FEE2E2', count: stats.complaints },
              { icon: '📅', title: 'Monitor Bookings',     desc: 'Track all bookings across the platform',      path: '/staff/bookings',      color: '#16A34A', bg: '#DCFCE7', count: stats.bookings },
            ].map((a) => (
              <div key={a.title} className="card" style={{ cursor: 'pointer', transition: 'all 0.15s' }}
                onClick={() => navigate(a.path)}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: a.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                    {a.icon}
                  </div>
                  {a.count > 0 && (
                    <span style={{ background: a.color, color: 'white', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 900 }}>
                      {a.count}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#111', marginBottom: 4 }}>{a.title}</div>
                <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5, marginBottom: 12 }}>{a.desc}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: a.color }}>Open →</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Verification summary */}
          <div className="card">
            <h3 style={{ fontSize: 15, fontWeight: 900, marginBottom: 14 }}>✅ Verification Summary</h3>
            {[
              { label: 'Pending Review', value: stats.pending,   color: '#D97706' },
              { label: 'Approved',       value: stats.approved,  color: '#16A34A' },
              { label: 'Rejected',       value: stats.rejected,  color: '#DC2626' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #F1F3F5' }}>
                <span style={{ fontSize: 13, color: '#6B7280' }}>{item.label}</span>
                <span style={{ fontSize: 18, fontWeight: 900, color: item.color }}>{loading ? '—' : item.value}</span>
              </div>
            ))}
          </div>

          {/* Recent activity */}
          <div className="card" style={{ flex: 1 }}>
            <h3 style={{ fontSize: 15, fontWeight: 900, marginBottom: 14 }}>🕐 Recent Activity</h3>
            {loading ? (
              <div style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: '20px 0' }}>Loading...</div>
            ) : recentActivity.length === 0 ? (
              <div style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: '20px 0' }}>No recent activity</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {recentActivity.map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>
                      {item.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.text}</div>
                      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{item.sub} · {timeAgo(item.time)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  datePill: { background: 'white', border: '1px solid #E8E4DE', borderRadius: 20, padding: '8px 16px', fontSize: 13, color: '#6B7280' },
  sectionTitle: { fontSize: 17, fontWeight: 900, color: '#111', marginBottom: 14 },
  urgentDot: { position: 'absolute', top: 12, right: 12, width: 8, height: 8, borderRadius: '50%', background: '#DC2626' },
};