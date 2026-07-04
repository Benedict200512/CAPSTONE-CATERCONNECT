import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export default function AdminDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ customers: 0, caterers: 0, staff: 0, verified: 0, pending: 0, bookings: 0, revenue: 0, complaints: 0 });
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [customers, caterers, staffRes, verified, pending, bookings, revenue, complaints, users] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'customer'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'caterer'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'staff'),
        supabase.from('caterers').select('id', { count: 'exact', head: true }).eq('verification_status', 'approved'),
        supabase.from('caterers').select('id', { count: 'exact', head: true }).eq('verification_status', 'pending'),
        supabase.from('bookings').select('id', { count: 'exact', head: true }),
        supabase.from('subscription_payments').select('amount').eq('status', 'confirmed'),
        supabase.from('complaints').select('id', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('profiles').select('id, full_name, email, role, created_at, avatar_url').order('created_at', { ascending: false }).limit(5),
      ]);

      const totalRevenue = (revenue.data ?? []).reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);

      setStats({
        customers: customers.count ?? 0,
        caterers: caterers.count ?? 0,
        staff: staffRes.count ?? 0,
        verified: verified.count ?? 0,
        pending: pending.count ?? 0,
        bookings: bookings.count ?? 0,
        revenue: totalRevenue,
        complaints: complaints.count ?? 0,
      });
      setRecentUsers(users.data ?? []);
      setLoading(false);
    };
    load();
  }, []);

  const statCards = [
    { icon: '👤', label: 'Customers',       value: stats.customers, color: '#2563EB', bg: '#DBEAFE', path: '/admin/users?role=customer' },
    { icon: '🍽️', label: 'Caterers',        value: stats.caterers,  color: '#7C3AED', bg: '#F5F3FF', path: '/admin/users?role=caterer'  },
    { icon: '✅', label: 'Verified',         value: stats.verified,  color: '#16A34A', bg: '#DCFCE7', path: '/staff/verification'        },
    { icon: '⏳', label: 'Pending Review',   value: stats.pending,   color: '#D97706', bg: '#FEF3C7', path: '/staff/verification'        },
    { icon: '📅', label: 'Total Bookings',   value: stats.bookings,  color: '#F97316', bg: '#FEF3E8', path: '/staff/bookings'            },
    { icon: '💰', label: 'Total Revenue',    value: `₱${stats.revenue.toLocaleString()}`, color: '#16A34A', bg: '#DCFCE7', path: '/admin/revenue', isStr: true },
    { icon: '🚨', label: 'Open Complaints',  value: stats.complaints, color: '#DC2626', bg: '#FEE2E2', path: '/staff/complaints'         },
    { icon: '👷', label: 'Staff Members',    value: stats.staff,     color: '#6366F1', bg: '#EEF2FF', path: '/admin/users?role=staff'    },
  ];

  const roleColor: Record<string, string> = {
    customer: '#2563EB', caterer: '#7C3AED', staff: '#16A34A', admin: '#F97316',
  };
  const roleBg: Record<string, string> = {
    customer: '#DBEAFE', caterer: '#F5F3FF', staff: '#DCFCE7', admin: '#FEF3E8',
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Admin Dashboard</h1>
          <p className="page-sub">Welcome back, {profile?.full_name?.split(' ')[0] ?? 'Admin'} 👋 — Full platform overview</p>
        </div>
        <div style={s.datePill}>
          {new Date().toLocaleDateString('en-PH', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        {statCards.map((card) => (
          <div key={card.label} className="card stat-card" onClick={() => navigate(card.path)}
            style={{ cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.10)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)'; }}>
            <div className="stat-icon" style={{ background: card.bg }}>{card.icon}</div>
            <div>
              <div className="stat-val" style={{ color: card.color }}>{loading ? '—' : card.value}</div>
              <div className="stat-lbl">{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
        {/* Recent users */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #F1F3F5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 16, fontWeight: 900 }}>Recent Registrations</h3>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/admin/users')}>View All →</button>
          </div>
          {loading ? <div className="empty-state">⏳ Loading...</div> :
            recentUsers.length === 0 ? <div className="empty-state">No users yet.</div> : (
              <table>
                <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th></tr></thead>
                <tbody>
                  {recentUsers.map((u) => (
                    <tr key={u.id}>
                      <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {u.avatar_url ? (
                      <img src={u.avatar_url} alt={u.full_name}
                      style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid #E5E7EB' }} />
                      ) : (
                     <div style={{ width: 32, height: 32, borderRadius: '50%', background: roleBg[u.role] ?? '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: roleColor[u.role] ?? '#6B7280', flexShrink: 0 }}>
                     {(u.full_name ?? 'U').charAt(0).toUpperCase()}
                     </div>
                    )}
                    <strong style={{ fontSize: 14 }}>{u.full_name ?? '—'}</strong>
                    </div>
                    </td>
                      <td style={{ color: '#6B7280', fontSize: 13 }}>{u.email}</td>
                      <td>
                        <span className="badge" style={{ background: roleBg[u.role] ?? '#F3F4F6', color: roleColor[u.role] ?? '#6B7280' }}>{u.role}</span>
                      </td>
                      <td style={{ fontSize: 12, color: '#9CA3AF' }}>{u.created_at ? new Date(u.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>

        {/* Right panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Platform health */}
          <div className="card">
            <h3 style={{ fontSize: 15, fontWeight: 900, marginBottom: 16 }}>📊 Platform Health</h3>
            {[
              { label: 'Approval Rate', value: stats.caterers > 0 ? `${Math.round((stats.verified / stats.caterers) * 100)}%` : '—', color: '#16A34A' },
              { label: 'Pending Reviews', value: stats.pending, color: '#D97706' },
              { label: 'Open Complaints', value: stats.complaints, color: '#DC2626' },
              { label: 'Active Bookings', value: stats.bookings, color: '#F97316' },
            ].map((item) => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: '1px solid #F1F3F5' }}>
                <span style={{ fontSize: 13, color: '#6B7280' }}>{item.label}</span>
                <span style={{ fontSize: 16, fontWeight: 900, color: item.color }}>{loading ? '—' : item.value}</span>
              </div>
            ))}
          </div>

          {/* Subscription plans */}
          <div className="card">
            <h3 style={{ fontSize: 15, fontWeight: 900, marginBottom: 14 }}>💳 Plans</h3>
            {[
              { plan: 'Free',     price: '₱0/mo',   color: '#6B7280', bg: '#F3F4F6' },
              { plan: 'Basic',    price: '₱299/mo',  color: '#2563EB', bg: '#DBEAFE' },
              { plan: 'Standard', price: '₱499/mo',  color: '#D97706', bg: '#FEF3C7' },
              { plan: 'Premium',  price: '₱999/mo',  color: '#7C3AED', bg: '#F5F3FF' },
            ].map((p) => (
              <div key={p.plan} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: p.bg, borderRadius: 9, marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: p.color }}>{p.plan}</span>
                <span style={{ fontSize: 13, fontWeight: 900, color: p.color }}>{p.price}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  datePill: { background: 'white', border: '1px solid #E8E4DE', borderRadius: 20, padding: '8px 16px', fontSize: 13, color: '#6B7280' },
};