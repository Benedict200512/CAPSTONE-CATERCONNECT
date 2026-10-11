import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { UserPlus, CheckCircle2, AlertTriangle, ExternalLink, CreditCard, Package, Calendar, X, Loader2, Shield, Mail } from 'lucide-react';

export default function PlatformSettings() {
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [msg, setMsg] = useState('');

  const load = async () => {
    const { data } = await supabase.from('profiles').select('*').in('role', ['staff', 'admin']).order('created_at', { ascending: false });
    setStaffList(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
    setStaffList(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    setMsg('Role updated successfully.');
    setTimeout(() => setMsg(''), 3000);
  };

  const planDetails = [
    { plan: 'Free',    price: 0,   bookings: 5,  packages: 3,    color: '#6B7280', bg: '#F3F4F6', border: '#E5E7EB', accent: 'linear-gradient(135deg, #6B7280 0%, #9CA3AF 100%)' },
    { plan: 'Basic',   price: 299, bookings: 20, packages: null, color: '#2563EB', bg: '#DBEAFE', border: '#BFDBFE', accent: 'linear-gradient(135deg, #2563EB 0%, #60A5FA 100%)' },
    { plan: 'Standard',price: 499, bookings: 50, packages: null, color: '#D97706', bg: '#FEF3C7', border: '#FDE68A', accent: 'linear-gradient(135deg, #D97706 0%, #FBBF24 100%)' },
    { plan: 'Premium', price: 999, bookings: null, packages: null, color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', accent: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)' },
  ];

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#111', marginBottom: 6, letterSpacing: '-0.5px' }}>Platform Settings</h1>
          <p style={{ fontSize: 15, color: '#6B7280', margin: 0 }}>Configure administrative access rights and view subscription tiers.</p>
        </div>
      </div>

      {/* Success Notification Banner */}
      {msg && (
        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 16, padding: '16px 24px', marginBottom: 28, fontSize: 14, color: '#15803D', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
          <CheckCircle2 size={20} color="#16A34A" /> {msg}
        </div>
      )}

      {/* Staff & Admin Section Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: '#111', display: 'flex', alignItems: 'center', gap: 10, margin: 0, letterSpacing: '-0.5px' }}>
          <Shield size={22} color="#F97316" /> Staff & Admin Accounts
        </h2>
        <button 
          onClick={() => setShowAddStaff(true)}
          style={{ background: '#F97316', color: '#FFF', border: 'none', borderRadius: 12, padding: '10px 18px', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(249, 115, 22, 0.2)', transition: 'background 0.2s' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#EA580C')}
          onMouseLeave={e => (e.currentTarget.style.background = '#F97316')}
        >
          <UserPlus size={16} /> Add Staff Account
        </button>
      </div>

      {/* Staff Table Card */}
      <div style={{ background: '#FFFFFF', borderRadius: 20, border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', overflow: 'hidden', marginBottom: 40 }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#9CA3AF', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <Loader2 size={32} color="#F97316" className="animate-spin" />
            <span style={{ fontSize: 14, fontWeight: 600 }}>Loading authorized profiles...</span>
          </div>
        ) : staffList.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#9CA3AF' }}>No administrative or staff accounts found.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                  <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>User Profile</th>
                  <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Contact Email</th>
                  <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Current Role</th>
                  <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Joined Date</th>
                  <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Permissions</th>
                </tr>
              </thead>
              <tbody>
                {staffList.map((u, i) => (
                  <tr key={u.id} style={{ borderBottom: i === staffList.length - 1 ? 'none' : '1px solid #F3F4F6', transition: 'background 0.2s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '18px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: u.role === 'admin' ? '#FFF7ED' : '#F0FDF4', border: `1px solid ${u.role === 'admin' ? '#FFEDD5' : '#BBF7D0'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: u.role === 'admin' ? '#F97316' : '#16A34A', fontSize: 14, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                          {(u.full_name ?? 'U').charAt(0).toUpperCase()}
                        </div>
                        <strong style={{ fontSize: 14, fontWeight: 800, color: '#111' }}>{u.full_name ?? '—'}</strong>
                      </div>
                    </td>
                    <td style={{ padding: '18px 24px', color: '#4B5563', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, height: '100%' }}>
                      <Mail size={14} color="#9CA3AF" /> {u.email}
                    </td>
                    <td style={{ padding: '18px 24px' }}>
                      <span style={{ padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: u.role === 'admin' ? '#FFF7ED' : '#F0FDF4', color: u.role === 'admin' ? '#F97316' : '#16A34A', border: `1px solid ${u.role === 'admin' ? '#FFEDD5' : '#BBF7D0'}`, textTransform: 'capitalize' }}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ padding: '18px 24px', fontSize: 13, color: '#6B7280', fontWeight: 500 }}>
                      {u.created_at ? new Date(u.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </td>
                    <td style={{ padding: '18px 24px' }}>
                      <select
                        value={u.role}
                        onChange={e => handleRoleChange(u.id, e.target.value)}
                        style={{ border: '1px solid #E5E7EB', borderRadius: 10, padding: '8px 14px', fontSize: 13, outline: 'none', background: '#F9FAFB', color: '#111', fontWeight: 700, cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}
                      >
                        <option value="staff">Staff Member</option>
                        <option value="admin">Platform Admin</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Subscription Tiers Section */}
      <h2 style={{ fontSize: 20, fontWeight: 900, color: '#111', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, letterSpacing: '-0.5px' }}>
        <CreditCard size={22} color="#F97316" /> Subscription Tiers Configuration
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 24 }}>
        {planDetails.map((p) => (
          <div key={p.plan} style={{ position: 'relative', background: '#FFFFFF', borderRadius: 20, border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', padding: 24, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: p.accent }} />

            <div style={{ fontSize: 12, fontWeight: 800, color: p.color, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 4 }}>
              {p.plan} Tier
            </div>
            <div style={{ fontSize: 32, fontWeight: 900, color: '#111', marginBottom: 20, letterSpacing: '-1px' }}>
              {p.price === 0 ? 'Free' : `₱${p.price}`}
              {p.price !== 0 && <span style={{ fontSize: 13, fontWeight: 600, color: '#9CA3AF' }}> / mo</span>}
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid #F3F4F6', paddingTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#4B5563' }}>
                <Package size={16} color="#9CA3AF" />
                <span>Packages: <strong style={{ color: '#111', fontWeight: 800 }}>{p.packages === null ? 'Unlimited' : p.packages}</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#4B5563' }}>
                <Calendar size={16} color="#9CA3AF" />
                <span>Bookings: <strong style={{ color: '#111', fontWeight: 800 }}>{p.bookings === null ? 'Unlimited' : `${p.bookings}/mo`}</strong></span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Architecture Notice Banner */}
      <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 16, padding: '18px 24px', fontSize: 14, color: '#92400E', display: 'flex', alignItems: 'flex-start', gap: 14, boxShadow: '0 2px 4px rgba(0,0,0,0.01)' }}>
        <AlertTriangle size={20} color="#D97706" style={{ flexShrink: 0, marginTop: 2 }} /> 
        <span style={{ lineHeight: 1.6, fontWeight: 500 }}>
          Plan pricing rules and system limits are hardcoded at the backend level. Contact your core developer or database manager to adjust billing structures or tier restrictions.
        </span>
      </div>

      {/* Add Staff Guide Modal */}
      {showAddStaff && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(17, 17, 17, 0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={() => setShowAddStaff(false)}>
          <div style={{ background: '#FFFFFF', width: '100%', maxWidth: 540, borderRadius: 24, padding: 32, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', animation: 'scaleIn 0.2s ease-out' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 900, color: '#111', margin: 0, letterSpacing: '-0.5px' }}>Add Administrative Staff</h2>
              <button style={{ background: '#F3F4F6', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', color: '#4B5563', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowAddStaff(false)}>
                <X size={18} />
              </button>
            </div>
            
            <p style={{ fontSize: 14, color: '#4B5563', marginBottom: 20, lineHeight: 1.6 }}>
              To ensure maximum security, staff credentials are created securely inside your <strong>Supabase Auth Dashboard</strong>. Follow these steps:
            </p>

            <ol style={{ fontSize: 13.5, color: '#374151', paddingLeft: 20, lineHeight: 1.6, marginBottom: 20 }}>
              <li>Go to <strong>Authentication &gt; Users</strong> in Supabase and click <strong>Add User</strong>.</li>
              <li>Create the user (make sure <strong>Auto Confirm</strong> is checked).</li>
              <li>Go to the <strong>Table Editor &gt; profiles</strong> table and update their role column to <code style={{ background: '#F3F4F6', padding: '2px 6px', borderRadius: 4, color: '#F97316' }}>staff</code>.</li>
            </ol>

            <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px', background: '#111', color: '#FFF', borderRadius: 14, fontWeight: 800, fontSize: 14, textDecoration: 'none', transition: 'background 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#27272A')}
              onMouseLeave={e => (e.currentTarget.style.background = '#111')}
            >
              Open Supabase Dashboard <ExternalLink size={16} />
            </a>
          </div>
        </div>
      )}

      <style>{`
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}