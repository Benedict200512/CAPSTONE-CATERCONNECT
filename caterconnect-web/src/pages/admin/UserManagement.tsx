
import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Users,
  Search,
  Eye,
  Ban,
  X,
  Store,
  Loader2,
  Mail,
  Hash,
  CalendarDays,
  ShieldAlert,
  AlertTriangle,
  Layers,
  Shield,
  UserCheck,
} from 'lucide-react';

type User = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  created_at: string;
  avatar_url?: string | null;
  status?: string;
  business_name?: string | null;
  logo_url?: string | null;
};

type CatererInfo = {
  business_name?: string | null;
  logo_url?: string | null;
  cover_photo_url?: string | null;
  city?: string | null;
  contact_phone?: string | null;
  verification_status?: string | null;
  subscription_plan?: string | null;
};

type SelectedUser = User & {
  caterer_info?: CatererInfo | null;
};

type AccountAction = 'suspend' | 'reactivate';

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<SelectedUser | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [confirmSuspend, setConfirmSuspend] = useState<User | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [reason, setReason] = useState('');

  const load = async () => {
    setLoading(true);

    try {
      let query = supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('role', filter);
      }

      const { data: profileData, error: profileError } = await query;

      if (profileError) throw profileError;

      let fetchedUsers: User[] = (profileData ?? []) as User[];

      const catererIds = fetchedUsers
        .filter(user => user.role === 'caterer')
        .map(user => user.id);

      if (catererIds.length > 0) {
        const { data: catererData, error: catererError } = await supabase
          .from('caterers')
          .select('user_id, business_name, logo_url')
          .in('user_id', catererIds);

        if (catererError) throw catererError;

        if (catererData) {
          const catererMap = new Map(
            catererData.map(caterer => [caterer.user_id, caterer])
          );

          fetchedUsers = fetchedUsers.map(user => {
            if (user.role !== 'caterer') return user;

            const caterer = catererMap.get(user.id);

            return {
              ...user,
              business_name: caterer?.business_name ?? null,
              logo_url: caterer?.logo_url ?? null,
            };
          });
        }
      }

      setUsers(fetchedUsers);

      const roles = ['customer', 'caterer', 'staff', 'admin'];

      const countResults = await Promise.all(
        roles.map(role =>
          supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true })
            .eq('role', role)
        )
      );

      const countError = countResults.find(result => result.error);
      if (countError?.error) throw countError.error;

      const newCounts: Record<string, number> = { all: 0 };

      roles.forEach((role, index) => {
        newCounts[role] = countResults[index].count ?? 0;
        newCounts.all += countResults[index].count ?? 0;
      });

      setCounts(newCounts);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to load user directory.';

      console.error('User directory loading failed:', error);
      alert('Failed to load users: ' + message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [filter]);

  const handleViewUser = async (user: User) => {
    let extra: { caterer_info?: CatererInfo | null } = {};

    if (user.role === 'caterer') {
      const { data, error } = await supabase
        .from('caterers')
        .select(
          'business_name, logo_url, cover_photo_url, city, contact_phone, verification_status, subscription_plan'
        )
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        alert('Failed to load caterer details: ' + error.message);
        return;
      }

      extra = { caterer_info: data as CatererInfo | null };
    }

    setSelected({ ...user, ...extra });
  };

  const openStatusConfirmation = (user: User) => {
    setReason('');
    setConfirmSuspend(user);
  };

  const closeStatusConfirmation = () => {
    if (actionLoading) return;
    setConfirmSuspend(null);
    setReason('');
  };

  // Admin uses its own RPC. The Staff RPC remains unchanged.
  const handleSuspendAccount = async () => {
    if (!confirmSuspend || actionLoading) return;

    const target = confirmSuspend;
    const action: AccountAction =
      target.status === 'suspended' ? 'reactivate' : 'suspend';
    const trimmedReason = reason.trim();

    if (trimmedReason.length < 10 || trimmedReason.length > 2000) {
      alert('Please enter a reason containing 10 to 2000 characters.');
      return;
    }

    if (target.role === 'admin' || !['customer', 'caterer'].includes(target.role)) {
      alert('Only customer and caterer accounts can be managed here.');
      return;
    }

    setActionLoading(true);

    try {
      const { error } = await supabase.rpc('admin_account_status_action', {
        p_user_id: target.id,
        p_action: action,
        p_reason: trimmedReason,
      });

      if (error) throw error;

      const { data: updatedProfile, error: statusError } = await supabase
        .from('profiles')
        .select('status')
        .eq('id', target.id)
        .maybeSingle();

      if (statusError) throw statusError;

      if (!updatedProfile) {
        throw new Error('The account action completed, but the profile could not be reloaded.');
      }

      const actualStatus = updatedProfile.status ?? 'unknown';

      await load();

      setSelected(previous =>
        previous && previous.id === target.id
          ? { ...previous, status: actualStatus }
          : previous
      );

      setConfirmSuspend(null);
      setReason('');

      alert(
        action === 'suspend'
          ? 'Account suspended successfully.'
          : `Account reactivation completed. Current status: ${actualStatus}.`
      );
    } catch (error: unknown) {
      const message =
        typeof error === 'object' &&
        error !== null &&
        'message' in error
          ? String(error.message)
          : 'Unexpected error. Please try again.';

      console.error('Admin account status update failed:', error);
      alert('Failed to update account status: ' + message);
    } finally {
      setActionLoading(false);
    }
  };

  const filtered = users.filter(user =>
    (user.full_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (user.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (user.business_name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const roleColor: Record<string, string> = {
    customer: '#2563EB',
    caterer: '#7C3AED',
    staff: '#16A34A',
    admin: '#F97316',
  };

  const roleBg: Record<string, string> = {
    customer: '#EFF6FF',
    caterer: '#F5F3FF',
    staff: '#F0FDF4',
    admin: '#FFF7ED',
  };

  const roleBorder: Record<string, string> = {
    customer: '#BFDBFE',
    caterer: '#DDD6FE',
    staff: '#BBF7D0',
    admin: '#FFEDD5',
  };

  const tabs = ['all', 'customer', 'caterer', 'staff', 'admin'];

  const tabIcons: Record<string, typeof Users> = {
    all: Layers,
    customer: Users,
    caterer: Store,
    staff: UserCheck,
    admin: Shield,
  };

  const isConfirmingReactivation = confirmSuspend?.status === 'suspended';
  const reasonLength = reason.trim().length;
  const reasonValid = reasonLength >= 10 && reasonLength <= 2000;

  return (
    <div style={{ paddingBottom: 40 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginBottom: 32,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 900,
              color: '#111',
              marginBottom: 6,
              letterSpacing: '-0.5px',
            }}
          >
            User Directory
          </h1>
          <p style={{ fontSize: 15, color: '#6B7280', margin: 0 }}>
            Securely manage, review, and control all platform accounts.
          </p>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
          gap: 20,
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 6,
            background: '#F3F4F6',
            padding: 6,
            borderRadius: 14,
            border: '1px solid #E5E7EB',
            flexWrap: 'wrap',
          }}
        >
          {tabs.map(tab => {
            const Icon = tabIcons[tab] || Users;

            return (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                style={{
                  padding: '8px 18px',
                  fontSize: 13,
                  fontWeight: 700,
                  border: 'none',
                  borderRadius: 10,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  background: filter === tab ? '#FFFFFF' : 'transparent',
                  color: filter === tab ? '#111' : '#6B7280',
                  boxShadow:
                    filter === tab
                      ? '0 2px 4px rgba(0,0,0,0.04)'
                      : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Icon
                  size={14}
                  color={filter === tab ? '#F97316' : '#9CA3AF'}
                />
                {tab}
                <span style={{ opacity: 0.6, marginLeft: 2 }}>
                  {counts[tab] !== undefined ? counts[tab] : ''}
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ position: 'relative', width: '100%', maxWidth: 380 }}>
          <Search
            size={18}
            color="#9CA3AF"
            style={{
              position: 'absolute',
              left: 16,
              top: '50%',
              transform: 'translateY(-50%)',
            }}
          />
          <input
            placeholder="Search by name, email, or business..."
            value={search}
            onChange={event => setSearch(event.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '12px 16px 12px 44px',
              borderRadius: 14,
              border: '1px solid #E5E7EB',
              outline: 'none',
              fontSize: 14,
              color: '#111',
              background: '#FFFFFF',
              boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
            }}
          />
        </div>
      </div>

      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 20,
          border: '1px solid #E5E7EB',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)',
          overflow: 'hidden',
        }}
      >
        {loading ? (
          <div
            style={{
              padding: 80,
              textAlign: 'center',
              color: '#9CA3AF',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <Loader2
              size={36}
              color="#F97316"
              style={{ animation: 'spin 1s linear infinite' }}
            />
            <div style={{ fontSize: 15, fontWeight: 600 }}>
              Syncing user directory...
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 80, textAlign: 'center', color: '#9CA3AF' }}>
            <Users size={32} color="#D1D5DB" />
            <h3 style={{ color: '#111' }}>No users found</h3>
            <p>
              We couldn't find anyone matching your current search or filters.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                textAlign: 'left',
              }}
            >
              <thead>
                <tr style={{ background: '#F9FAFB' }}>
                  <th style={thStyle}>User Profile</th>
                  <th style={thStyle}>Account Details</th>
                  <th style={thStyle}>System Role</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user, index) => {
                  const isSuspended = user.status === 'suspended';
                  const displayName =
                    user.role === 'caterer' && user.business_name
                      ? user.business_name
                      : user.full_name ?? '—';

                  return (
                    <tr
                      key={user.id}
                      style={{
                        borderBottom:
                          index === filtered.length - 1
                            ? 'none'
                            : '1px solid #F3F4F6',
                        background: isSuspended ? '#FEF2F2' : '#FFFFFF',
                      }}
                    >
                      <td style={tdStyle}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 16,
                          }}
                        >
                          {user.role === 'caterer' && user.logo_url ? (
                            <img
                              src={user.logo_url}
                              alt={displayName}
                              style={avatarStyle(true)}
                            />
                          ) : user.avatar_url ? (
                            <img
                              src={user.avatar_url}
                              alt={user.full_name}
                              style={avatarStyle(false)}
                            />
                          ) : (
                            <div
                              style={{
                                ...avatarStyle(user.role === 'caterer'),
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: roleBg[user.role] ?? '#F3F4F6',
                                color: roleColor[user.role] ?? '#6B7280',
                                fontWeight: 800,
                              }}
                            >
                              {displayName.charAt(0).toUpperCase()}
                            </div>
                          )}

                          <div>
                            <div
                              style={{
                                fontWeight: 800,
                                fontSize: 15,
                                color: '#111',
                                marginBottom: 4,
                              }}
                            >
                              {displayName}
                              {isSuspended && (
                                <span
                                  style={{
                                    marginLeft: 8,
                                    background: '#FEE2E2',
                                    color: '#DC2626',
                                    fontSize: 10,
                                    fontWeight: 800,
                                    padding: '2px 8px',
                                    borderRadius: 6,
                                  }}
                                >
                                  SUSPENDED
                                </span>
                              )}
                            </div>

                            {user.role === 'caterer' && user.business_name && (
                              <div style={{ fontSize: 12, color: '#6B7280' }}>
                                Owner: {user.full_name ?? '—'}
                              </div>
                            )}

                            <div
                              style={{
                                fontSize: 12,
                                color: '#9CA3AF',
                                fontFamily: 'monospace',
                              }}
                            >
                              ID: {user.id.slice(0, 10)}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td style={tdStyle}>
                        <div style={{ fontSize: 14, color: '#4B5563' }}>
                          <Mail size={14} style={inlineIconStyle} />
                          {user.email}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: '#9CA3AF',
                            marginTop: 6,
                          }}
                        >
                          <CalendarDays size={14} style={inlineIconStyle} />
                          Joined{' '}
                          {user.created_at
                            ? new Date(user.created_at).toLocaleDateString(
                                'en-PH',
                                {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                }
                              )
                            : '—'}
                        </div>
                      </td>

                      <td style={tdStyle}>
                        <span
                          style={{
                            padding: '6px 12px',
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 700,
                            textTransform: 'capitalize',
                            background: roleBg[user.role] ?? '#F3F4F6',
                            color: roleColor[user.role] ?? '#6B7280',
                            border: `1px solid ${roleBorder[user.role] ?? '#E5E7EB'}`,
                          }}
                        >
                          {user.role}
                        </span>
                      </td>

                      <td style={tdStyle}>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <button
                            onClick={() => void handleViewUser(user)}
                            style={buttonStyle}
                          >
                            <Eye size={16} />
                            Profile
                          </button>

                          {user.role !== 'admin' && (
                            <button
                              onClick={() => openStatusConfirmation(user)}
                              style={{
                                ...buttonStyle,
                                background: isSuspended ? '#DC2626' : '#FFF5F5',
                                color: isSuspended ? '#FFFFFF' : '#DC2626',
                              }}
                            >
                              <Ban size={16} />
                              {isSuspended ? 'Unsuspend' : 'Suspend'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <div style={overlayStyle} onClick={() => setSelected(null)}>
          <div
            style={detailModalStyle}
            onClick={event => event.stopPropagation()}
          >
            <div
              style={{
                position: 'relative',
                height: selected.caterer_info?.cover_photo_url ? 180 : 100,
                background: '#F3F4F6',
              }}
            >
              {selected.caterer_info?.cover_photo_url && (
                <img
                  src={selected.caterer_info.cover_photo_url}
                  alt="Cover"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              )}
              <button
                style={closeButtonStyle}
                onClick={() => setSelected(null)}
                aria-label="Close user details"
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '0 32px 32px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-end',
                  marginTop: -40,
                  marginBottom: 16,
                }}
              >
                {selected.caterer_info?.logo_url ? (
                  <img
                    src={selected.caterer_info.logo_url}
                    alt="Business logo"
                    style={avatarStyle(true, 88)}
                  />
                ) : selected.avatar_url ? (
                  <img
                    src={selected.avatar_url}
                    alt={selected.full_name}
                    style={avatarStyle(false, 88)}
                  />
                ) : (
                  <div
                    style={{
                      ...avatarStyle(selected.role === 'caterer', 88),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: roleBg[selected.role] ?? '#F3F4F6',
                      fontSize: 32,
                      fontWeight: 900,
                    }}
                  >
                    {(selected.full_name ?? 'U').charAt(0).toUpperCase()}
                  </div>
                )}

                <span
                  style={{
                    padding: '6px 14px',
                    borderRadius: 20,
                    fontSize: 13,
                    fontWeight: 800,
                    background: roleBg[selected.role] ?? '#F3F4F6',
                    color: roleColor[selected.role] ?? '#6B7280',
                  }}
                >
                  {selected.role} Account
                </span>
              </div>

              <h2 style={{ color: '#111' }}>
                {selected.caterer_info?.business_name ??
                  selected.business_name ??
                  selected.full_name}
              </h2>

              {selected.role === 'caterer' && (
                <p style={{ color: '#4B5563' }}>
                  <Store size={16} style={inlineIconStyle} />
                  Owner: {selected.full_name}
                </p>
              )}

              <h4>System Details</h4>
              <div style={detailCardStyle}>
                <DetailRow
                  icon={<Mail size={16} />}
                  label="Email"
                  value={selected.email}
                />
                <DetailRow
                  icon={<Hash size={16} />}
                  label="User ID"
                  value={selected.id}
                />
                <DetailRow
                  icon={<CalendarDays size={16} />}
                  label="Joined"
                  value={
                    selected.created_at
                      ? new Date(selected.created_at).toLocaleDateString(
                          'en-PH',
                          {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                          }
                        )
                      : '—'
                  }
                />
                <DetailRow
                  icon={<Shield size={16} />}
                  label="Account status"
                  value={selected.status ?? '—'}
                />
              </div>

              {selected.role === 'caterer' && selected.caterer_info && (
                <>
                  <h4>Vendor Profile</h4>
                  <div style={detailCardStyle}>
                    <DetailRow
                      label="City"
                      value={selected.caterer_info.city ?? '—'}
                    />
                    <DetailRow
                      label="Phone"
                      value={selected.caterer_info.contact_phone ?? '—'}
                    />
                    <DetailRow
                      label="Clearance"
                      value={selected.caterer_info.verification_status ?? '—'}
                    />
                    <DetailRow
                      label="Plan"
                      value={
                        selected.caterer_info.subscription_plan?.toUpperCase() ??
                        '—'
                      }
                    />
                  </div>
                </>
              )}

              {selected.role !== 'admin' && (
                <button
                  onClick={() => openStatusConfirmation(selected)}
                  style={{
                    width: '100%',
                    padding: 14,
                    marginTop: 24,
                    background:
                      selected.status === 'suspended' ? '#111' : '#FEF2F2',
                    color: selected.status === 'suspended' ? '#FFF' : '#DC2626',
                    border: '1px solid #E5E7EB',
                    borderRadius: 14,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  <ShieldAlert size={18} style={inlineIconStyle} />
                  {selected.status === 'suspended'
                    ? 'Unsuspend Platform Access'
                    : 'Suspend Platform Access'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {confirmSuspend && (
        <div style={overlayStyle} onClick={closeStatusConfirmation}>
          <div
            style={confirmModalStyle}
            onClick={event => event.stopPropagation()}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: isConfirmingReactivation ? '#DCFCE7' : '#FEF2F2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
              }}
            >
              {isConfirmingReactivation ? (
                <UserCheck size={28} color="#16A34A" />
              ) : (
                <AlertTriangle size={28} color="#DC2626" />
              )}
            </div>

            <h3 style={{ marginBottom: 8, color: '#111' }}>
              {isConfirmingReactivation ? 'Reactivate Account' : 'Suspend Account'}
            </h3>

            <p style={{ color: '#6B7280', lineHeight: 1.6 }}>
              {isConfirmingReactivation
                ? 'You are about to restore platform access for'
                : 'You are about to suspend platform access for'}{' '}
              <strong style={{ color: '#111' }}>
                {confirmSuspend.role === 'caterer' &&
                confirmSuspend.business_name
                  ? confirmSuspend.business_name
                  : confirmSuspend.full_name}
              </strong>{' '}
              ({confirmSuspend.email}).
            </p>

            <div style={{ textAlign: 'left', marginTop: 22 }}>
              <label
                htmlFor="account-action-reason"
                style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 800,
                  color: '#374151',
                  marginBottom: 8,
                }}
              >
                Reason for {isConfirmingReactivation ? 'reactivation' : 'suspension'}
                <span style={{ color: '#DC2626' }}> *</span>
              </label>

              <textarea
                id="account-action-reason"
                value={reason}
                onChange={event => setReason(event.target.value)}
                placeholder={
                  isConfirmingReactivation
                    ? 'Explain why platform access is being restored...'
                    : 'Explain why this account is being suspended...'
                }
                rows={4}
                maxLength={2000}
                disabled={actionLoading}
                style={{
                  display: 'block',
                  width: '100%',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                  minHeight: 110,
                  padding: 14,
                  borderRadius: 12,
                  border: '1px solid #D1D5DB',
                  outline: 'none',
                  fontFamily: 'inherit',
                  fontSize: 14,
                  lineHeight: 1.5,
                  color: '#111827',
                  background: actionLoading ? '#F9FAFB' : '#FFFFFF',
                }}
              />

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  marginTop: 7,
                  fontSize: 12,
                }}
              >
                <span style={{ color: reasonValid ? '#16A34A' : '#6B7280' }}>
                  {reasonLength < 10
                    ? `${10 - reasonLength} more characters required`
                    : 'Minimum length reached'}
                </span>
                <span style={{ color: '#9CA3AF' }}>{reason.length}/2000</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button
                disabled={actionLoading}
                onClick={closeStatusConfirmation}
                style={{
                  ...buttonStyle,
                  justifyContent: 'center',
                  flex: 1,
                  padding: '12px 14px',
                  opacity: actionLoading ? 0.6 : 1,
                  cursor: actionLoading ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>

              <button
                disabled={actionLoading || !reasonValid}
                onClick={() => void handleSuspendAccount()}
                style={{
                  ...buttonStyle,
                  justifyContent: 'center',
                  flex: 1,
                  padding: '12px 14px',
                  background: isConfirmingReactivation ? '#16A34A' : '#DC2626',
                  color: '#FFFFFF',
                  border: 'none',
                  opacity: actionLoading || !reasonValid ? 0.55 : 1,
                  cursor:
                    actionLoading || !reasonValid ? 'not-allowed' : 'pointer',
                }}
              >
                {actionLoading ? (
                  <Loader2
                    size={16}
                    style={{ animation: 'spin 1s linear infinite' }}
                  />
                ) : (
                  <ShieldAlert size={16} />
                )}
                {actionLoading
                  ? 'Processing...'
                  : isConfirmingReactivation
                    ? 'Confirm Reactivation'
                    : 'Confirm Suspension'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        #account-action-reason:focus {
          border-color: #F97316;
          box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.12);
        }
      `}</style>
    </div>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon?: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 16,
        padding: '14px 16px',
        borderBottom: '1px solid #E5E7EB',
      }}
    >
      <span
        style={{
          color: '#6B7280',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
        }}
      >
        {icon}
        {label}
      </span>
      <span
        style={{
          color: '#111',
          textAlign: 'right',
          overflowWrap: 'anywhere',
        }}
      >
        {value}
      </span>
    </div>
  );
}

const thStyle: CSSProperties = {
  padding: '16px 24px',
  fontSize: 12,
  fontWeight: 800,
  color: '#6B7280',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  textAlign: 'left',
};

const tdStyle: CSSProperties = {
  padding: '20px 24px',
  verticalAlign: 'middle',
};

const inlineIconStyle: CSSProperties = {
  display: 'inline-block',
  verticalAlign: 'middle',
  marginRight: 6,
};

const avatarStyle = (square: boolean, size = 44): CSSProperties => ({
  width: size,
  height: size,
  borderRadius: square ? Math.max(12, size * 0.22) : '50%',
  objectFit: 'cover',
  border: '1px solid #E5E7EB',
  background: '#FFF',
  flexShrink: 0,
});

const buttonStyle: CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #E5E7EB',
  borderRadius: 10,
  padding: '8px 14px',
  fontSize: 13,
  fontWeight: 700,
  color: '#4B5563',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
};

const closeButtonStyle: CSSProperties = {
  position: 'absolute',
  top: 14,
  right: 14,
  width: 36,
  height: 36,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid rgba(255,255,255,0.7)',
  borderRadius: '50%',
  background: 'rgba(255,255,255,0.95)',
  color: '#111827',
  cursor: 'pointer',
  boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
};

const detailCardStyle: CSSProperties = {
  background: '#F9FAFB',
  border: '1px solid #E5E7EB',
  borderRadius: 14,
  overflow: 'hidden',
  marginBottom: 20,
};

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(17,17,17,0.6)',
  backdropFilter: 'blur(8px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1100,
  padding: 20,
};

const detailModalStyle: CSSProperties = {
  background: '#FFFFFF',
  width: '100%',
  maxWidth: 600,
  maxHeight: '90vh',
  overflowY: 'auto',
  borderRadius: 24,
  boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
  animation: 'scaleIn 0.2s ease-out',
};

const confirmModalStyle: CSSProperties = {
  background: '#FFFFFF',
  width: '100%',
  maxWidth: 460,
  maxHeight: '90vh',
  overflowY: 'auto',
  borderRadius: 24,
  padding: 32,
  boxSizing: 'border-box',
  boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
  textAlign: 'center',
  animation: 'scaleIn 0.2s ease-out',
};
