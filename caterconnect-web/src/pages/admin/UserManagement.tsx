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

type CatererInfo = {
  business_name?: string | null;
  logo_url?: string | null;
  cover_photo_url?: string | null;
  city?: string | null;
  contact_phone?: string | null;
  verification_status?: string | null;
  subscription_plan?: string | null;
};

type User = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  created_at: string;
  avatar_url?: string | null;
  status?: string | null;
  business_name?: string | null;
  logo_url?: string | null;
  caterer_info?: CatererInfo | null;
};

function ProfileImage({
  src,
  alt,
  square = false,
  size = 44,
  fallback = 'U',
  background = '#F3F4F6',
  color = '#6B7280',
}: {
  src?: string | null;
  alt: string;
  square?: boolean;
  size?: number;
  fallback?: string;
  background?: string;
  color?: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const commonStyle: CSSProperties = {
    width: size,
    height: size,
    minWidth: size,
    minHeight: size,
    display: 'block',
    objectFit: 'cover',
    objectPosition: 'center',
    borderRadius: square ? Math.max(12, size * 0.22) : '50%',
    border: '1px solid #E5E7EB',
    background: '#FFFFFF',
    flexShrink: 0,
  };

  if (!src || failed) {
    return (
      <div
        aria-label={alt}
        title={alt}
        style={{
          ...commonStyle,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background,
          color,
          fontWeight: 800,
          fontSize: Math.max(16, size * 0.36),
        }}
      >
        {(fallback.trim().charAt(0) || 'U').toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      style={commonStyle}
    />
  );
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<User | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [confirmSuspend, setConfirmSuspend] = useState<User | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [reason, setReason] = useState('');
  const [loadError, setLoadError] = useState('');

  const load = async () => {
    setLoading(true);
    setLoadError('');

    try {
      let query = supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter !== 'all') query = query.eq('role', filter);

      const { data: profileData, error: profileError } = await query;
      if (profileError) throw profileError;

      let fetchedUsers: User[] = (profileData ?? []) as User[];
      const catererIds = fetchedUsers
        .filter(user => user.role === 'caterer')
        .map(user => user.id);

      if (catererIds.length > 0) {
        const { data: catererData, error: catererError } = await supabase
          .from('caterers')
          .select(
            'user_id, business_name, logo_url, cover_photo_url, city, contact_phone, verification_status, subscription_plan'
          )
          .in('user_id', catererIds);

        if (catererError) throw catererError;

        const catererMap = new Map<string, CatererInfo>(
          (catererData ?? []).map((caterer: any) => [
            caterer.user_id,
            {
              business_name: caterer.business_name ?? null,
              logo_url: caterer.logo_url ?? null,
              cover_photo_url: caterer.cover_photo_url ?? null,
              city: caterer.city ?? null,
              contact_phone: caterer.contact_phone ?? null,
              verification_status: caterer.verification_status ?? null,
              subscription_plan: caterer.subscription_plan ?? null,
            },
          ])
        );

        fetchedUsers = fetchedUsers.map(user => {
          if (user.role !== 'caterer') return user;
          const caterer = catererMap.get(user.id);
          return {
            ...user,
            business_name: caterer?.business_name ?? null,
            logo_url: caterer?.logo_url ?? null,
            caterer_info: caterer ?? null,
          };
        });
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
      setLoadError('Failed to load users: ' + message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // Reload when the role tab changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const displayName = (user: User) =>
    user.role === 'caterer'
      ? user.caterer_info?.business_name?.trim() ||
        user.business_name?.trim() ||
        user.full_name ||
        'Unnamed caterer'
      : user.full_name || 'Unnamed user';

  const roleLabel = (role: string) =>
    role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Unknown';

  const handleViewUser = async (user: User) => {
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

      setSelected({
        ...user,
        business_name: data?.business_name ?? user.business_name ?? null,
        logo_url: data?.logo_url ?? user.logo_url ?? null,
        caterer_info: data ?? null,
      });
      return;
    }

    setSelected(user);
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

  // Uses the existing authorized RPC and records the reason in the audit trail.
  const handleSuspendAccount = async () => {
    if (!confirmSuspend || actionLoading) return;

    const target = confirmSuspend;
    const action = target.status === 'suspended' ? 'reactivate' : 'suspend';
    const trimmedReason = reason.trim();

    if (trimmedReason.length < 10 || trimmedReason.length > 2000) {
      alert('Please enter a reason containing 10 to 2000 characters.');
      return;
    }

    setActionLoading(true);

    try {
      const { error } = await supabase.rpc(
        'staff_account_monitoring_action',
        {
          p_user_id: target.id,
          p_action: action,
          p_reason: trimmedReason,
        }
      );

      if (error) throw error;

      const { data: updatedProfile, error: statusError } = await supabase
        .from('profiles')
        .select('status')
        .eq('id', target.id)
        .maybeSingle();

      if (statusError) throw statusError;

      const actualStatus =
        updatedProfile?.status ??
        (action === 'suspend' ? 'suspended' : 'active');

      setUsers(current =>
        current.map(user =>
          user.id === target.id ? { ...user, status: actualStatus } : user
        )
      );
      setSelected(previous =>
        previous && previous.id === target.id
          ? { ...previous, status: actualStatus }
          : previous
      );

      // Refresh directory counts/data, then reapply the confirmed status locally
      // so the current UI remains consistent if a read is slightly delayed.
      await load();
      setUsers(current =>
        current.map(user =>
          user.id === target.id ? { ...user, status: actualStatus } : user
        )
      );
      setSelected(previous =>
        previous && previous.id === target.id
          ? { ...previous, status: actualStatus }
          : previous
      );

      alert(
        action === 'suspend'
          ? 'Account suspended successfully.'
          : 'Account reactivated successfully.'
      );

      setConfirmSuspend(null);
      setReason('');
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === 'object' &&
              error !== null &&
              'message' in error
            ? String(error.message)
            : 'Unexpected error. Please try again.';
      console.error('Account status update failed:', error);
      alert('Failed to update account status: ' + message);
    } finally {
      setActionLoading(false);
    }
  };

  const filtered = users.filter(user => {
    const term = search.toLowerCase();
    return (
      displayName(user).toLowerCase().includes(term) ||
      (user.full_name ?? '').toLowerCase().includes(term) ||
      (user.email ?? '').toLowerCase().includes(term) ||
      (user.business_name ?? '').toLowerCase().includes(term)
    );
  });

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
  const tabIcons: Record<string, any> = {
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
    <div className="user-management" style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={pageTitleStyle}>User Directory</h1>
          <p style={subtitleStyle}>
            Securely manage, review, and control all platform accounts.
          </p>
        </div>
      </div>

      <div style={controlsStyle}>
        <div style={tabsContainerStyle}>
          {tabs.map(tab => {
            const Icon = tabIcons[tab] || Users;
            return (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                style={{
                  ...tabButtonStyle,
                  background: filter === tab ? '#FFFFFF' : 'transparent',
                  color: filter === tab ? '#111827' : '#6B7280',
                  boxShadow:
                    filter === tab ? '0 2px 4px rgba(0,0,0,0.04)' : 'none',
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

        <div style={searchWrapStyle}>
          <Search size={18} color="#9CA3AF" style={searchIconStyle} />
          <input
            placeholder="Search by name, email, or business..."
            value={search}
            onChange={event => setSearch(event.target.value)}
            style={searchInputStyle}
          />
        </div>
      </div>

      {loadError && (
        <div role="alert" style={errorStyle}>
          {loadError}
          <button onClick={() => void load()} style={retryButtonStyle}>
            Retry
          </button>
        </div>
      )}

      <div style={tableCardStyle}>
        {loading ? (
          <div style={emptyStateStyle}>
            <Loader2
              size={36}
              color="#F97316"
              style={{ animation: 'ccSpin 1s linear infinite' }}
            />
            <div style={{ fontSize: 15, fontWeight: 600 }}>
              Syncing user directory...
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={emptyStateStyle}>
            <div style={emptyIconStyle}>
              <Users size={32} color="#D1D5DB" />
            </div>
            <div>
              <div style={emptyTitleStyle}>No users found</div>
              <div style={subtitleStyle}>
                We couldn't find anyone matching your current search or filters.
              </div>
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
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
                  const name = displayName(user);

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
                        <div style={profileCellStyle}>
                          <ProfileImage
                            src={
                              user.role === 'caterer'
                                ? user.logo_url || user.avatar_url
                                : user.avatar_url
                            }
                            alt={name}
                            square={user.role === 'caterer'}
                            fallback={name}
                            background={roleBg[user.role] ?? '#F3F4F6'}
                            color={roleColor[user.role] ?? '#6B7280'}
                          />
                          <div>
                            <div style={userNameStyle}>
                              {name}
                              {isSuspended && (
                                <span style={suspendedBadgeStyle}>
                                  SUSPENDED
                                </span>
                              )}
                            </div>
                            {user.role === 'caterer' && (
                              <div style={smallSecondaryStyle}>
                                Owner: {user.full_name || '—'}
                              </div>
                            )}
                            <div style={userIdStyle}>
                              ID: {user.id.slice(0, 10)}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td style={tdStyle}>
                        <div style={accountDetailStyle}>
                          <div>
                            <Mail size={14} style={inlineIconStyle} />
                            {user.email || '—'}
                          </div>
                          <div style={smallSecondaryStyle}>
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
                        </div>
                      </td>

                      <td style={tdStyle}>
                        <span
                          style={{
                            ...roleBadgeStyle,
                            background: roleBg[user.role] ?? '#F3F4F6',
                            color: roleColor[user.role] ?? '#6B7280',
                            border: `1px solid ${
                              roleBorder[user.role] ?? '#E5E7EB'
                            }`,
                          }}
                        >
                          {roleLabel(user.role)}
                        </span>
                      </td>

                      <td style={tdStyle}>
                        <div style={actionsStyle}>
                          <button
                            onClick={() => void handleViewUser(user)}
                            style={buttonStyle}
                          >
                            <Eye size={16} />
                            Profile
                          </button>

                          {/* Intentionally available for every role, including staff and admin. */}
                          <button
                            onClick={() => openStatusConfirmation(user)}
                            style={{
                              ...buttonStyle,
                              background: isSuspended ? '#DC2626' : '#FFF5F5',
                              color: isSuspended ? '#FFFFFF' : '#DC2626',
                              borderColor: '#FEE2E2',
                            }}
                          >
                            <Ban size={16} />
                            {isSuspended ? 'Unsuspend' : 'Suspend'}
                          </button>
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

      {/* User Detail Modal */}
      {selected && (
        <div style={overlayStyle} onClick={() => setSelected(null)}>
          <div
            style={detailModalStyle}
            onClick={event => event.stopPropagation()}
          >
            <div
              style={{
                position: 'relative',
                height:
                  selected.role === 'caterer' &&
                  selected.caterer_info?.cover_photo_url
                    ? 180
                    : 100,
                background: 'linear-gradient(135deg, #F9FAFB 0%, #E5E7EB 100%)',
                flexShrink: 0,
              }}
            >
              {selected.role === 'caterer' &&
                selected.caterer_info?.cover_photo_url && (
                  <img
                    src={selected.caterer_info.cover_photo_url}
                    alt="Business cover"
                    onError={event => {
                      event.currentTarget.style.display = 'none';
                    }}
                    style={coverImageStyle}
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

            <div style={detailContentStyle}>
              <div style={overlapAvatarRowStyle}>
                <ProfileImage
                  src={
                    selected.role === 'caterer'
                      ? selected.caterer_info?.logo_url ||
                        selected.logo_url ||
                        selected.avatar_url
                      : selected.avatar_url
                  }
                  alt={
                    selected.role === 'caterer'
                      ? selected.caterer_info?.business_name ||
                        selected.business_name ||
                        'Business logo'
                      : selected.full_name || 'User avatar'
                  }
                  square={selected.role === 'caterer'}
                  size={88}
                  fallback={
                    selected.role === 'caterer'
                      ? selected.caterer_info?.business_name ||
                        selected.business_name ||
                        selected.full_name ||
                        'C'
                      : selected.full_name || 'U'
                  }
                  background={roleBg[selected.role] ?? '#F3F4F6'}
                  color={roleColor[selected.role] ?? '#6B7280'}
                />

                <span
                  style={{
                    ...roleBadgeStyle,
                    padding: '6px 14px',
                    background: roleBg[selected.role] ?? '#F3F4F6',
                    color: roleColor[selected.role] ?? '#6B7280',
                    border: `1px solid ${
                      roleBorder[selected.role] ?? '#E5E7EB'
                    }`,
                  }}
                >
                  {roleLabel(selected.role)} Account
                </span>
              </div>

              <div style={{ marginBottom: 24 }}>
                <h2 style={profileHeadingStyle}>{displayName(selected)}</h2>
                {selected.role === 'caterer' && (
                  <div style={ownerLineStyle}>
                    <Store size={16} color="#7C3AED" />
                    Owner: {selected.full_name || '—'}
                  </div>
                )}
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    selected.role === 'caterer' && selected.caterer_info
                      ? 'repeat(auto-fit, minmax(220px, 1fr))'
                      : '1fr',
                  gap: 20,
                }}
              >
                <div>
                  <h4 style={sectionHeadingStyle}>System Details</h4>
                  <div style={detailCardStyle}>
                    <DetailRow
                      icon={<Mail size={16} />}
                      label="Email"
                      value={selected.email || '—'}
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
                      value={roleLabel(selected.status ?? 'active')}
                      last
                    />
                  </div>
                </div>

                {selected.role === 'caterer' && selected.caterer_info && (
                  <div>
                    <h4 style={sectionHeadingStyle}>Vendor Profile</h4>
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
                        value={
                          roleLabel(
                            selected.caterer_info.verification_status ?? '—'
                          )
                        }
                      />
                      <DetailRow
                        label="Plan"
                        value={
                          selected.caterer_info.subscription_plan?.toUpperCase() ??
                          '—'
                        }
                        last
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Available to manage every account role, including staff/admin. */}
              <div style={modalActionFooterStyle}>
                <button
                  onClick={() => openStatusConfirmation(selected)}
                  style={{
                    ...primaryStatusButtonStyle,
                    background:
                      selected.status === 'suspended' ? '#111827' : '#FEF2F2',
                    borderColor:
                      selected.status === 'suspended' ? '#111827' : '#FECACA',
                    color: selected.status === 'suspended' ? '#FFFFFF' : '#DC2626',
                  }}
                >
                  <ShieldAlert size={18} />
                  {selected.status === 'suspended'
                    ? 'Unsuspend Platform Access'
                    : 'Suspend Platform Access'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Suspension / Reactivation Confirmation Modal */}
      {confirmSuspend && (
        <div style={overlayStyle} onClick={closeStatusConfirmation}>
          <div
            style={confirmModalStyle}
            onClick={event => event.stopPropagation()}
          >
            <div
              style={{
                ...confirmIconWrapStyle,
                background: isConfirmingReactivation ? '#DCFCE7' : '#FEF2F2',
              }}
            >
              {isConfirmingReactivation ? (
                <UserCheck size={28} color="#16A34A" />
              ) : (
                <AlertTriangle size={28} color="#DC2626" />
              )}
            </div>

            <h3 style={confirmTitleStyle}>
              {isConfirmingReactivation
                ? 'Reactivate Account?'
                : 'Suspend Account?'}
            </h3>

            <p style={confirmTextStyle}>
              {isConfirmingReactivation
                ? 'You are about to restore platform access for'
                : 'You are about to suspend platform access for'}{' '}
              <strong style={{ color: '#111827' }}>
                {displayName(confirmSuspend)}
              </strong>{' '}
              ({confirmSuspend.email}).
            </p>

            <div style={{ textAlign: 'left', marginTop: 22 }}>
              <label htmlFor="account-action-reason" style={reasonLabelStyle}>
                Reason for{' '}
                {isConfirmingReactivation ? 'reactivation' : 'suspension'}
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
                style={reasonInputStyle}
              />
              <div style={reasonCounterRowStyle}>
                <span style={{ color: reasonValid ? '#16A34A' : '#6B7280' }}>
                  {reasonLength < 10
                    ? `${10 - reasonLength} more characters required`
                    : 'Minimum length reached'}
                </span>
                <span style={{ color: '#9CA3AF' }}>{reason.length}/2000</span>
              </div>
            </div>

            <div style={confirmButtonsStyle}>
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
                    style={{ animation: 'ccSpin 1s linear infinite' }}
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
        .user-management,
        .user-management * {
          font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
          box-sizing: border-box;
        }

        .user-management button,
        .user-management input,
        .user-management textarea {
          font: inherit;
        }

        .user-management button {
          transition: background-color 0.18s ease, border-color 0.18s ease, opacity 0.18s ease;
        }

        .user-management button:focus-visible,
        .user-management input:focus-visible,
        .user-management textarea:focus-visible {
          outline: 3px solid rgba(249, 115, 22, 0.2);
          outline-offset: 2px;
        }

        #account-action-reason:focus {
          border-color: #F97316;
          box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.12);
        }

        @keyframes ccSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}

function DetailRow({
  icon,
  label,
  value,
  last = false,
}: {
  icon?: ReactNode;
  label: string;
  value: ReactNode;
  last?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 16,
        padding: '14px 16px',
        borderBottom: last ? 'none' : '1px solid #E5E7EB',
        fontSize: 13,
      }}
    >
      <span
        style={{
          color: '#6B7280',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {icon}
        {label}
      </span>
      <span
        style={{
          color: '#111827',
          textAlign: 'right',
          overflowWrap: 'anywhere',
          fontWeight: 700,
        }}
      >
        {value}
      </span>
    </div>
  );
}

const pageStyle: CSSProperties = {
  paddingBottom: 40,
  color: '#111827',
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-end',
  marginBottom: 32,
};

const pageTitleStyle: CSSProperties = {
  fontSize: 28,
  fontWeight: 900,
  color: '#111827',
  margin: '0 0 6px',
  letterSpacing: '-0.5px',
};

const subtitleStyle: CSSProperties = {
  fontSize: 15,
  color: '#6B7280',
  margin: 0,
  lineHeight: 1.5,
};

const controlsStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 24,
  gap: 20,
  flexWrap: 'wrap',
};

const tabsContainerStyle: CSSProperties = {
  display: 'flex',
  gap: 6,
  background: '#F3F4F6',
  padding: 6,
  borderRadius: 14,
  border: '1px solid #E5E7EB',
  flexWrap: 'wrap',
};

const tabButtonStyle: CSSProperties = {
  padding: '8px 18px',
  fontSize: 13,
  fontWeight: 700,
  border: 'none',
  borderRadius: 10,
  cursor: 'pointer',
  textTransform: 'capitalize',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};

const searchWrapStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  maxWidth: 380,
};

const searchIconStyle: CSSProperties = {
  position: 'absolute',
  left: 16,
  top: '50%',
  transform: 'translateY(-50%)',
};

const searchInputStyle: CSSProperties = {
  width: '100%',
  padding: '12px 16px 12px 44px',
  borderRadius: 14,
  border: '1px solid #E5E7EB',
  outline: 'none',
  fontSize: 14,
  color: '#111827',
  background: '#FFFFFF',
  boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
};

const errorStyle: CSSProperties = {
  padding: 14,
  marginBottom: 16,
  background: '#FEF2F2',
  color: '#991B1B',
  borderRadius: 12,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  fontSize: 14,
};

const retryButtonStyle: CSSProperties = {
  border: '1px solid #FECACA',
  borderRadius: 8,
  padding: '6px 10px',
  background: '#FFFFFF',
  color: '#991B1B',
  cursor: 'pointer',
  fontWeight: 700,
};

const tableCardStyle: CSSProperties = {
  background: '#FFFFFF',
  borderRadius: 20,
  border: '1px solid #E5E7EB',
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)',
  overflow: 'hidden',
};

const emptyStateStyle: CSSProperties = {
  padding: 80,
  textAlign: 'center',
  color: '#9CA3AF',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 16,
};

const emptyIconStyle: CSSProperties = {
  width: 72,
  height: 72,
  borderRadius: '50%',
  background: '#F9FAFB',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid #E5E7EB',
};

const emptyTitleStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  color: '#111827',
  marginBottom: 4,
};

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  textAlign: 'left',
  fontSize: 14,
};

const thStyle: CSSProperties = {
  padding: '16px 24px',
  fontSize: 12,
  fontWeight: 800,
  color: '#6B7280',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  textAlign: 'left',
  whiteSpace: 'nowrap',
};

const tdStyle: CSSProperties = {
  padding: '20px 24px',
  verticalAlign: 'middle',
};

const profileCellStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 16,
};

const userNameStyle: CSSProperties = {
  fontWeight: 800,
  fontSize: 15,
  color: '#111827',
  marginBottom: 4,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
};

const suspendedBadgeStyle: CSSProperties = {
  background: '#FEE2E2',
  color: '#DC2626',
  fontSize: 10,
  fontWeight: 800,
  padding: '2px 8px',
  borderRadius: 6,
  border: '1px solid #FECACA',
};

const smallSecondaryStyle: CSSProperties = {
  fontSize: 12,
  color: '#6B7280',
  marginTop: 4,
};

const userIdStyle: CSSProperties = {
  fontSize: 12,
  color: '#9CA3AF',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  marginTop: 4,
};

const accountDetailStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  color: '#4B5563',
  fontSize: 14,
};

const inlineIconStyle: CSSProperties = {
  display: 'inline-block',
  verticalAlign: 'middle',
  marginRight: 6,
};

const roleBadgeStyle: CSSProperties = {
  padding: '6px 12px',
  borderRadius: 20,
  fontSize: 12,
  fontWeight: 700,
  display: 'inline-flex',
  alignItems: 'center',
  textTransform: 'capitalize',
  whiteSpace: 'nowrap',
};

const actionsStyle: CSSProperties = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
};

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
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
};

const coverImageStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  objectPosition: 'center',
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

const detailContentStyle: CSSProperties = {
  padding: '0 32px 32px',
};

const overlapAvatarRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-end',
  gap: 12,
  marginTop: -40,
  marginBottom: 16,
  position: 'relative',
};

const profileHeadingStyle: CSSProperties = {
  fontSize: 26,
  fontWeight: 900,
  color: '#111827',
  margin: '0 0 6px',
  letterSpacing: '-0.5px',
  lineHeight: 1.25,
};

const ownerLineStyle: CSSProperties = {
  fontSize: 14,
  color: '#4B5563',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontWeight: 600,
};

const sectionHeadingStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: '#9CA3AF',
  textTransform: 'uppercase',
  letterSpacing: 1,
  margin: '0 0 12px',
};

const detailCardStyle: CSSProperties = {
  background: '#F9FAFB',
  border: '1px solid #E5E7EB',
  borderRadius: 14,
  overflow: 'hidden',
  marginBottom: 20,
};

const modalActionFooterStyle: CSSProperties = {
  marginTop: 12,
  paddingTop: 24,
  borderTop: '1px solid #F3F4F6',
};

const primaryStatusButtonStyle: CSSProperties = {
  width: '100%',
  padding: 14,
  border: '1px solid #FECACA',
  borderRadius: 14,
  fontSize: 14,
  fontWeight: 800,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  cursor: 'pointer',
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
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
};

const confirmIconWrapStyle: CSSProperties = {
  width: 64,
  height: 64,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  margin: '0 auto 20px',
};

const confirmTitleStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
  margin: '0 0 8px',
  color: '#111827',
};

const confirmTextStyle: CSSProperties = {
  fontSize: 14,
  color: '#6B7280',
  lineHeight: 1.6,
  margin: '0 0 24px',
};

const reasonLabelStyle: CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 800,
  color: '#374151',
  marginBottom: 8,
};

const reasonInputStyle: CSSProperties = {
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
  background: '#FFFFFF',
};

const reasonCounterRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  marginTop: 7,
  fontSize: 12,
};

const confirmButtonsStyle: CSSProperties = {
  display: 'flex',
  gap: 12,
  marginTop: 24,
};
