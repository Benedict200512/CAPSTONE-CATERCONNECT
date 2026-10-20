import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { assignStaffRole } from '../../lib/profileRoles';
import { createStaffAccount } from '../../lib/staffProvisioning';
import { useAuth } from '../../context/AuthContext';
import { AlertTriangle, CreditCard, Package, Calendar, Loader2, Shield, Mail, UserPlus, X, User, Lock } from 'lucide-react';

type StaffAccount = { id: string; role: 'staff' | 'admin'; full_name: string | null; email: string | null; created_at: string | null };

export default function PlatformSettings() {
  const { profile } = useAuth();
  const [staffList, setStaffList] = useState<StaffAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [savingRole, setSavingRole] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [confirmStaffPassword, setConfirmStaffPassword] = useState('');
  const [creatingStaff, setCreatingStaff] = useState(false);
  const [staffError, setStaffError] = useState('');

  useEffect(() => {
    let active = true;
    supabase.from('profiles').select('*').in('role', ['staff', 'admin']).order('created_at', { ascending: false })
      .then(({ data, error: loadError }) => {
        if (!active) return;
        if (loadError) setError('Unable to load staff accounts. Please refresh and try again.');
        else setStaffList(data ?? []);
        setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (savingRole || profile?.role !== 'admin' || userId === profile.id) return;
    setSavingRole(userId);
    setMessage('');
    setError('');
    try {
      const result = await assignStaffRole(userId, newRole);
      setStaffList(previous => previous.map(account => account.id === result.id ? { ...account, role: result.role as 'staff' | 'admin' } : account));
      setMessage('Account role updated successfully.');
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message
        : typeof cause === 'object' && cause !== null && 'message' in cause
          ? String(cause.message) : 'Unable to update the role. Please try again.');
    } finally {
      setSavingRole(null);
    }
  };

  const handleCreateStaff = async (event: React.FormEvent) => {
    event.preventDefault();
    if (creatingStaff || profile?.role !== 'admin') return;
    if (staffPassword !== confirmStaffPassword) { setStaffError('Passwords must match.'); return; }
    if (staffPassword.length < 12 || new TextEncoder().encode(staffPassword).length > 72) { setStaffError('Use at least 12 characters and no more than 72 UTF-8 bytes.'); return; }
    setCreatingStaff(true);
    setStaffError('');
    setMessage('');
    try {
      await createStaffAccount(fullName, email, staffPassword);
      setFullName(''); setEmail(''); setShowAddStaff(false);
      setMessage('Staff account created. They can sign in with their email and password.');
      const { data, error: refreshError } = await supabase.from('profiles').select('*').in('role', ['staff', 'admin']).order('created_at', { ascending: false });
      if (refreshError) setError('Staff account created, but the table could not refresh. Refresh this page; do not create it again.');
      else { setStaffList(data ?? []); setError(''); }
    } catch (cause: unknown) {
      setStaffError(cause instanceof Error ? cause.message : 'Unable to create staff account. Check the account list before retrying.');
    } finally { setStaffPassword(''); setConfirmStaffPassword(''); setCreatingStaff(false); }
  };

  const closeStaffForm = () => {
    if (creatingStaff) return;
    setStaffPassword(''); setConfirmStaffPassword(''); setStaffError(''); setShowAddStaff(false);
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
          <p style={{ fontSize: 15, color: '#6B7280', margin: 0 }}>View existing staff and administrator accounts and subscription tiers.</p>
        </div>
      </div>

      {/* Staff & Admin Section Header */}
      {error && <p role="alert" style={{ color: '#B91C1C', marginBottom: 20 }}>{error}</p>}
      {message && <p role="status" style={{ color: '#15803D', marginBottom: 20 }}>{message}</p>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: '#111', display: 'flex', alignItems: 'center', gap: 10, margin: 0, letterSpacing: '-0.5px' }}>
          <Shield size={22} color="#F97316" /> Staff & Admin Accounts
        </h2>
        <button type="button" onClick={() => setShowAddStaff(true)} disabled={profile?.role !== 'admin'}
          style={{ background: '#F97316', color: '#FFF', border: 'none', borderRadius: 12, padding: '10px 18px', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
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
                    <td style={{ padding: '18px 24px', color: '#4B5563', fontSize: 14, verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Mail size={14} color="#9CA3AF" style={{ flexShrink: 0 }} />
                        <span>{u.email}</span>
                      </div>
                    </td>
                    <td style={{ padding: '18px 24px' }}>
                      <span style={{ padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: u.role === 'admin' ? '#FFF7ED' : '#F0FDF4', color: u.role === 'admin' ? '#F97316' : '#16A34A', border: `1px solid ${u.role === 'admin' ? '#FFEDD5' : '#BBF7D0'}`, textTransform: 'capitalize' }}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ padding: '18px 24px', fontSize: 13, color: '#6B7280', fontWeight: 500 }}>
                      {u.created_at ? new Date(u.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </td>
                    <td style={{ padding: '18px 24px', verticalAlign: 'middle' }}>
                      <select aria-label={`Permissions for ${u.full_name ?? u.email ?? 'account'}`}
                        disabled={savingRole !== null || profile?.role !== 'admin' || u.id === profile.id}
                        value={u.role} onChange={event => void handleRoleChange(u.id, event.target.value)}
                        style={{ border: '1px solid #E5E7EB', borderRadius: 10, padding: '8px 14px', fontSize: 13, background: '#F9FAFB', color: '#111', fontWeight: 700 }}>
                        <option value="admin">System Administrator</option>
                        <option value="staff">Platform Staff</option>
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

      {/* Add Staff Account Modal */}
      {showAddStaff && (
        <div 
          role="presentation" 
          style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: 20 }} 
          onClick={closeStaffForm}
        >
          <div 
            role="dialog" 
            aria-modal="true" 
            aria-labelledby="add-staff-title" 
            style={{ background: '#FFF', maxWidth: 480, width: '100%', borderRadius: 24, padding: 32, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }} 
            onClick={event => event.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, borderBottom: '1px solid #E5E7EB', paddingBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: '#FFF7ED', color: '#F97316', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UserPlus size={20} />
                </div>
                <div>
                  <h2 id="add-staff-title" style={{ fontSize: 18, fontWeight: 900, color: '#111', margin: 0 }}>Add Staff Account</h2>
                  <p style={{ fontSize: 12.5, color: '#6B7280', margin: '2px 0 0' }}>Provision a new administrative or staff user</p>
                </div>
              </div>
              <button 
                type="button" 
                aria-label="Close staff account form" 
                disabled={creatingStaff} 
                onClick={closeStaffForm} 
                style={{ border: '1px solid #E5E7EB', background: '#FFF', borderRadius: '50%', width: 36, height: 36, display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#4B5563' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: 13.5, color: '#4B5563', lineHeight: 1.5, marginBottom: 20 }}>
              Create a new staff account with an initial password. Existing user accounts cannot be converted. Staff will sign in through the standard portal login page.
            </p>

            <form onSubmit={handleCreateStaff} style={{ display: 'grid', gap: 16 }}>
              <div>
                <label htmlFor="staff-full-name" style={{ fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color: '#374151' }}>
                  <User size={14} color="#6B7280" /> Full Name
                </label>
                <input 
                  id="staff-full-name" 
                  required 
                  maxLength={150} 
                  autoComplete="name" 
                  value={fullName} 
                  disabled={creatingStaff} 
                  placeholder="e.g.  Benedict Alicante"
                  onChange={event => setFullName(event.target.value)} 
                  style={{ width: '100%', boxSizing: 'border-box', padding: '12px 16px', border: '1px solid #D1D5DB', borderRadius: 12, fontSize: 14, outline: 'none', background: '#FFF', color: '#111' }} 
                />
              </div>

              <div>
                <label htmlFor="staff-email" style={{ fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color: '#374151' }}>
                  <Mail size={14} color="#6B7280" /> Email Address
                </label>
                <input 
                  id="staff-email" 
                  type="email" 
                  required 
                  maxLength={254} 
                  autoComplete="email" 
                  value={email} 
                  disabled={creatingStaff} 
                  placeholder="staff@caterconnect.ph"
                  onChange={event => setEmail(event.target.value)} 
                  style={{ width: '100%', boxSizing: 'border-box', padding: '12px 16px', border: '1px solid #D1D5DB', borderRadius: 12, fontSize: 14, outline: 'none', background: '#FFF', color: '#111' }} 
                />
              </div>

              <div>
                <label htmlFor="staff-password" style={{ fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color: '#374151' }}>
                  <Lock size={14} color="#6B7280" /> Password (min 12 characters)
                </label>
                <input 
                  id="staff-password" 
                  type="password" 
                  required 
                  minLength={12} 
                  maxLength={72} 
                  autoComplete="new-password" 
                  value={staffPassword} 
                  disabled={creatingStaff} 
                  placeholder="••••••••••••"
                  onChange={event => setStaffPassword(event.target.value)} 
                  style={{ width: '100%', boxSizing: 'border-box', padding: '12px 16px', border: '1px solid #D1D5DB', borderRadius: 12, fontSize: 14, outline: 'none', background: '#FFF', color: '#111' }} 
                />
              </div>

              <div>
                <label htmlFor="staff-confirm-password" style={{ fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color: '#374151' }}>
                  <Lock size={14} color="#6B7280" /> Confirm Password
                </label>
                <input 
                  id="staff-confirm-password" 
                  type="password" 
                  required 
                  minLength={12} 
                  maxLength={72} 
                  autoComplete="new-password" 
                  value={confirmStaffPassword} 
                  disabled={creatingStaff} 
                  placeholder="••••••••••••"
                  onChange={event => setConfirmStaffPassword(event.target.value)} 
                  style={{ width: '100%', boxSizing: 'border-box', padding: '12px 16px', border: '1px solid #D1D5DB', borderRadius: 12, fontSize: 14, outline: 'none', background: '#FFF', color: '#111' }} 
                />
              </div>

              {staffError && (
                <div role="alert" style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', padding: '10px 14px', borderRadius: 10, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertTriangle size={16} /> {staffError}
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, marginTop: 8, borderTop: '1px solid #E5E7EB', paddingTop: 16 }}>
                <button 
                  type="button" 
                  disabled={creatingStaff} 
                  onClick={closeStaffForm} 
                  style={{ flex: 1, padding: '12px 16px', background: '#F3F4F6', color: '#374151', border: '1px solid #E5E7EB', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={creatingStaff || profile?.role !== 'admin' || !fullName.trim() || !email.trim() || !staffPassword || !confirmStaffPassword} 
                  style={{ 
                    flex: 1, padding: '12px 16px', background: '#F97316', color: '#FFF', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    opacity: creatingStaff || profile?.role !== 'admin' || !fullName.trim() || !email.trim() || !staffPassword || !confirmStaffPassword ? 0.7 : 1 
                  }}
                >
                  {creatingStaff ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                  {creatingStaff ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}