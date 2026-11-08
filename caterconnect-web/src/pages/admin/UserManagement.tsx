import './AdminUnified.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
  AlertCircle,
  RefreshCw,
  FileText,
  ExternalLink,
} from 'lucide-react';

// ===========================================================
// TYPES
// ===========================================================

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
  suspension_reason?: string | null;
  business_name?: string | null;
  logo_url?: string | null;
  caterer_info?: CatererInfo | null;
};

type Appeal = {
  id: string;
  user_id: string;
  appeal_message: string;
  evidence_url?: string | null;
  status: string;
  staff_explanation?: string | null;
  created_at: string;
  admin_decision?: string | null;
  user?: User | null;
};

// ===========================================================
// HELPERS
// ===========================================================

function getErrorMessage(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error
  ) {
    return String(error.message);
  }

  return error instanceof Error
    ? error.message
    : 'An unexpected error occurred.';
}

function formatDate(value?: string | null, long = false): string {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString('en-PH', {
    month: long ? 'long' : 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

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

  const imageStyle: CSSProperties = {
    width: size,
    height: size,
    minWidth: size,
    minHeight: size,
    display: 'block',
    objectFit: 'cover',
    borderRadius: square ? Math.max(12, size * 0.22) : '50%',
    border: '1px solid #E5E7EB',
    background: '#FFFFFF',
    flexShrink: 0,
  };

  if (!src || failed) {
    return (
      <div
        title={alt}
        style={{
          ...imageStyle,
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
      style={imageStyle}
    />
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
      <span style={styles.detailLabel}>
        {icon}
        {label}
      </span>

      <span style={styles.detailValue}>{value}</span>
    </div>
  );
}

// ===========================================================
// MAIN COMPONENT
// ===========================================================

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [appeals, setAppeals] = useState<Appeal[]>([]);

  const [loading, setLoading] = useState(true);
  const [appealsLoading, setAppealsLoading] = useState(true);

  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const [selected, setSelected] = useState<User | null>(null);
  const [selectedAppeal, setSelectedAppeal] = useState<Appeal | null>(null);

  const [counts, setCounts] = useState<Record<string, number>>({});

  const [confirmSuspend, setConfirmSuspend] = useState<User | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [appealActionLoading, setAppealActionLoading] = useState<string | null>(
    null
  );

  const [reason, setReason] = useState('');
  const [loadError, setLoadError] = useState('');
  const [appealError, setAppealError] = useState('');

  // -------------------------------------------------------
  // DISPLAY HELPERS
  // -------------------------------------------------------

  const displayName = useCallback((user: User) => {
    return user.role === 'caterer'
      ? user.caterer_info?.business_name?.trim() ||
          user.business_name?.trim() ||
          user.full_name ||
          'Unnamed caterer'
      : user.full_name || 'Unnamed user';
  }, []);

  const roleLabel = (role: string) =>
    role
      ? role.charAt(0).toUpperCase() + role.slice(1)
      : 'Unknown';

  // -------------------------------------------------------
  // LOAD USER DIRECTORY
  // -------------------------------------------------------

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profileError) throw profileError;

      let fetchedUsers = (profileData ?? []) as User[];

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

      // Load current suspension reasons for suspended accounts
      const suspendedIds = fetchedUsers
        .filter(
          user =>
            ['customer', 'caterer'].includes(user.role) &&
            user.status?.toLowerCase() === 'suspended'
        )
        .map(user => user.id);

      if (suspendedIds.length > 0) {
        const { data: suspensionData, error: suspensionError } = await supabase
          .from('account_monitoring_cases')
          .select('user_id, reason')
          .in('user_id', suspendedIds)
          .eq('suspended', true);

        if (suspensionError) throw suspensionError;

        const suspensionMap = new Map<string, string>();

        (suspensionData ?? []).forEach((item: any) => {
          if (item.user_id && item.reason) {
            suspensionMap.set(item.user_id, item.reason);
          }
        });

        fetchedUsers = fetchedUsers.map(user => ({
          ...user,
          suspension_reason:
            suspensionMap.get(user.id) ?? null,
        }));
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
      console.error('User directory loading failed:', error);
      setLoadError('Failed to load users: ' + getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  // -------------------------------------------------------
  // LOAD STAFF-APPROVED APPEALS
  // -------------------------------------------------------

  const loadAppeals = useCallback(async () => {
    setAppealsLoading(true);
    setAppealError('');

    try {
      const { data: appealData, error: appealQueryError } = await supabase
        .from('account_appeals')
        .select(`
          id,
          user_id,
          appeal_message,
          evidence_url,
          status,
          staff_explanation,
          created_at,
          admin_decision
        `)
        .eq('status', 'Approved')
        .is('admin_decision', null)
        .order('created_at', { ascending: false });

      if (appealQueryError) throw appealQueryError;

      const fetchedAppeals = (appealData ?? []) as Appeal[];

      if (fetchedAppeals.length === 0) {
        setAppeals([]);
        return;
      }

      const userIds = [
        ...new Set(fetchedAppeals.map(appeal => appeal.user_id)),
      ];

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds);

      if (profileError) throw profileError;

      const profiles = (profileData ?? []) as User[];

      const profileMap = new Map<string, User>(
        profiles.map(profile => [profile.id, profile])
      );

      const catererIds = profiles
        .filter(profile => profile.role === 'caterer')
        .map(profile => profile.id);

      let catererMap = new Map<string, CatererInfo>();

      if (catererIds.length > 0) {
        const { data: catererData, error: catererError } = await supabase
          .from('caterers')
          .select(
            'user_id, business_name, logo_url, cover_photo_url, city, contact_phone, verification_status, subscription_plan'
          )
          .in('user_id', catererIds);

        if (catererError) throw catererError;

        catererMap = new Map(
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
      }

      // Retrieve current suspension reasons for appeal users
      const { data: suspensionData, error: suspensionError } = await supabase
        .from('account_monitoring_cases')
        .select('user_id, reason')
        .in('user_id', userIds)
        .eq('suspended', true);

      if (suspensionError) throw suspensionError;

      const suspensionMap = new Map<string, string>();

      (suspensionData ?? []).forEach((item: any) => {
        if (item.user_id && item.reason) {
          suspensionMap.set(item.user_id, item.reason);
        }
      });

      const enrichedAppeals = fetchedAppeals.map(appeal => {
        const profile = profileMap.get(appeal.user_id);

        if (!profile) return appeal;

        const caterer = catererMap.get(profile.id);

        return {
          ...appeal,
          user: {
            ...profile,
            business_name: caterer?.business_name ?? null,
            logo_url: caterer?.logo_url ?? null,
            caterer_info: caterer ?? null,
            suspension_reason:
              suspensionMap.get(profile.id) ?? null,
          },
        };
      });

      setAppeals(enrichedAppeals);
    } catch (error: unknown) {
      console.error('Appeal loading failed:', error);
      setAppealError('Failed to load appeals: ' + getErrorMessage(error));
    } finally {
      setAppealsLoading(false);
    }
  }, []);

  // -------------------------------------------------------
  // REFRESH
  // -------------------------------------------------------

  const refreshAll = useCallback(async () => {
    await Promise.all([loadUsers(), loadAppeals()]);
  }, [loadUsers, loadAppeals]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  // -------------------------------------------------------
  // ADMIN FINAL APPEAL DECISION
  // -------------------------------------------------------

  const handleAppealDecision = async (appeal: Appeal) => {
    if (appealActionLoading) return;

    const userName = appeal.user
      ? displayName(appeal.user)
      : 'this account';

    if (
      !window.confirm(
        `Are you sure you want to unsuspend ${userName}? This will restore their platform access.`
      )
    ) {
      return;
    }

    setAppealActionLoading(appeal.id);

    try {
      const { error } = await supabase.rpc(
        'admin_decide_account_appeal',
        {
          p_appeal_id: appeal.id,
          p_decision: 'Unsuspend',
        }
      );

      if (error) throw error;

      alert('Appeal approved. The account has been unsuspended.');

      setSelectedAppeal(null);

      await refreshAll();
    } catch (error: unknown) {
      console.error('Admin appeal decision failed:', error);
      alert('Failed to process appeal: ' + getErrorMessage(error));
    } finally {
      setAppealActionLoading(null);
    }
  };

  // -------------------------------------------------------
  // VIEW USER PROFILE
  // -------------------------------------------------------

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

  // -------------------------------------------------------
  // MANUAL SUSPENSION / REACTIVATION
  // -------------------------------------------------------

  const openStatusConfirmation = (user: User) => {
    if (!['customer', 'caterer'].includes(user.role)) {
      alert('Only Customer and Caterer accounts can be managed here.');
      return;
    }

    setReason('');
    setConfirmSuspend(user);
  };

  const closeStatusConfirmation = () => {
    if (actionLoading) return;

    setConfirmSuspend(null);
    setReason('');
  };

  const handleSuspendAccount = async () => {
    if (!confirmSuspend || actionLoading) return;

    const target = confirmSuspend;

    if (!['customer', 'caterer'].includes(target.role)) {
      alert('Only Customer and Caterer accounts can be managed here.');
      return;
    }

    const action =
      target.status?.toLowerCase() === 'suspended'
        ? 'reactivate'
        : 'suspend';

    const trimmedReason = reason.trim();

    if (trimmedReason.length < 10 || trimmedReason.length > 2000) {
      alert('Please enter a reason containing 10 to 2000 characters.');
      return;
    }

    setActionLoading(true);

    try {
      const { error } = await supabase.rpc(
        'admin_account_monitoring_action',
        {
          p_user_id: target.id,
          p_action: action,
          p_reason: trimmedReason,
        }
      );

      if (error) throw error;

      const actualStatus = action === 'suspend' ? 'suspended' : 'active';

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
          : 'Account reactivated successfully.'
      );

      await loadUsers();
    } catch (error: unknown) {
      console.error('Account status update failed:', error);
      alert('Failed to update account status: ' + getErrorMessage(error));
    } finally {
      setActionLoading(false);
    }
  };

  // -------------------------------------------------------
  // FILTERING
  // -------------------------------------------------------

  const suspendedUsers = useMemo(
    () =>
      users
        .filter(
          user =>
            ['customer', 'caterer'].includes(user.role) &&
            user.status?.toLowerCase() === 'suspended'
        )
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
        ),
    [users]
  );

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();

    return users.filter(user => {
      const matchesRole = filter === 'all' || user.role === filter;

      const name =
        user.role === 'caterer'
          ? user.caterer_info?.business_name ||
            user.business_name ||
            user.full_name
          : user.full_name;

      const matchesSearch =
        (name ?? '').toLowerCase().includes(term) ||
        (user.full_name ?? '').toLowerCase().includes(term) ||
        (user.email ?? '').toLowerCase().includes(term) ||
        (user.business_name ?? '').toLowerCase().includes(term);

      return matchesRole && matchesSearch;
    });
  }, [users, filter, search]);

  // -------------------------------------------------------
  // COLORS AND TABS
  // -------------------------------------------------------

  const roleColor: Record<string, string> = {
    customer: '#475569',
    caterer: '#C2410C',
    staff: '#64748B',
    admin: '#EA580C',
  };

  const roleBg: Record<string, string> = {
    customer: '#F1F5F9',
    caterer: '#FFF7ED',
    staff: '#F1F5F9',
    admin: '#FFEDD5',
  };

  const roleBorder: Record<string, string> = {
    customer: '#E2E8F0',
    caterer: '#FED7AA',
    staff: '#E2E8F0',
    admin: '#FDBA74',
  };

  const tabs = ['all', 'customer', 'caterer', 'staff', 'admin'];

  const tabIcons: Record<string, any> = {
    all: Layers,
    customer: Users,
    caterer: Store,
    staff: UserCheck,
    admin: Shield,
  };

  const isConfirmingReactivation =
    confirmSuspend?.status?.toLowerCase() === 'suspended';

  const reasonLength = reason.trim().length;
  const reasonValid = reasonLength >= 10 && reasonLength <= 2000;

  // =======================================================
  // USER INTERFACE
  // =======================================================

  return (
    <div className="user-management" style={styles.page}>
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
          transition: background-color .18s ease, border-color .18s ease, opacity .18s ease;
        }

        .user-management button:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        .user-management button:focus-visible,
        .user-management input:focus-visible,
        .user-management textarea:focus-visible {
          outline: 3px solid rgba(249,115,22,.2);
          outline-offset: 2px;
        }

        @keyframes ccSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes scaleIn {
          from { opacity: 0; transform: scale(.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>

      {/* HEADER */}

      <div style={styles.header}>
        <div>
          <h1 style={styles.pageTitle}>User Directory</h1>
          <p style={styles.subtitle}>
            Securely manage, review, and control all platform accounts.
          </p>
        </div>

        <button
          onClick={() => void refreshAll()}
          disabled={loading || appealsLoading}
          style={styles.refreshButton}
        >
          <RefreshCw
            size={15}
            style={{
              animation:
                loading || appealsLoading
                  ? 'ccSpin 1s linear infinite'
                  : 'none',
            }}
          />
          Refresh
        </button>
      </div>

      {/* =====================================================
          SUSPENDED ACCOUNTS
      ====================================================== */}

      {!loading && suspendedUsers.length > 0 && (
        <section style={styles.suspendedSection}>
          <div style={styles.sectionHeader}>
            <div style={styles.headingLeft}>
              <div style={styles.suspendedIcon}>
                <ShieldAlert size={22} color="#DC2626" />
              </div>

              <div>
                <h2 style={styles.suspendedTitle}>Suspended Accounts</h2>
                <p style={styles.suspendedSubtitle}>
                  Review suspended accounts and any appeals approved by
                  Platform Staff.
                </p>
              </div>
            </div>

            <span style={styles.suspendedCount}>
              {suspendedUsers.length}{' '}
              {suspendedUsers.length === 1 ? 'Account' : 'Accounts'}
            </span>
          </div>

          {appealError && (
            <div role="alert" style={styles.error}>
              <AlertCircle size={16} />
              {appealError}
              <button
                onClick={() => void loadAppeals()}
                style={styles.retryButton}
              >
                Retry
              </button>
            </div>
          )}

          {appealsLoading && (
            <div style={styles.appealLoading}>
              <Loader2
                size={17}
                style={{ animation: 'ccSpin 1s linear infinite' }}
              />
              Checking approved appeals...
            </div>
          )}

          <div style={styles.suspendedList}>
            {suspendedUsers.map(user => {
              const name = displayName(user);

              const userAppeals = appeals.filter(
                appeal =>
                  appeal.user_id === user.id &&
                  appeal.status === 'Approved' &&
                  !appeal.admin_decision
              );

              return (
                <div key={user.id} style={styles.suspendedCard}>
                  <div style={styles.suspendedUser}>
                    <ProfileImage
                      src={
                        user.role === 'caterer'
                          ? user.logo_url || user.avatar_url
                          : user.avatar_url
                      }
                      alt={name}
                      square={user.role === 'caterer'}
                      size={52}
                      fallback={name}
                      background={roleBg[user.role] ?? '#F3F4F6'}
                      color={roleColor[user.role] ?? '#6B7280'}
                    />

                    <div style={{ minWidth: 0 }}>
                      <div style={styles.userName}>
                        {name}
                        <span style={styles.suspendedBadge}>SUSPENDED</span>
                      </div>

                      <div style={styles.secondaryText}>
                        <Mail size={13} />
                        {user.email || 'No email available'}
                      </div>

                      <div style={styles.mutedText}>
                        {roleLabel(user.role)} Account · Joined{' '}
                        {formatDate(user.created_at)}
                      </div>
                    </div>
                  </div>

                  <div style={styles.actions}>
                    <div style={styles.actionsLeft}>
                      {userAppeals.map(appeal => (
                        <button
                          key={appeal.id}
                          onClick={() => setSelectedAppeal(appeal)}
                          style={styles.pendingDecisionButton}
                        >
                          <FileText size={14} />
                          Pending Decision
                        </button>
                      ))}
                    </div>

                    <div style={styles.actionsRight}>
                      <button
                        onClick={() => void handleViewUser(user)}
                        style={styles.secondaryButton}
                      >
                        <Eye size={14} />
                        View
                      </button>

                      <button
                        onClick={() => openStatusConfirmation(user)}
                        style={styles.unsuspendButton}
                      >
                        <UserCheck size={14} />
                        Unsuspend
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {!loading && suspendedUsers.length === 0 && (
        <div style={styles.noSuspendedNotice}>
          <UserCheck size={18} color="#16A34A" />
          No suspended Customer or Caterer accounts.
        </div>
      )}

      {/* =====================================================
          SEARCH AND ROLE FILTERS
      ====================================================== */}

      <div style={styles.controls}>
        <div style={styles.tabs}>
          {tabs.map(tab => {
            const Icon = tabIcons[tab] || Users;

            return (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                style={{
                  ...styles.tab,
                  background: filter === tab ? '#FFFFFF' : 'transparent',
                  color: filter === tab ? '#111827' : '#6B7280',
                  boxShadow:
                    filter === tab
                      ? '0 2px 4px rgba(0,0,0,.04)'
                      : 'none',
                }}
              >
                <Icon
                  size={14}
                  color={filter === tab ? '#F97316' : '#9CA3AF'}
                />
                {tab}
                <span style={{ opacity: 0.6 }}>
                  {counts[tab] !== undefined ? counts[tab] : ''}
                </span>
              </button>
            );
          })}
        </div>

        <div style={styles.searchWrap}>
          <Search size={18} color="#9CA3AF" style={styles.searchIcon} />
          <input
            placeholder="Search by name, email, or business..."
            value={search}
            onChange={event => setSearch(event.target.value)}
            style={styles.searchInput}
          />
        </div>
      </div>

      {loadError && (
        <div role="alert" style={styles.error}>
          {loadError}
          <button onClick={() => void loadUsers()} style={styles.retryButton}>
            Retry
          </button>
        </div>
      )}

      {/* =====================================================
          USER DIRECTORY
      ====================================================== */}

      <div style={styles.tableCard}>
        <div style={styles.directoryHeader}>
          <h2 style={styles.directoryTitle}>All Platform Accounts</h2>
          <p style={styles.directorySubtitle}>
            Newest accounts appear first. Suspended accounts are also
            highlighted above.
          </p>
        </div>

        {loading ? (
          <div style={styles.emptyState}>
            <Loader2
              size={36}
              color="#F97316"
              style={{ animation: 'ccSpin 1s linear infinite' }}
            />
            <strong>Syncing user directory...</strong>
          </div>
        ) : filtered.length === 0 ? (
          <div style={styles.emptyState}>
            <Users size={32} color="#D1D5DB" />
            <strong>No users found</strong>
            <span>
              We couldn't find anyone matching your current search or filters.
            </span>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr style={{ background: '#F9FAFB' }}>
                  <th style={styles.th}>User Profile</th>
                  <th style={styles.th}>Account Details</th>
                  <th style={styles.th}>System Role</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map(user => {
                  const isSuspended =
                    user.status?.toLowerCase() === 'suspended';

                  const canManage = ['customer', 'caterer'].includes(
                    user.role
                  );

                  const name = displayName(user);

                  return (
                    <tr
                      key={user.id}
                      style={{
                        borderBottom: '1px solid #F3F4F6',
                        background: isSuspended ? '#FFF7F7' : '#FFFFFF',
                      }}
                    >
                      <td style={styles.td}>
                        <div style={styles.profileCell}>
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
                            <div style={styles.userNameTable}>
                              {name}
                              {isSuspended && (
                                <span style={styles.suspendedBadge}>
                                  SUSPENDED
                                </span>
                              )}
                            </div>

                            {user.role === 'caterer' && (
                              <div style={styles.mutedText}>
                                Owner: {user.full_name || '—'}
                              </div>
                            )}

                            <div style={styles.userId}>
                              ID: {user.id.slice(0, 10)}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td style={styles.td}>
                        <div style={styles.accountDetail}>
                          <div>
                            <Mail size={14} style={styles.inlineIcon} />
                            {user.email || '—'}
                          </div>

                          <div style={styles.secondaryTextTable}>
                            <CalendarDays
                              size={14}
                              style={styles.inlineIcon}
                            />
                            Joined {formatDate(user.created_at)}
                          </div>
                        </div>
                      </td>

                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.roleBadge,
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

                      <td style={styles.td}>
                        {isSuspended ? (
                          <span style={styles.suspendedStatus}>
                            <AlertCircle size={14} />
                            Suspended
                          </span>
                        ) : (
                          <span style={styles.activeStatus}>
                            <UserCheck size={14} />
                            Active
                          </span>
                        )}
                      </td>

                      <td style={styles.td}>
                        <div style={styles.actionsTable}>
                          <button
                            onClick={() => void handleViewUser(user)}
                            style={styles.secondaryButtonTable}
                          >
                            <Eye size={15} />
                            Profile
                          </button>

                          {canManage && (
                            <button
                              onClick={() => openStatusConfirmation(user)}
                              style={{
                                ...styles.secondaryButtonTable,
                                background: isSuspended
                                  ? '#DC2626'
                                  : '#FFF5F5',
                                color: isSuspended ? '#FFFFFF' : '#DC2626',
                                borderColor: '#FEE2E2',
                              }}
                            >
                              <Ban size={15} />
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

      {/* =====================================================
          USER DETAIL MODAL
      ====================================================== */}

      {selected && (
        <div
          style={styles.overlay}
          onClick={() => setSelected(null)}
        >
          <div
            style={styles.detailModal}
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
                background:
                  'linear-gradient(135deg, #F9FAFB 0%, #E5E7EB 100%)',
              }}
            >
              {selected.role === 'caterer' &&
                selected.caterer_info?.cover_photo_url && (
                  <img
                    src={selected.caterer_info.cover_photo_url}
                    alt="Business cover"
                    style={styles.coverImage}
                  />
                )}

              <button
                style={styles.closeButton}
                onClick={() => setSelected(null)}
                aria-label="Close user details"
              >
                <X size={18} />
              </button>
            </div>

            <div style={styles.detailContent}>
              <div style={styles.overlapAvatar}>
                <ProfileImage
                  src={
                    selected.role === 'caterer'
                      ? selected.caterer_info?.logo_url ||
                        selected.logo_url ||
                        selected.avatar_url
                      : selected.avatar_url
                  }
                  alt={displayName(selected)}
                  square={selected.role === 'caterer'}
                  size={88}
                  fallback={displayName(selected)}
                  background={roleBg[selected.role] ?? '#F3F4F6'}
                  color={roleColor[selected.role] ?? '#6B7280'}
                />

                <span
                  style={{
                    ...styles.roleBadge,
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
                <h2 style={styles.profileHeading}>
                  {displayName(selected)}
                </h2>

                {selected.role === 'caterer' && (
                  <div style={styles.ownerLine}>
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
                  <h4 style={styles.sectionHeading}>System Details</h4>

                  <div style={styles.detailCard}>
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
                      value={formatDate(selected.created_at, true)}
                    />

                    <DetailRow
                      icon={<Shield size={16} />}
                      label="Account status"
                      value={roleLabel(selected.status ?? 'active')}
                    />

                    {selected.status?.toLowerCase() === 'suspended' && (
                      <DetailRow
                        icon={<AlertTriangle size={16} />}
                        label="Suspension reason"
                        value={
                          selected.suspension_reason ||
                          'No suspension reason is available.'
                        }
                        last
                      />
                    )}
                  </div>
                </div>

                {selected.role === 'caterer' && selected.caterer_info && (
                  <div>
                    <h4 style={styles.sectionHeading}>Vendor Profile</h4>

                    <div style={styles.detailCard}>
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
                        value={roleLabel(
                          selected.caterer_info.verification_status ?? '—'
                        )}
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

              {['customer', 'caterer'].includes(selected.role) && (
                <div style={styles.modalActionFooter}>
                  <button
                    onClick={() => openStatusConfirmation(selected)}
                    style={{
                      ...styles.primaryStatusButton,
                      background:
                        selected.status?.toLowerCase() === 'suspended'
                          ? '#111827'
                          : '#FEF2F2',
                      borderColor:
                        selected.status?.toLowerCase() === 'suspended'
                          ? '#111827'
                          : '#FECACA',
                      color:
                        selected.status?.toLowerCase() === 'suspended'
                          ? '#FFFFFF'
                          : '#DC2626',
                    }}
                  >
                    <ShieldAlert size={18} />
                    {selected.status?.toLowerCase() === 'suspended'
                      ? 'Unsuspend Platform Access'
                      : 'Suspend Platform Access'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          ADMIN APPEAL REVIEW MODAL (Clean UI matching screenshot)
      ====================================================== */}

      {selectedAppeal && (
        <div
          style={styles.overlay}
          onClick={() => {
            if (!appealActionLoading) setSelectedAppeal(null);
          }}
        >
          <div
            style={styles.cleanModal}
            onClick={event => event.stopPropagation()}
          >
            {/* Header with Title and Close X */}
            <div style={styles.cleanModalHeader}>
              <div>
                <h2 style={styles.cleanModalTitle}>Review Account Appeal</h2>
                <p style={styles.cleanModalSubtitle}>
                  Review the submitted information before making a decision.
                </p>
              </div>
              <button
                onClick={() => setSelectedAppeal(null)}
                disabled={!!appealActionLoading}
                style={styles.cleanCloseButton}
                aria-label="Close appeal review"
              >
                <X size={18} color="#374151" />
              </button>
            </div>

            {/* Modal Body */}
            <div style={styles.cleanModalBody}>
              {/* Original Suspension Reason */}
              {selectedAppeal.user && (
                <div style={{ marginTop: 16 }}>
                  <div style={styles.cleanSectionLabel}>
                    ORIGINAL SUSPENSION REASON
                  </div>

                  <div style={styles.suspensionReasonModal}>
                    <ShieldAlert size={17} color="#DC2626" />

                    <div>
                      <strong>Why was this account suspended?</strong>

                      <p style={{ margin: '4px 0 0' }}>
                        {selectedAppeal.user.suspension_reason ||
                          'No suspension reason is available.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Submitted Appeal Text Box */}
              <div style={{ marginTop: 20 }}>
                <div style={styles.cleanSectionLabel}>SUBMITTED APPEAL</div>
                <div style={styles.submittedAppealBox}>
                  {selectedAppeal.appeal_message ? (
                    selectedAppeal.appeal_message
                      .split('\n')
                      .map((paragraph, index) => (
                        <p key={index} style={{ margin: '0 0 14px' }}>
                          {paragraph}
                        </p>
                      ))
                  ) : (
                    <p style={{ margin: 0, color: '#9CA3AF' }}>
                      No appeal message provided.
                    </p>
                  )}
                </div>
              </div>

              {/* Supporting Evidence Link if exists */}
              {selectedAppeal.evidence_url && (
                <div style={{ marginTop: 14 }}>
                  <a
                    href={selectedAppeal.evidence_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={styles.evidenceLink}
                  >
                    <FileText size={15} />
                    View Supporting Evidence Attachment
                    <ExternalLink size={13} />
                  </a>
                </div>
              )}

              {/* Staff Review Explanation Notes */}
              {selectedAppeal.staff_explanation && (
                <div style={{ marginTop: 20 }}>
                  <div style={styles.cleanSectionLabel}>
                    STAFF REVIEW EXPLANATION
                  </div>
                  <div style={styles.staffExplanationBox}>
                    {selectedAppeal.staff_explanation}
                  </div>
                </div>
              )}

              {!selectedAppeal.user && (
                <div style={styles.warning}>
                  <AlertTriangle size={15} />
                  The associated user profile could not be loaded.
                </div>
              )}

              {/* Footer Actions */}
              <div style={styles.cleanModalFooter}>
                <button
                  disabled={!!appealActionLoading}
                  onClick={() => setSelectedAppeal(null)}
                  style={styles.cleanCancelButton}
                >
                  Cancel
                </button>

                <button
                  disabled={
                    !!appealActionLoading || !selectedAppeal.user
                  }
                  onClick={() => void handleAppealDecision(selectedAppeal)}
                  style={styles.cleanApproveButton}
                >
                  {appealActionLoading === selectedAppeal.id ? (
                    <Loader2
                      size={16}
                      style={{ animation: 'ccSpin 1s linear infinite' }}
                    />
                  ) : (
                    <UserCheck size={16} />
                  )}
                  {appealActionLoading === selectedAppeal.id
                    ? 'Processing...'
                    : 'Unsuspend Account'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          SUSPENSION / REACTIVATION MODAL
      ====================================================== */}

      {confirmSuspend && (
        <div
          style={styles.overlay}
          onClick={closeStatusConfirmation}
        >
          <div
            style={styles.confirmModal}
            onClick={event => event.stopPropagation()}
          >
            <div
              style={{
                ...styles.confirmIcon,
                background: isConfirmingReactivation ? '#DCFCE7' : '#FEF2F2',
              }}
            >
              {isConfirmingReactivation ? (
                <UserCheck size={28} color="#16A34A" />
              ) : (
                <AlertTriangle size={28} color="#DC2626" />
              )}
            </div>

            <h3 style={styles.confirmTitle}>
              {isConfirmingReactivation
                ? 'Reactivate Account?'
                : 'Suspend Account?'}
            </h3>

            <p style={styles.confirmText}>
              {isConfirmingReactivation
                ? 'You are about to restore platform access for'
                : 'You are about to suspend platform access for'}{' '}
              <strong style={{ color: '#111827' }}>
                {displayName(confirmSuspend)}
              </strong>{' '}
              ({confirmSuspend.email}).
            </p>

            <div style={{ textAlign: 'left', marginTop: 22 }}>
              <label htmlFor="account-action-reason" style={styles.reasonLabel}>
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
                style={styles.reasonInput}
              />

              <div style={styles.reasonCounter}>
                <span
                  style={{ color: reasonValid ? '#16A34A' : '#6B7280' }}
                >
                  {reasonLength < 10
                    ? `${10 - reasonLength} more characters required`
                    : 'Minimum length reached'}
                </span>

                <span style={{ color: '#9CA3AF' }}>
                  {reason.length}/2000
                </span>
              </div>
            </div>

            <div style={styles.confirmButtons}>
              <button
                disabled={actionLoading}
                onClick={closeStatusConfirmation}
                style={styles.cancelButton}
              >
                Cancel
              </button>

              <button
                disabled={actionLoading || !reasonValid}
                onClick={() => void handleSuspendAccount()}
                style={{
                  ...styles.confirmActionButton,
                  background: isConfirmingReactivation
                    ? '#16A34A'
                    : '#F87171',
                }}
              >
                {actionLoading ? (
                  <Loader2
                    size={15}
                    style={{ animation: 'ccSpin 1s linear infinite' }}
                  />
                ) : (
                  <ShieldAlert size={15} />
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
    </div>
  );
}

// ===========================================================
// STYLES
// ===========================================================

const styles: Record<string, CSSProperties> = {
  page: {
    paddingBottom: 40,
    color: '#111827',
  },

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 24,
    gap: 16,
    flexWrap: 'wrap',
  },

  pageTitle: {
    fontSize: 28,
    fontWeight: 900,
    color: '#111827',
    margin: '0 0 6px',
    letterSpacing: '-0.5px',
  },

  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    margin: 0,
    lineHeight: 1.5,
  },

  refreshButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 16px',
    border: '1px solid #E5E7EB',
    borderRadius: 10,
    background: '#FFFFFF',
    color: '#374151',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },

  headingLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 13,
    minWidth: 0,
  },

  suspendedSection: {
    background: '#FFF8F8',
    border: '1px solid #FECACA',
    borderRadius: 18,
    padding: 22,
    marginBottom: 26,
  },

  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap',
    marginBottom: 18,
  },

  suspendedIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: '#FEE2E2',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  suspendedTitle: {
    fontSize: 18,
    fontWeight: 900,
    color: '#991B1B',
    margin: '0 0 4px',
  },

  suspendedSubtitle: {
    fontSize: 13,
    color: '#7F1D1D',
    margin: 0,
    lineHeight: 1.5,
  },

  suspendedCount: {
    background: '#DC2626',
    color: '#FFFFFF',
    padding: '7px 13px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 800,
  },

  suspendedList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
    gap: 12,
  },

  suspendedCard: {
    background: '#FFFFFF',
    border: '1px solid #FECACA',
    borderRadius: 12,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },

  suspendedUser: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },

  appealLoading: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: '#9A3412',
    fontSize: 12,
    marginBottom: 14,
  },

  actions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    width: '100%',
    flexWrap: 'wrap',
  },

  actionsLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
  },

  actionsRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    justifyContent: 'flex-end',
    marginLeft: 'auto',
  },

  pendingDecisionButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 32,
    padding: '0 9px',
    border: '1px solid #FDBA74',
    borderRadius: 8,
    background: '#FFF7ED',
    color: '#C2410C',
    fontSize: 11.5,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },

  secondaryButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 32,
    padding: '0 9px',
    border: '1px solid #D1D5DB',
    borderRadius: 8,
    background: '#FFFFFF',
    color: '#374151',
    fontSize: 11.5,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },

  unsuspendButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 32,
    padding: '0 9px',
    border: '1px solid #DC2626',
    borderRadius: 8,
    background: '#DC2626',
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },

  noSuspendedNotice: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: '#F0FDF4',
    border: '1px solid #BBF7D0',
    color: '#166534',
    borderRadius: 12,
    padding: '13px 16px',
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 24,
  },

  userName: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    fontSize: 16,
    fontWeight: 800,
    color: '#111827',
    marginBottom: 6,
  },

  userNameTable: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 7,
    fontSize: 14,
    fontWeight: 800,
    color: '#111827',
    marginBottom: 5,
  },

  suspendedBadge: {
    background: '#FEE2E2',
    color: '#DC2626',
    fontSize: 10,
    fontWeight: 800,
    padding: '3px 8px',
    borderRadius: 6,
    textTransform: 'uppercase',
  },

  secondaryText: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 13,
    color: '#4B5563',
    marginBottom: 4,
    overflowWrap: 'anywhere',
  },

  secondaryTextTable: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 12,
    color: '#6B7280',
    overflowWrap: 'anywhere',
  },

  mutedText: {
    fontSize: 12,
    color: '#9CA3AF',
  },

  actionsTable: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    flexWrap: 'wrap',
  },

  secondaryButtonTable: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    padding: '8px 11px',
    border: '1px solid #E5E7EB',
    borderRadius: 9,
    background: '#FFFFFF',
    color: '#4B5563',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },

  controls: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    gap: 20,
    flexWrap: 'wrap',
  },

  tabs: {
    display: 'flex',
    gap: 6,
    background: '#F3F4F6',
    padding: 6,
    borderRadius: 14,
    border: '1px solid #E5E7EB',
    flexWrap: 'wrap',
  },

  tab: {
    padding: '8px 15px',
    fontSize: 13,
    fontWeight: 700,
    border: 'none',
    borderRadius: 10,
    cursor: 'pointer',
    textTransform: 'capitalize',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },

  searchWrap: {
    position: 'relative',
    width: '100%',
    maxWidth: 380,
  },

  searchIcon: {
    position: 'absolute',
    left: 16,
    top: '50%',
    transform: 'translateY(-50%)',
  },

  searchInput: {
    width: '100%',
    padding: '12px 16px 12px 44px',
    borderRadius: 14,
    border: '1px solid #E5E7EB',
    outline: 'none',
    fontSize: 14,
    color: '#111827',
    background: '#FFFFFF',
  },

  error: {
    padding: 14,
    marginBottom: 16,
    background: '#FEF2F2',
    color: '#991B1B',
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    fontSize: 13,
    flexWrap: 'wrap',
  },

  retryButton: {
    border: '1px solid #FECACA',
    borderRadius: 8,
    padding: '6px 10px',
    background: '#FFFFFF',
    color: '#991B1B',
    cursor: 'pointer',
    fontWeight: 700,
  },

  tableCard: {
    background: '#FFFFFF',
    borderRadius: 20,
    border: '1px solid #E5E7EB',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,.02)',
    overflow: 'hidden',
  },

  directoryHeader: {
    padding: '20px 24px',
    borderBottom: '1px solid #F3F4F6',
  },

  directoryTitle: {
    fontSize: 17,
    fontWeight: 900,
    color: '#111827',
    margin: '0 0 5px',
  },

  directorySubtitle: {
    fontSize: 12,
    color: '#6B7280',
    margin: 0,
    lineHeight: 1.5,
  },

  emptyState: {
    padding: 70,
    textAlign: 'center',
    color: '#9CA3AF',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },

  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
    fontSize: 14,
  },

  th: {
    padding: '16px 24px',
    fontSize: 12,
    fontWeight: 800,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: '.5px',
    textAlign: 'left',
    whiteSpace: 'nowrap',
  },

  td: {
    padding: '20px 24px',
    verticalAlign: 'middle',
  },

  profileCell: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },

  userId: {
    fontSize: 12,
    color: '#9CA3AF',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    marginTop: 4,
  },

  accountDetail: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    color: '#4B5563',
    fontSize: 14,
  },

  inlineIcon: {
    display: 'inline-block',
    verticalAlign: 'middle',
    marginRight: 6,
  },

  roleBadge: {
    padding: '6px 12px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 700,
    display: 'inline-flex',
    alignItems: 'center',
    textTransform: 'capitalize',
    whiteSpace: 'nowrap',
  },

  suspendedStatus: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: '#FEE2E2',
    color: '#B91C1C',
    border: '1px solid #FECACA',
    padding: '6px 10px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 800,
  },

  activeStatus: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: '#DCFCE7',
    color: '#166534',
    border: '1px solid #BBF7D0',
    padding: '6px 10px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 800,
  },

  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(17,17,17,.6)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1100,
    padding: 20,
  },

  detailModal: {
    background: '#FFFFFF',
    width: '100%',
    maxWidth: 600,
    maxHeight: '90vh',
    overflowY: 'auto',
    borderRadius: 24,
    boxShadow: '0 25px 50px -12px rgba(0,0,0,.25)',
    animation: 'scaleIn .2s ease-out',
  },

  coverImage: {
    display: 'block',
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },

  closeButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 36,
    height: 36,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid rgba(255,255,255,.7)',
    borderRadius: '50%',
    background: 'rgba(255,255,255,.95)',
    color: '#111827',
    cursor: 'pointer',
  },

  detailContent: {
    padding: '0 32px 32px',
  },

  overlapAvatar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
    marginTop: -40,
    marginBottom: 16,
    position: 'relative',
  },

  profileHeading: {
    fontSize: 26,
    fontWeight: 900,
    color: '#111827',
    margin: '0 0 6px',
    letterSpacing: '-.5px',
    lineHeight: 1.25,
  },

  ownerLine: {
    fontSize: 14,
    color: '#4B5563',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontWeight: 600,
  },

  sectionHeading: {
    fontSize: 12,
    fontWeight: 800,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1,
    margin: '0 0 12px',
  },

  detailCard: {
    background: '#F9FAFB',
    border: '1px solid #E5E7EB',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 20,
  },

  detailLabel: {
    color: '#6B7280',
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    fontWeight: 600,
    flexShrink: 0,
  },

  detailValue: {
    color: '#111827',
    textAlign: 'right',
    overflowWrap: 'anywhere',
    fontWeight: 700,
  },

  modalActionFooter: {
    marginTop: 12,
    paddingTop: 24,
    borderTop: '1px solid #F3F4F6',
  },

  primaryStatusButton: {
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
  },

  evidenceLink: {
    color: '#EA580C',
    fontWeight: 700,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    textDecoration: 'none',
    fontSize: 13,
  },

  warning: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: '#FFFBEB',
    color: '#92400E',
    border: '1px solid #FDE68A',
    padding: 10,
    borderRadius: 8,
    fontSize: 12,
    marginTop: 12,
  },

  cleanModal: {
    background: '#FFFFFF',
    width: '100%',
    maxWidth: 580,
    maxHeight: '90vh',
    overflowY: 'auto',
    borderRadius: 24,
    boxShadow: '0 25px 50px -12px rgba(0,0,0,.25)',
    animation: 'scaleIn .2s ease-out',
    display: 'flex',
    flexDirection: 'column',
  },

  cleanModalHeader: {
    padding: '28px 32px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },

  cleanModalTitle: {
    fontSize: 22,
    fontWeight: 900,
    color: '#111827',
    margin: '0 0 6px',
    letterSpacing: '-0.3px',
  },

  cleanModalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    margin: 0,
    lineHeight: 1.4,
  },

  cleanCloseButton: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    border: 'none',
    background: '#F3F4F6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  },

  cleanModalBody: {
    padding: '0 32px 32px',
  },

  userSummaryCard: {
    background: '#F9FAFB',
    borderRadius: 16,
    padding: '18px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },

  userSummaryName: {
    fontSize: 16,
    fontWeight: 900,
    color: '#111827',
  },

  userSummaryEmail: {
    fontSize: 13,
    color: '#6B7280',
  },

  userSummaryRole: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },

  cleanSectionLabel: {
    fontSize: 11.5,
    fontWeight: 800,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: 8,
  },

  submittedAppealBox: {
    background: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: 16,
    padding: 20,
    fontSize: 14,
    color: '#374151',
    lineHeight: 1.6,
  },

  staffExplanationBox: {
    background: '#F9FAFB',
    border: '1px solid #E5E7EB',
    borderRadius: 14,
    padding: 16,
    fontSize: 13.5,
    color: '#4B5563',
    lineHeight: 1.5,
  },

  cleanModalFooter: {
    display: 'flex',
    gap: 12,
    marginTop: 28,
    paddingTop: 20,
    borderTop: '1px solid #F3F4F6',
  },

  cleanCancelButton: {
    flex: 1,
    padding: '14px 16px',
    borderRadius: 14,
    border: '1px solid #E5E7EB',
    background: '#FFFFFF',
    color: '#111827',
    fontWeight: 800,
    fontSize: 14,
    cursor: 'pointer',
  },

  cleanApproveButton: {
    flex: 1,
    padding: '14px 16px',
    borderRadius: 14,
    border: 'none',
    background: '#F97316',
    color: '#FFFFFF',
    fontWeight: 800,
    fontSize: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    cursor: 'pointer',
  },

  // SUSPENSION MODAL

  confirmModal: {
    background: '#FFFFFF',
    width: '100%',
    maxWidth: 440,
    maxHeight: '90vh',
    overflowY: 'auto',
    borderRadius: 24,
    padding: 28,
    boxShadow: '0 25px 50px -12px rgba(0,0,0,.25)',
    textAlign: 'center',
    animation: 'scaleIn .2s ease-out',
  },

  confirmIcon: {
    width: 60,
    height: 60,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px',
  },

  confirmTitle: {
    fontSize: 20,
    fontWeight: 900,
    margin: '0 0 8px',
    color: '#111827',
  },

  confirmText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 1.5,
    margin: '0 0 20px',
  },

  reasonLabel: {
    display: 'block',
    fontSize: 13,
    fontWeight: 800,
    color: '#374151',
    marginBottom: 8,
  },

  reasonInput: {
    display: 'block',
    width: '100%',
    boxSizing: 'border-box',
    resize: 'vertical',
    minHeight: 100,
    padding: 12,
    borderRadius: 12,
    border: '1px solid #D1D5DB',
    outline: 'none',
    fontSize: 14,
    lineHeight: 1.5,
    color: '#111827',
    background: '#FFFFFF',
  },

  reasonCounter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginTop: 7,
    fontSize: 12,
  },

  confirmButtons: {
    display: 'flex',
    gap: 10,
    marginTop: 20,
  },

  cancelButton: {
    flex: 1,
    padding: '10px 14px',
    border: '1px solid #E5E7EB',
    borderRadius: 10,
    background: '#FFFFFF',
    color: '#4B5563',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },

  confirmActionButton: {
    flex: 1,
    padding: '10px 14px',
    border: 'none',
    borderRadius: 10,
    color: '#FFFFFF',
    fontWeight: 800,
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },

  suspensionReason: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 9,
    padding: 12,
    background: '#FEF2F2',
    border: '1px solid #FECACA',
    borderRadius: 10,
    color: '#991B1B',
    fontSize: 12,
    lineHeight: 1.5,
  },

  suspensionReasonModal: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    background: '#FEF2F2',
    border: '1px solid #FECACA',
    borderRadius: 12,
    color: '#991B1B',
    fontSize: 13,
    lineHeight: 1.6,
  },
};
