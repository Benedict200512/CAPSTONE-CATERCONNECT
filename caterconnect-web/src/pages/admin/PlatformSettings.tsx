import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function PlatformSettings() {
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('profiles').select('*').in('role', ['staff', 'admin']).order('created_at', { ascending: false });
      setStaffList(data ?? []);
      setLoading(false);
    };
    load();
  }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
    setStaffList(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    setMsg('Role updated successfully.');
    setTimeout(() => setMsg(''), 3000);
  };

  const planDetails = [
    { plan: 'Free',     price: 0,   bookings: 5,  packages: 3,    color: '#6B7280' },
    { plan: 'Basic',    price: 299, bookings: 20, packages: null, color: '#2563EB' },
    { plan: 'Standard', price: 499, bookings: 50, packages: null, color: '#D97706' },
    { plan: 'Premium',  price: 999, bookings: null, packages: null, color: '#7C3AED' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Platform Settings</h1>
          <p className="page-sub">Manage staff accounts and view subscription plan configuration</p>
        </div>
      </div>

      {msg && (
        <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 10, padding: '12px 18px', marginBottom: 20, fontSize: 14, color: '#15803D', fontWeight: 600 }}>
          ✅ {msg}
        </div>
      )}

      {/* Staff Management */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 17, fontWeight: 900 }}>👷 Staff & Admin Accounts</h2>
        <button className="btn btn-orange" onClick={() => setShowAddStaff(true)}>+ Add Staff</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 28 }}>
        {loading ? (
          <div className="empty-state"><div className="empty-state-sub">Loading...</div></div>
        ) : staffList.length === 0 ? (
          <div className="empty-state"><div className="empty-state-title">No staff accounts</div></div>
        ) : (
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th>Change Role</th></tr></thead>
            <tbody>
              {staffList.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: u.role === 'admin' ? '#FEF3E8' : '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: u.role === 'admin' ? '#F97316' : '#16A34A', fontSize: 13, flexShrink: 0 }}>
                        {(u.full_name ?? 'U').charAt(0).toUpperCase()}
                      </div>
                      <strong>{u.full_name ?? '—'}</strong>
                    </div>
                  </td>
                  <td style={{ color: '#6B7280', fontSize: 13 }}>{u.email}</td>
                  <td>
                    <span className="badge" style={{ background: u.role === 'admin' ? '#FEF3E8' : '#DCFCE7', color: u.role === 'admin' ? '#F97316' : '#16A34A' }}>
                      {u.role}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: '#9CA3AF' }}>{u.created_at ? new Date(u.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
                  <td>
                    <select
                      value={u.role}
                      onChange={e => handleRoleChange(u.id, e.target.value)}
                      style={{ border: '1.5px solid #E5E7EB', borderRadius: 8, padding: '6px 10px', fontSize: 13, outline: 'none', background: 'white' }}
                    >
                      <option value="staff">staff</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Subscription Plan Config */}
      <h2 style={{ fontSize: 17, fontWeight: 900, marginBottom: 16 }}>💳 Subscription Plan Configuration</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 16 }}>
        {planDetails.map((p) => (
          <div key={p.plan} className="card" style={{ borderTop: `3px solid ${p.color}` }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: p.color, marginBottom: 10 }}>{p.plan} Plan</div>
            <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 12 }}>{p.price === 0 ? 'Free' : `₱${p.price}/mo`}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 12, color: '#6B7280' }}>📦 Packages: <strong style={{ color: '#111' }}>{p.packages === null ? 'Unlimited' : p.packages}</strong></div>
              <div style={{ fontSize: 12, color: '#6B7280' }}>📅 Bookings/mo: <strong style={{ color: '#111' }}>{p.bookings === null ? 'Unlimited' : p.bookings}</strong></div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#92400E' }}>
        ⚠️ Plan prices and limits are defined in code. Contact your developer to modify subscription tiers.
      </div>

      {/* Add Staff Modal */}
      {showAddStaff && (
        <div className="modal-overlay" onClick={() => setShowAddStaff(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div className="modal-title" style={{ marginBottom: 0 }}>Add Staff Account</div>
              <button className="btn btn-outline btn-sm" onClick={() => setShowAddStaff(false)}>✕</button>
            </div>
            <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 20, lineHeight: 1.7 }}>
              To add a staff account, create the user in <strong>Supabase Auth Dashboard</strong> first, then run this SQL in the SQL Editor to set their role:
            </p>
            <div style={{ background: '#1E1E1E', borderRadius: 10, padding: 16, marginBottom: 20 }}>
              <pre style={{ fontSize: 12, color: '#86EFAC', lineHeight: 1.8, whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'monospace' }}>
{`INSERT INTO profiles (id, full_name, email, role)
VALUES (
  'PASTE-UUID-FROM-AUTH',
  'Staff Full Name',
  'staff@email.com',
  'staff'
)
ON CONFLICT (id)
DO UPDATE SET role = 'staff',
  full_name = EXCLUDED.full_name;`}
              </pre>
            </div>
            <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer"
              style={{ display: 'block', textAlign: 'center', padding: '11px', background: '#111', color: 'white', borderRadius: 10, fontWeight: 700, fontSize: 14 }}>
              Open Supabase Dashboard →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}