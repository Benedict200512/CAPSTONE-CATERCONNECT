import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type User = {
  id: string; full_name: string; email: string; role: string;
  created_at: string; avatar_url?: string | null;
};

export default function UserManagement() {
  const [users, setUsers]     = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('all');
  const [search, setSearch]   = useState('');
  const [selected, setSelected] = useState<User & { logo_url?: string; caterer_info?: any } | null>(null);
  const [counts, setCounts]   = useState<Record<string, number>>({});

  const load = async () => {
    setLoading(true);
    let query = supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (filter !== 'all') query = query.eq('role', filter);
    const { data } = await query;
    setUsers(data ?? []);

    const allRoles = ['customer', 'caterer', 'staff', 'admin'];
    const countResults = await Promise.all(
      allRoles.map(r => supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', r))
    );
    const c: Record<string, number> = { all: 0 };
    allRoles.forEach((r, i) => {
      c[r] = countResults[i].count ?? 0;
      c.all = (c.all ?? 0) + (countResults[i].count ?? 0);
    });
    setCounts(c);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const handleViewUser = async (u: User) => {
    let extra: any = {};
    if (u.role === 'caterer') {
      const { data } = await supabase
        .from('caterers')
        .select('business_name, logo_url, cover_photo_url, city, contact_phone, verification_status, subscription_plan')
        .eq('user_id', u.id)
        .maybeSingle();
      extra = { caterer_info: data };
    }
    setSelected({ ...u, ...extra });
  };

  const filtered = users.filter(u =>
    (u.full_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (u.email ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const roleColor: Record<string, string> = {
    customer: '#2563EB', caterer: '#7C3AED', staff: '#16A34A', admin: '#F97316',
  };
  const roleBg: Record<string, string> = {
    customer: '#DBEAFE', caterer: '#F5F3FF', staff: '#DCFCE7', admin: '#FEF3E8',
  };
  const tabs = ['all', 'customer', 'caterer', 'staff', 'admin'];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="page-sub">Manage all registered platform accounts</p>
        </div>
      </div>

      <div className="tab-bar">
        {tabs.map(t => (
          <button key={t} className={`tab-btn ${filter === t ? 'active' : ''}`} onClick={() => setFilter(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)} {counts[t] !== undefined ? `(${counts[t]})` : ''}
          </button>
        ))}
      </div>

      <div style={{ marginBottom: 16 }}>
        <input className="form-input" placeholder="🔍  Search by name or email..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', maxWidth: 360 }} />
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="empty-state"><div className="empty-state-icon">⏳</div><div className="empty-state-sub">Loading users...</div></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><div className="empty-state-icon">👥</div><div className="empty-state-title">No users found</div></div>
        ) : (
          <table>
            <thead>
              <tr><th>User</th><th>Email</th><th>Role</th><th>Joined</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {/* Avatar — show photo if exists */}
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt={u.full_name}
                          style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid #E5E7EB' }} />
                      ) : (
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: roleBg[u.role] ?? '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: roleColor[u.role] ?? '#6B7280', fontSize: 14, flexShrink: 0 }}>
                          {(u.full_name ?? 'U').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{u.full_name ?? '—'}</div>
                        <div style={{ fontSize: 12, color: '#9CA3AF' }}>ID: {u.id.slice(0, 8)}...</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ color: '#6B7280', fontSize: 13 }}>{u.email}</td>
                  <td>
                    <span className="badge" style={{ background: roleBg[u.role] ?? '#F3F4F6', color: roleColor[u.role] ?? '#6B7280' }}>
                      {u.role}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: '#9CA3AF' }}>
                    {u.created_at ? new Date(u.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-outline btn-sm" onClick={() => handleViewUser(u)}>View</button>
                      {u.role !== 'admin' && (
                        <button className="btn btn-danger btn-sm">Suspend</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* User detail modal */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>

            {/* Cover photo for caterers */}
            {selected.role === 'caterer' && selected.caterer_info?.cover_photo_url && (
              <div style={{ margin: '-32px -32px 24px', borderRadius: '20px 20px 0 0', overflow: 'hidden', height: 140 }}>
                <img src={selected.caterer_info.cover_photo_url} alt="cover"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {/* Logo for caterers, avatar for customers */}
                {selected.role === 'caterer' && selected.caterer_info?.logo_url ? (
                  <img src={selected.caterer_info.logo_url} alt="logo"
                    style={{ width: 56, height: 56, borderRadius: 14, objectFit: 'cover', border: '3px solid white', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', marginTop: selected.caterer_info?.cover_photo_url ? -28 : 0 }} />
                ) : selected.avatar_url ? (
                  <img src={selected.avatar_url} alt={selected.full_name}
                    style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '3px solid #E5E7EB' }} />
                ) : (
                  <div style={{ width: 56, height: 56, borderRadius: selected.role === 'caterer' ? 14 : '50%', background: roleBg[selected.role] ?? '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: roleColor[selected.role] ?? '#6B7280', fontSize: 24, marginTop: selected.caterer_info?.cover_photo_url ? -28 : 0, border: '3px solid white' }}>
                    {(selected.full_name ?? 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 20, fontWeight: 900 }}>{selected.full_name}</div>
                  {selected.role === 'caterer' && selected.caterer_info?.business_name && (
                    <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 4 }}>
                      🍽️ {selected.caterer_info.business_name}
                    </div>
                  )}
                  <span className="badge" style={{ background: roleBg[selected.role], color: roleColor[selected.role] }}>{selected.role}</span>
                </div>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => setSelected(null)}>✕ Close</button>
            </div>

            {/* User info */}
            {[
              { label: 'Email',  value: selected.email },
              { label: 'User ID', value: selected.id },
              { label: 'Role',   value: selected.role },
              { label: 'Joined', value: selected.created_at ? new Date(selected.created_at).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }) : '—' },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '13px 0', borderBottom: '1px solid #F1F3F5' }}>
                <span style={{ fontSize: 13, color: '#6B7280', fontWeight: 600 }}>{row.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, maxWidth: '60%', textAlign: 'right', wordBreak: 'break-all' }}>{row.value}</span>
              </div>
            ))}

            {/* Caterer-specific info */}
            {selected.role === 'caterer' && selected.caterer_info && (
              <>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF', letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 20, marginBottom: 12 }}>
                  Business Information
                </div>
                {[
                  { label: 'Business Name',      value: selected.caterer_info.business_name ?? '—' },
                  { label: 'City',               value: selected.caterer_info.city ?? '—' },
                  { label: 'Contact Phone',       value: selected.caterer_info.contact_phone ?? '—' },
                  { label: 'Verification Status', value: selected.caterer_info.verification_status ?? '—' },
                  { label: 'Subscription Plan',   value: selected.caterer_info.subscription_plan?.toUpperCase() ?? '—' },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid #F1F3F5' }}>
                    <span style={{ fontSize: 13, color: '#6B7280', fontWeight: 600 }}>{row.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{row.value}</span>
                  </div>
                ))}
              </>
            )}

            {selected.role !== 'admin' && (
              <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
                <button className="btn btn-danger" style={{ flex: 1 }}>🚫 Suspend Account</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}