import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Users, Search, Eye, Ban, X, Store, Loader2, Mail, Hash, CalendarDays, ShieldAlert } from 'lucide-react';

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
    customer: '#EFF6FF', caterer: '#F5F3FF', staff: '#F0FDF4', admin: '#FFF7ED',
  };
  const roleBorder: Record<string, string> = {
    customer: '#BFDBFE', caterer: '#DDD6FE', staff: '#BBF7D0', admin: '#FFEDD5',
  };
  
  const tabs = ['all', 'customer', 'caterer', 'staff', 'admin'];

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#111', marginBottom: 6, letterSpacing: '-0.5px' }}>User Directory</h1>
          <p style={{ fontSize: 15, color: '#6B7280', margin: 0 }}>Securely manage, review, and control all platform accounts.</p>
        </div>
      </div>

      {/* Controls: Tabs & Search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 20, flexWrap: 'wrap' }}>
        
        {/* Segmented Control Tabs */}
        <div style={{ display: 'flex', gap: 6, background: '#F3F4F6', padding: 6, borderRadius: 14, border: '1px solid #E5E7EB' }}>
          {tabs.map(t => (
            <button 
              key={t} 
              onClick={() => setFilter(t)} 
              style={{ 
                padding: '8px 18px', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 10, cursor: 'pointer', textTransform: 'capitalize', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                background: filter === t ? '#FFFFFF' : 'transparent', 
                color: filter === t ? '#111' : '#6B7280',
                boxShadow: filter === t ? '0 2px 4px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)' : 'none'
              }}
            >
              {t} <span style={{ opacity: 0.6, marginLeft: 4, fontWeight: 600 }}>{counts[t] !== undefined ? counts[t] : ''}</span>
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative', width: '100%', maxWidth: 380 }}>
          <Search size={18} color="#9CA3AF" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)' }} />
          <input 
            placeholder="Search by name or email address..."
            value={search} 
            onChange={e => setSearch(e.target.value)}
            style={{ 
              width: '100%', padding: '12px 16px 12px 44px', borderRadius: 14, border: '1px solid #E5E7EB', outline: 'none', fontSize: 14, color: '#111', background: '#FFFFFF',
              boxShadow: '0 1px 2px rgba(0,0,0,0.02)', transition: 'border-color 0.2s, box-shadow 0.2s'
            }} 
            onFocus={e => { e.target.style.borderColor = '#F97316'; e.target.style.boxShadow = '0 0 0 4px rgba(249, 115, 22, 0.1)'; }}
            onBlur={e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = '0 1px 2px rgba(0,0,0,0.02)'; }}
          />
        </div>
      </div>

      {/* Main Data Table Card */}
      <div style={{ background: '#FFFFFF', borderRadius: 20, border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 80, textAlign: 'center', color: '#9CA3AF', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <Loader2 size={36} color="#F97316" className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
            <div style={{ fontSize: 15, fontWeight: 600 }}>Syncing user directory...</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 80, textAlign: 'center', color: '#9CA3AF', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #E5E7EB' }}>
              <Users size={32} color="#D1D5DB" />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#111', marginBottom: 4 }}>No users found</div>
              <div style={{ fontSize: 14 }}>We couldn't find anyone matching your current search or filters.</div>
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                  <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>User Profile</th>
                  <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Account Details</th>
                  <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>System Role</th>
                  <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u, i) => (
                  <tr key={u.id} style={{ borderBottom: i === filtered.length - 1 ? 'none' : '1px solid #F3F4F6', transition: 'background 0.2s ease' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '20px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt={u.full_name} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '1px solid #E5E7EB', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }} />
                        ) : (
                          <div style={{ width: 44, height: 44, borderRadius: '50%', background: roleBg[u.role] ?? '#F3F4F6', border: `1px solid ${roleBorder[u.role] ?? '#E5E7EB'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: roleColor[u.role] ?? '#6B7280', fontSize: 16, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                            {(u.full_name ?? 'U').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 15, color: '#111', marginBottom: 4 }}>{u.full_name ?? '—'}</div>
                          <div style={{ fontSize: 12, color: '#9CA3AF', fontFamily: 'monospace', background: '#F3F4F6', padding: '2px 6px', borderRadius: 6, display: 'inline-block' }}>ID: {u.id.slice(0, 10)}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '20px 24px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ fontSize: 14, color: '#4B5563', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Mail size={14} color="#9CA3AF" /> {u.email}
                        </div>
                        <div style={{ fontSize: 12, color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <CalendarDays size={14} color="#9CA3AF" /> Joined {u.created_at ? new Date(u.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '20px 24px' }}>
                      <span style={{ padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, textTransform: 'capitalize', background: roleBg[u.role] ?? '#F3F4F6', color: roleColor[u.role] ?? '#6B7280', border: `1px solid ${roleBorder[u.role] ?? '#E5E7EB'}` }}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ padding: '20px 24px' }}>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button 
                          onClick={() => handleViewUser(u)} 
                          style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, color: '#4B5563', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#F9FAFB'; e.currentTarget.style.borderColor = '#D1D5DB'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.borderColor = '#E5E7EB'; }}
                        >
                          <Eye size={16} /> Profile
                        </button>
                        
                        {u.role !== 'admin' && (
                          <button 
                            style={{ background: '#FFF5F5', border: '1px solid #FEE2E2', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, color: '#DC2626', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s' }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#FEE2E2'; e.currentTarget.style.borderColor = '#FECACA'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#FFF5F5'; e.currentTarget.style.borderColor = '#FEE2E2'; }}
                          >
                            <Ban size={16} /> Suspend
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Highly Polished User Detail Modal */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(17, 17, 17, 0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={() => setSelected(null)}>
          <div style={{ background: '#FFFFFF', width: '100%', maxWidth: 600, borderRadius: 24, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column', animation: 'scaleIn 0.2s ease-out' }} onClick={e => e.stopPropagation()}>
            
            {/* Header / Cover Area */}
            <div style={{ position: 'relative', height: selected.role === 'caterer' && selected.caterer_info?.cover_photo_url ? 180 : 100, background: selected.role === 'caterer' && selected.caterer_info?.cover_photo_url ? '#111' : 'linear-gradient(135deg, #F9FAFB 0%, #F3F4F6 100%)' }}>
              {selected.role === 'caterer' && selected.caterer_info?.cover_photo_url && (
                <img src={selected.caterer_info.cover_photo_url} alt="cover" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.9 }} />
              )}
              <button style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(4px)', border: 'none', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#111', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', transition: 'transform 0.2s' }} onClick={() => setSelected(null)} onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')} onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
                <X size={18} />
              </button>
            </div>

            {/* Profile Info Area */}
            <div style={{ padding: '0 32px 32px', position: 'relative' }}>
              
              {/* Overlapping Avatar */}
              <div style={{ marginTop: -40, marginBottom: 16, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                {selected.role === 'caterer' && selected.caterer_info?.logo_url ? (
                  <img src={selected.caterer_info.logo_url} alt="logo" style={{ width: 88, height: 88, borderRadius: 20, objectFit: 'cover', border: '4px solid #FFFFFF', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)', background: '#FFF' }} />
                ) : selected.avatar_url ? (
                  <img src={selected.avatar_url} alt={selected.full_name} style={{ width: 88, height: 88, borderRadius: '50%', objectFit: 'cover', border: '4px solid #FFFFFF', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', background: '#FFF' }} />
                ) : (
                  <div style={{ width: 88, height: 88, borderRadius: selected.role === 'caterer' ? 20 : '50%', background: roleBg[selected.role] ?? '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: roleColor[selected.role] ?? '#6B7280', fontSize: 36, border: '4px solid #FFFFFF', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                    {(selected.full_name ?? 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <span style={{ padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 800, textTransform: 'capitalize', background: roleBg[selected.role], color: roleColor[selected.role], border: `1px solid ${roleBorder[selected.role]}` }}>
                  {selected.role} Account
                </span>
              </div>

              {/* Name & Title */}
              <div style={{ marginBottom: 28 }}>
                <h2 style={{ fontSize: 26, fontWeight: 900, color: '#111', margin: '0 0 6px 0', letterSpacing: '-0.5px' }}>{selected.full_name}</h2>
                {selected.role === 'caterer' && selected.caterer_info?.business_name && (
                  <div style={{ fontSize: 15, color: '#4B5563', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                    <Store size={18} color="#7C3AED" /> {selected.caterer_info.business_name}
                  </div>
                )}
              </div>

              {/* Detail Cards Layout */}
              <div style={{ display: 'grid', gridTemplateColumns: selected.role === 'caterer' && selected.caterer_info ? '1fr 1fr' : '1fr', gap: 20 }}>
                
                {/* System Details */}
                <div>
                  <h4 style={{ fontSize: 12, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>System Details</h4>
                  <div style={{ background: '#F9FAFB', borderRadius: 16, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
                    {[
                      { icon: Mail, label: 'Email', value: selected.email },
                      { icon: Hash, label: 'User ID', value: selected.id },
                      { icon: CalendarDays, label: 'Joined', value: selected.created_at ? new Date(selected.created_at).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }) : '—' },
                    ].map((row, idx, arr) => {
                      const Icon = row.icon;
                      return (
                        <div key={row.label} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '14px 16px', borderBottom: idx < arr.length - 1 ? '1px solid #E5E7EB' : 'none' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#6B7280' }}>
                            <Icon size={16} /> <span style={{ fontSize: 13, fontWeight: 600 }}>{row.label}</span>
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#111', maxWidth: '55%', textAlign: 'right', wordBreak: 'break-all' }}>{row.value}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Vendor Info (If Caterer) */}
                {selected.role === 'caterer' && selected.caterer_info && (
                  <div>
                    <h4 style={{ fontSize: 12, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Vendor Profile</h4>
                    <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
                      {[
                        { label: 'City', value: selected.caterer_info.city ?? '—' },
                        { label: 'Phone', value: selected.caterer_info.contact_phone ?? '—' },
                        { label: 'Clearance', value: <span style={{ color: selected.caterer_info.verification_status === 'approved' ? '#16A34A' : '#D97706', textTransform: 'capitalize' }}>{selected.caterer_info.verification_status}</span> },
                        { label: 'Plan', value: selected.caterer_info.subscription_plan?.toUpperCase() ?? '—' },
                      ].map((row, idx, arr) => (
                        <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 16px', borderBottom: idx < arr.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                          <span style={{ fontSize: 13, color: '#6B7280', fontWeight: 600 }}>{row.label}</span>
                          <span style={{ fontSize: 13, fontWeight: 800, color: '#111' }}>{row.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Footer */}
              {selected.role !== 'admin' && (
                <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid #F3F4F6' }}>
                  <button style={{ width: '100%', padding: '14px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', borderRadius: 14, fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#FEE2E2'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#FEF2F2'; }}>
                    <ShieldAlert size={18} /> Suspend Platform Access
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Simple global style block for the modal animation (ScaleIn) */}
      <style>{`
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}