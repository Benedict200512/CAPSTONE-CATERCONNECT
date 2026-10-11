import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock, MessageCircle, AlertTriangle, Calendar,
  CheckCircle2, ShieldCheck, History, Loader2, ArrowRight, Banknote
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export default function StaffDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ 
    pending: 0, consultations: 0, complaints: 0, bookings: 0, approved: 0, rejected: 0, refunds: 0, pendingBookings: 0 
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [
        pendingRes, consultRes, complaintRes, bookingRes, 
        approvedRes, rejectedRes, refundRes, pendingBookingsRes, recentBookings, recentConsult
      ] = await Promise.all([
        supabase.from('caterers').select('id', { count: 'exact', head: true }).eq('verification_status', 'pending'),
        supabase.from('consultations').select('id', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('complaints').select('id', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('bookings').select('id', { count: 'exact', head: true }),
        supabase.from('caterers').select('id', { count: 'exact', head: true }).eq('verification_status', 'approved'),
        supabase.from('caterers').select('id', { count: 'exact', head: true }).eq('verification_status', 'rejected'),
        supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('refund_status', 'pending'),
        supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'pending'), // Fetch actual pending bookings
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
        refunds: refundRes.count ?? 0,
        pendingBookings: pendingBookingsRes.count ?? 0,
      });

      const activity = [
        ...(recentBookings.data ?? []).map((b: any) => ({
          Icon: Calendar, color: '#F97316', bg: '#FFF7ED', border: '#FFEDD5',
          text: `${(b.profiles as any)?.full_name ?? '—'} booked ${(b.caterers as any)?.business_name ?? '—'}`,
          sub: `Status: ${b.status}`, time: b.created_at,
        })),
        ...(recentConsult.data ?? []).map((c: any) => ({
          Icon: MessageCircle, color: '#2563EB', bg: '#DBEAFE', border: '#BFDBFE',
          text: `Consultation from ${c.from_name ?? '—'}`,
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
    if (m < 1) return 'Just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const cards = [
    { Icon: Clock, label: 'Pending Verifications', value: stats.pending, color: '#D97706', bg: '#FEF3C7', accent: 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)', path: '/staff/verification', urgent: stats.pending > 0 },
    { Icon: AlertTriangle, label: 'Open Complaints', value: stats.complaints, color: '#DC2626', bg: '#FEE2E2', accent: 'linear-gradient(135deg, #DC2626 0%, #F87171 100%)', path: '/staff/complaints', urgent: stats.complaints > 0 },
    { Icon: MessageCircle, label: 'Open Consultations', value: stats.consultations, color: '#2563EB', bg: '#DBEAFE', accent: 'linear-gradient(135deg, #2563EB 0%, #60A5FA 100%)', path: '/staff/consultations', urgent: stats.consultations > 0 },
    { Icon: Calendar, label: 'Total Bookings', value: stats.bookings, color: '#16A34A', bg: '#DCFCE7', accent: 'linear-gradient(135deg, #16A34A 0%, #4ADE80 100%)', path: '/staff/bookings', urgent: false },
    { Icon: Banknote, label: 'Pending Refunds', value: stats.refunds, color: '#9333EA', bg: '#F3E8FF', accent: 'linear-gradient(135deg, #9333EA 0%, #A855F7 100%)', path: '/staff/refunds', urgent: stats.refunds > 0 },
  ];

  const actions = [
    { Icon: CheckCircle2, title: 'Review Applications', desc: 'Process pending caterer verification queues', path: '/staff/verification', color: '#D97706', bg: '#FEF3C7', count: stats.pending },
    { Icon: AlertTriangle, title: 'Handle Complaints', desc: 'Investigate and resolve active platform disputes', path: '/staff/complaints', color: '#DC2626', bg: '#FEE2E2', count: stats.complaints },
    { Icon: MessageCircle, title: 'Answer Consultations', desc: 'Respond to customer and vendor inquiries', path: '/staff/consultations', color: '#2563EB', bg: '#DBEAFE', count: stats.consultations },
    { Icon: Calendar, title: 'Monitor Bookings', desc: 'Track event statuses across the marketplace', path: '/staff/bookings', color: '#16A34A', bg: '#DCFCE7', count: stats.pendingBookings }, // Now uses actual pending bookings count
    { Icon: Banknote, title: 'Process Refunds', desc: 'Manage and disburse pending customer refunds', path: '/staff/refunds', color: '#9333EA', bg: '#F3E8FF', count: stats.refunds },
  ];

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#111', marginBottom: 6, letterSpacing: '-0.5px' }}>
            Welcome back, {profile?.full_name?.split('  ')[0] ?? 'Staff'}! 👋
          </h1>
          <p style={{ fontSize: 15, color: '#6B7280', margin: 0 }}>
            Here is your live operations and queue overview for today.
          </p>
        </div>
        <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 999, padding: '8px 20px', fontSize: 13, color: '#4B5563', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <Calendar size={16} color="#F97316" />
          {new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* Primary KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
        {cards.map((card, i) => {
          const Icon = card.Icon;
          return (
            <div key={i} onClick={() => navigate(card.path)} style={{ position: 'relative', background: '#FFFFFF', borderRadius: 20, padding: 20, border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -2px rgba(0,0,0,0.02)', cursor: 'pointer', transition: 'all 0.2s ease', overflow: 'hidden' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 20px -3px rgba(0,0,0,0.08)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.02)'; }}>
              
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: card.accent }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, marginTop: 4 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={20} color={card.color} />
                </div>
                {card.urgent && card.value > 0 && (
                  <span style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', padding: '4px 8px', borderRadius: 20, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Action
                  </span>
                )}
              </div>
              
              <div>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#111', letterSpacing: '-1px', marginBottom: 4 }}>
                  {loading ? <Loader2 size={20} className="animate-spin" color="#9CA3AF" /> : card.value}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#6B7280' }}>{card.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Content Split Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
        
        {/* Left Column: Quick Operations Grid */}
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 900, color: '#111', marginBottom: 20, letterSpacing: '-0.5px' }}>Quick Operations</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {actions.map((a, i) => {
              const ActionIcon = a.Icon;
              return (
                <div key={i} onClick={() => navigate(a.path)} style={{ background: '#FFFFFF', borderRadius: 20, padding: 24, border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.06)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.02)'; }}>
                  
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 14, background: a.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ActionIcon size={22} color={a.color} />
                      </div>
                      {a.count > 0 && (
                        <span style={{ background: a.bg, color: a.color, border: `1px solid ${a.color}40`, borderRadius: 20, padding: '4px 10px', fontSize: 12, fontWeight: 900 }}>
                          {a.count} pending
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: '#111', marginBottom: 6 }}>{a.title}</div>
                    <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.5, marginBottom: 16 }}>{a.desc}</div>
                  </div>

                  <div style={{ fontSize: 13, fontWeight: 800, color: a.color, display: 'flex', alignItems: 'center', gap: 4 }}>
                    Access Queue <ArrowRight size={14} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Verification Summary & Recent Activity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Verification Breakdown Widget */}
          <div style={{ background: '#FFFFFF', borderRadius: 20, border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', padding: 24 }}>
            <h3 style={{ fontSize: 18, fontWeight: 900, color: '#111', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 20px 0', letterSpacing: '-0.5px' }}>
              <ShieldCheck size={20} color="#111" /> Verification Breakdown
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'Pending Review', value: stats.pending, color: '#D97706', bg: '#FEF3C7', border: '#FDE68A' },
                { label: 'Approved Vendors', value: stats.approved, color: '#16A34A', bg: '#DCFCE7', border: '#BBF7D0' },
                { label: 'Rejected Applications', value: stats.rejected, color: '#DC2626', bg: '#FEE2E2', border: '#FECACA' },
              ].map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: item.bg, borderRadius: 14, border: `1px solid ${item.border}` }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: item.color }}>{item.label}</span>
                  <span style={{ fontSize: 18, fontWeight: 900, color: item.color }}>{loading ? '—' : item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Live Activity Feed */}
          <div style={{ background: '#FFFFFF', borderRadius: 20, border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', padding: 24, flex: 1 }}>
            <h3 style={{ fontSize: 18, fontWeight: 900, color: '#111', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 20px 0', letterSpacing: '-0.5px' }}>
              <History size={20} color="#111" /> Recent Operations
            </h3>
            {loading ? (
              <div style={{ fontSize: 14, color: '#9CA3AF', textAlign: 'center', padding: '40px 0' }}>Loading activity logs...</div>
            ) : recentActivity.length === 0 ? (
              <div style={{ fontSize: 14, color: '#9CA3AF', textAlign: 'center', padding: '40px 0' }}>No recent marketplace activity recorded.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {recentActivity.map((item, i) => {
                  const ItemIcon = item.Icon;
                  return (
                    <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', paddingBottom: i === recentActivity.length - 1 ? 0 : 16, borderBottom: i === recentActivity.length - 1 ? 'none' : '1px solid #F3F4F6' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: item.bg, border: `1px solid ${item.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <ItemIcon size={16} color={item.color} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>{item.text}</div>
                        <div style={{ fontSize: 12, color: '#6B7280', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>{item.sub}</span>
                          <span style={{ fontWeight: 600, color: '#9CA3AF' }}>{timeAgo(item.time)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}