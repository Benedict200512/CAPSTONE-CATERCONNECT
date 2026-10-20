import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, CheckCircle2, Clock, Calendar, Wallet, UserCog, Activity, CreditCard, TrendingUp,
  ArrowRight, ShieldAlert, Store, Loader2, Sparkles, Zap, Crown, Building2
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export default function AdminDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalUsers: 0,
    caterers: 0,
    verified: 0,
    pending: 0,
    bookings: 0,
    revenue: 0,
    complaints: 0,
    userTrend: '+0 this month',
    catererTrend: '+0 this month',
    bookingTrend: '+0 this month',
    revenueTrend: '₱0 new',
  });
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const now = new Date();
      const startCurr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [
        totalUsersRes,
        caterersRes,
        bookingsRes,
        usersCurr,
        caterersCurr,
        bookingsCurr,
        revAll,
        revCurr,
        verifiedRes,
        pendingRes,
        complaintsRes,
        users
      ] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('caterers').select('id', { count: 'exact', head: true }),
        supabase.from('bookings').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', startCurr),
        supabase.from('caterers').select('id', { count: 'exact', head: true }).gte('created_at', startCurr),
        supabase.from('bookings').select('id', { count: 'exact', head: true }).gte('created_at', startCurr),
        supabase.from('subscription_payments').select('amount').eq('status', 'confirmed'),
        supabase.from('subscription_payments').select('amount').eq('status', 'confirmed').gte('created_at', startCurr),
        supabase.from('caterers').select('id', { count: 'exact', head: true }).eq('verification_status', 'approved'),
        supabase.from('caterers').select('id', { count: 'exact', head: true }).eq('verification_status', 'pending'),
        supabase.from('complaints').select('id', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('profiles').select('id, full_name, email, role, created_at, avatar_url').order('created_at', { ascending: false }).limit(5),
      ]);

      const totalRevenue = (revAll.data ?? []).reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);
      const revenueCurrTotal = (revCurr.data ?? []).reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);

      setStats({
        totalUsers: totalUsersRes.count ?? 0,
        caterers: caterersRes.count ?? 0,
        verified: verifiedRes.count ?? 0,
        pending: pendingRes.count ?? 0,
        bookings: bookingsRes.count ?? 0,
        revenue: totalRevenue,
        complaints: complaintsRes.count ?? 0,
        userTrend: `+${usersCurr.count ?? 0} this month`,
        catererTrend: `+${caterersCurr.count ?? 0} this month`,
        bookingTrend: `+${bookingsCurr.count ?? 0} this month`,
        revenueTrend: `₱${revenueCurrTotal.toLocaleString()} new`,
      });
      setRecentUsers(users.data ?? []);
      setLoading(false);
    };
    load();
  }, []);

  const roleColor: Record<string, string> = {
    customer: '#2563EB', caterer: '#7C3AED', staff: '#16A34A', admin: '#F97316',
  };
  const roleBg: Record<string, string> = {
    customer: '#DBEAFE', caterer: '#F5F3FF', staff: '#DCFCE7', admin: '#FEF3E8',
  };

  const adminFullName = profile?.full_name ?? 'Admin';

  return (
    <div style={{ paddingBottom: 40, fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Top Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#111', marginBottom: 6, letterSpacing: '-0.01em' }}>
            Welcome back, {adminFullName}! 👋
          </h1>
          <p style={{ fontSize: 14, color: '#6B7280', margin: 0, lineHeight: 1.4 }}>
            Here is your daily snapshot of CaterConnect's platform operations.
          </p>
        </div>
        <div>
          <div style={{ background: '#FFFFFF', border: '1px solid #E8E4DE', borderRadius: 20, padding: '8px 16px', fontSize: 13, color: '#4B5563', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
            <Calendar size={15} color="#EA580C" />
            {new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
      </div>

      {/* Primary KPI Row with Absolute Growth Badges */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, marginBottom: 28 }}>
        {[
          { label: 'Total Users', value: stats.totalUsers, icon: Users, color: '#F97316', bg: '#FFF7ED', accent: 'linear-gradient(135deg, #F97316 0%, #FB923C 100%)', trend: stats.userTrend, path: '/admin/users' },
          { label: 'Registered Caterers', value: stats.caterers, icon: Store, color: '#16A34A', bg: '#DCFCE7', accent: 'linear-gradient(135deg, #16A34A 0%, #4ADE80 100%)', trend: stats.catererTrend, path: '/admin/users?role=caterer' },
          { label: 'Total Bookings', value: stats.bookings, icon: Calendar, color: '#2563EB', bg: '#DBEAFE', accent: 'linear-gradient(135deg, #2563EB 0%, #60A5FA 100%)', trend: stats.bookingTrend, path: '/staff/bookings' },
          { label: 'Total Revenue', value: `₱${stats.revenue.toLocaleString()}`, icon: Wallet, color: '#7C3AED', bg: '#F5F3FF', accent: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)', trend: stats.revenueTrend, path: '/admin/revenue' },
        ].map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} onClick={() => navigate(card.path)} style={{ position: 'relative', background: '#FFFFFF', borderRadius: 24, padding: '24px 22px', border: '1px solid #E8E4DE', boxShadow: '0 10px 30px rgba(0,0,0,0.04)', cursor: 'pointer', transition: 'all 0.2s ease', overflow: 'hidden' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 14px 36px rgba(0,0,0,0.07)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 10px 30px rgba(0,0,0,0.04)'; }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: card.accent }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, marginTop: 4 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: card.bg, border: '1px solid #FED7AA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={22} color={card.color} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#DCFCE7', color: '#166534', padding: '4px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 700 }}>
                  <TrendingUp size={13} /> {card.trend}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#111', letterSpacing: '-0.01em', marginBottom: 4 }}>
                  {loading ? <Loader2 size={22} className="animate-spin" color="#9CA3AF" /> : card.value}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#6B7280' }}>{card.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Balanced Dashboard: Action Center and Subscription Tiers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, alignItems: 'stretch', marginBottom: 24 }}>
        {/* Action Center */}
        <div style={{ background: '#FFFFFF', borderRadius: 24, border: '1px solid #E8E4DE', boxShadow: '0 10px 30px rgba(0,0,0,0.04)', padding: '24px' }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: '#111', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 20px 0' }}>
            <Activity size={19} color="#111" /> Action Center
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div onClick={() => navigate('/staff/verification')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', background: '#FEF3C7', borderRadius: 16, cursor: 'pointer', border: '1px solid #FDE68A', transition: 'transform 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.01)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ background: '#FFFBEB', padding: 8, borderRadius: 10, border: '1px solid #FDE68A' }}>
                  <Clock size={18} color="#D97706" />
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#92400E' }}>Pending Verifications</div>
                  <div style={{ fontSize: 12, color: '#B45309', marginTop: 2 }}>Caterers waiting for review</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: '#92400E' }}>{loading ? '-' : stats.pending}</span>
                <ArrowRight size={16} color="#D97706" />
              </div>
            </div>
            <div onClick={() => navigate('/staff/complaints')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', background: '#FEE2E2', borderRadius: 16, cursor: 'pointer', border: '1px solid #FECACA', transition: 'transform 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.01)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ background: '#FEF2F2', padding: 8, borderRadius: 10, border: '1px solid #FECACA' }}>
                  <ShieldAlert size={18} color="#DC2626" />
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#991B1B' }}>Open Complaints</div>
                  <div style={{ fontSize: 12, color: '#B91C1C', marginTop: 2 }}>Requires immediate action</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: '#991B1B' }}>{loading ? '-' : stats.complaints}</span>
                <ArrowRight size={16} color="#DC2626" />
              </div>
            </div>
            <div onClick={() => navigate('/staff/verification')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', background: '#DCFCE7', borderRadius: 16, cursor: 'pointer', border: '1px solid #BBF7D0', transition: 'transform 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.01)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ background: '#F0FDF4', padding: 8, borderRadius: 10, border: '1px solid #BBF7D0' }}>
                  <CheckCircle2 size={18} color="#16A34A" />
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#166534' }}>Verified Caterers</div>
                  <div style={{ fontSize: 12, color: '#15803D', marginTop: 2 }}>Active on the platform</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: '#166534' }}>{loading ? '-' : stats.verified}</span>
                <ArrowRight size={16} color="#16A34A" />
              </div>
            </div>
          </div>
        </div>

        {/* Subscription Tiers Mini-Widget */}
        <div style={{ background: '#FFFFFF', borderRadius: 24, border: '1px solid #E8E4DE', boxShadow: '0 10px 30px rgba(0,0,0,0.04)', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#111', display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
              <CreditCard size={19} color="#111" /> Subscription Tiers
            </h3>
            <button onClick={() => navigate('/staff/subscriptions')} style={{ background: 'transparent', border: 'none', color: '#EA580C', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Manage →
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {[
              { plan: 'Free Plan', price: '₱0', maxPkg: '3 packages', maxBooking: '5 bookings/mo', color: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB', icon: Sparkles },
              { plan: 'Basic Plan', price: '₱299', maxPkg: 'Unlimited', maxBooking: '20 bookings/mo', color: '#2563EB', bg: '#DBEAFE', border: '#93C5FD', icon: Zap },
              { plan: 'Standard Plan', price: '₱499', maxPkg: 'Unlimited', maxBooking: '50 bookings/mo', color: '#D97706', bg: '#FEF3C7', border: '#FDE68A', icon: Crown },
              { plan: 'Premium Plan', price: '₱999', maxPkg: 'Unlimited', maxBooking: 'Unlimited', color: '#7C3AED', bg: '#F5F3FF', border: '#C4B5FD', icon: Building2 },
            ].map((p, idx) => {
              const TierIcon = p.icon;
              return (
                <div key={idx} style={{ background: p.bg, borderRadius: 18, padding: '16px', border: `1px solid ${p.border}`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: p.color, textTransform: 'uppercase', letterSpacing: 0.5 }}>{p.plan}</span>
                    <div style={{ width: 26, height: 26, borderRadius: 8, background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}>
                      <TierIcon size={14} color={p.color} />
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 19, fontWeight: 900, color: '#111', letterSpacing: '-0.02em', lineHeight: 1 }}>
                      {p.price}<span style={{ fontSize: 10, fontWeight: 700, color: '#6B7280' }}>/mo</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 8 }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: '#4B5563', background: 'rgba(255,255,255,0.7)', padding: '2px 6px', borderRadius: 4 }}>
                        {p.maxPkg}
                      </span>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: '#4B5563', background: 'rgba(255,255,255,0.7)', padding: '2px 6px', borderRadius: 4 }}>
                        {p.maxBooking}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Registrations: Full-width table */}
      <div style={{ width: '100%', minWidth: 0 }}>
        <div style={{ background: '#FFFFFF', borderRadius: 24, border: '1px solid #E8E4DE', boxShadow: '0 10px 30px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '24px 24px 20px', borderBottom: '1px solid #E8E4DE', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FFFFFF' }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#111', display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
              <UserCog size={19} color="#EA580C" /> Recent Registrations
            </h3>
            <button onClick={() => navigate('/admin/users')} style={{ background: '#FFF7ED', border: '1px solid #FED7AA', color: '#EA580C', padding: '7px 14px', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#FFEDD5')}
              onMouseLeave={e => (e.currentTarget.style.background = '#FFF7ED')}>
              View Directory <ArrowRight size={14} />
            </button>
          </div>

          <div style={{ flex: 1, overflowX: 'auto' }}>
            {loading ? (
              <div style={{ padding: 60, textAlign: 'center', color: '#9CA3AF', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <Loader2 size={32} className="animate-spin" color="#EA580C" />
                <span style={{ fontSize: 14, fontWeight: 500 }}>Loading user directory...</span>
              </div>
            ) : recentUsers.length === 0 ? (
              <div style={{ padding: 60, textAlign: 'center', color: '#9CA3AF' }}>No recent users found.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E8E4DE' }}>
                    <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5 }}>User Profile</th>
                    <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5 }}>Account Email</th>
                    <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5 }}>Role Assignment</th>
                    <th style={{ padding: '16px 24px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5 }}>Date Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {recentUsers.map((u, i) => (
                    <tr key={u.id} style={{ borderBottom: i === recentUsers.length - 1 ? 'none' : '1px solid #E8E4DE', transition: 'background 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt={u.full_name} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: '2px solid #F3F4F6' }} />
                          ) : (
                            <div style={{ width: 40, height: 40, borderRadius: '50%', background: roleBg[u.role] ?? '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: roleColor[u.role] ?? '#6B7280' }}>
                              {(u.full_name ?? 'U').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#111', marginBottom: 2 }}>{u.full_name ?? '—'}</div>
                            <div style={{ fontSize: 11.5, color: '#9CA3AF', fontFamily: 'monospace' }}>ID: {u.id.slice(0, 8)}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px', color: '#4B5563', fontSize: 14 }}>{u.email}</td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: roleBg[u.role] ?? '#F3F4F6', color: roleColor[u.role] ?? '#6B7280', textTransform: 'capitalize' }}>
                          {u.role}
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px', fontSize: 13, color: '#6B7280', textAlign: 'right', fontWeight: 500 }}>
                        {u.created_at ? new Date(u.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}