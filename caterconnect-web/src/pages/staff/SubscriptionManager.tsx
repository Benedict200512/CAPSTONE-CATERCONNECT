import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type Payment = {
  id: string;
  amount: number;
  plan_id: string;
  payment_method: string | null;
  payment_reference: string | null;
  status: string;
  created_at: string;
  confirmed_at: string | null;
  caterers: { id: string; business_name: string; subscription_plan: string; logo_url: string | null } | null;
};

type Caterer = {
  id: string;
  user_id: string;
  business_name: string;
  city: string | null;
  logo_url: string | null;
  subscription_plan: string;
  subscription_expires_at: string | null;
  monthly_booking_count: number | null;
  profiles: { full_name: string; email: string } | null;
};

const PLANS = [
  { id: 'free',     label: 'Free',     price: 0,   color: '#6B7280', bg: '#F3F4F6' },
  { id: 'basic',    label: 'Basic',    price: 299, color: '#2563EB', bg: '#DBEAFE' },
  { id: 'standard', label: 'Standard', price: 499, color: '#D97706', bg: '#FEF3C7' },
  { id: 'premium',  label: 'Premium',  price: 999, color: '#7C3AED', bg: '#F5F3FF' },
];

export default function SubscriptionManager() {
  const [payments, setPayments]   = useState<Payment[]>([]);
  const [caterers, setCaterers]   = useState<Caterer[]>([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState<'caterers' | 'expiring' | 'payments'>('caterers');
  const [search, setSearch]       = useState('');
  const [planFilter, setPlanFilter] = useState('all');

  const loadPayments = async () => {
    const { data, error } = await supabase
      .from('subscription_payments')
      .select('*, caterers(id, business_name, subscription_plan, logo_url)')
      .eq('status', 'confirmed')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) console.error('loadPayments error:', error);
    setPayments((data as any) ?? []);
  };

  // Fetch caterers and profiles SEPARATELY (no join) and merge in JS.
  // This avoids the whole query coming back empty if RLS/relationship
  // quirks affect the embedded `profiles` join for the staff role.
  const loadCaterers = async () => {
    const { data: caterersData, error: caterersError } = await supabase
      .from('caterers')
      .select('*')
      .eq('verification_status', 'approved')
      .order('subscription_plan', { ascending: false });

    if (caterersError) {
      console.error('loadCaterers error:', caterersError);
      setCaterers([]);
      return;
    }

    const userIds = (caterersData ?? [])
      .map((c: any) => c.user_id)
      .filter(Boolean);

    let profilesById: Record<string, { full_name: string; email: string }> = {};

    if (userIds.length > 0) {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      if (profilesError) {
        console.error('loadProfiles error:', profilesError);
      } else {
        profilesById = Object.fromEntries(
          (profilesData ?? []).map((p: any) => [p.id, { full_name: p.full_name, email: p.email }])
        );
      }
    }

    const merged = (caterersData ?? []).map((c: any) => ({
      ...c,
      profiles: profilesById[c.user_id] ?? null,
    }));

    setCaterers(merged as any);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadPayments(), loadCaterers()]);
      setLoading(false);
    })();
  }, []);

  const planStyle = (planId: string) => PLANS.find((p) => p.id === planId) ?? PLANS[0];

  // ── Expiring soon calculation ──────────────────────────────
  const now = Date.now();
  const expiringCaterers = caterers
    .filter(c => c.subscription_plan !== 'free' && c.subscription_expires_at)
    .map(c => ({
      ...c,
      daysLeft: Math.ceil((new Date(c.subscription_expires_at!).getTime() - now) / 86400000),
    }))
    .filter(c => c.daysLeft <= 7)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const expiredCount = expiringCaterers.filter(c => c.daysLeft < 0).length;
  const expiringSoonCount = expiringCaterers.filter(c => c.daysLeft >= 0).length;

  // ── Revenue summary ──────────────────────────
  const totalRevenue = payments.reduce((s, p) => s + Number(p.amount), 0);
  const thisMonthRevenue = payments
    .filter(p => p.confirmed_at && new Date(p.confirmed_at) > new Date(now - 30 * 86400000))
    .reduce((s, p) => s + Number(p.amount), 0);

  // ── Filtered caterers for the table ──────────────────────────
  const filteredCaterers = caterers.filter(c => {
    const matchesPlan = planFilter === 'all' || c.subscription_plan === planFilter;
    const matchesSearch = !search ||
      c.business_name.toLowerCase().includes(search.toLowerCase()) ||
      (c.profiles as any)?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      (c.profiles as any)?.email?.toLowerCase().includes(search.toLowerCase());
    return matchesPlan && matchesSearch;
  });

  return (
    <div>
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.pageTitle}>Subscription Management</h1>
          <p style={styles.pageSub}>
            Payments are auto-confirmed via Xendit. Monitor caterer plans and renewals here.
          </p>
        </div>
      </div>

      {/* ── PLAN SUMMARY — caterer count per plan, top of page ── */}
      <div style={styles.planSummary}>
        {PLANS.map((plan) => {
          const count = caterers.filter((c) => c.subscription_plan === plan.id).length;
          const isActive = planFilter === plan.id;
          return (
            <button
              key={plan.id}
              onClick={() => { setPlanFilter(isActive ? 'all' : plan.id); setTab('caterers'); }}
              style={{
                ...styles.planPill,
                background: plan.bg,
                borderColor: isActive ? plan.color : plan.color + '44',
                borderWidth: isActive ? 2.5 : 1.5,
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 30, fontWeight: 900, color: plan.color }}>{count}</span>
              <span style={{ fontSize: 13, color: plan.color, fontWeight: 800 }}>{plan.label} Plan</span>
              <span style={{ fontSize: 11, color: plan.color, opacity: 0.75 }}>
                {plan.price === 0 ? 'Free' : `₱${plan.price}/mo`}
              </span>
            </button>
          );
        })}
      </div>

      {/* Revenue mini stats */}
      <div style={styles.revenueRow}>
        <div style={styles.revenueCard}>
          <span style={styles.revenueLabel}>Revenue (30 days)</span>
          <span style={styles.revenueValue}>₱{thisMonthRevenue.toLocaleString()}</span>
        </div>
        <div style={styles.revenueCard}>
          <span style={styles.revenueLabel}>Total Revenue</span>
          <span style={styles.revenueValue}>₱{totalRevenue.toLocaleString()}</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        <button
          onClick={() => setTab('caterers')}
          style={{ ...styles.tab, ...(tab === 'caterers' ? styles.tabActive : {}) }}
        >
          🍽️ Caterer Plans
        </button>
        <button
          onClick={() => setTab('expiring')}
          style={{ ...styles.tab, ...(tab === 'expiring' ? styles.tabActive : {}) }}
        >
          ⏰ Renewals
          {expiringCaterers.length > 0 && (
            <span style={styles.tabBadge}>{expiringCaterers.length}</span>
          )}
        </button>
        <button
          onClick={() => setTab('payments')}
          style={{ ...styles.tab, ...(tab === 'payments' ? styles.tabActive : {}) }}
        >
          💳 Payment History
        </button>
      </div>

      {/* ── CATERER PLANS TAB ── */}
      {tab === 'caterers' && (
        <div>
          {/* Filters */}
          <div style={styles.filterBar}>
            <input
              type="text"
              placeholder="Search by business name, owner, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={styles.searchInput}
            />
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              style={styles.planFilterSelect}
            >
              <option value="all">All Plans</option>
              {PLANS.map((p) => (
                <option key={p.id} value={p.id}>{p.label} Plan</option>
              ))}
            </select>
            {(planFilter !== 'all' || search) && (
              <button
                onClick={() => { setPlanFilter('all'); setSearch(''); }}
                style={styles.clearFilterBtn}
              >
                Clear ✕
              </button>
            )}
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {loading ? (
              <div className="empty-state">
                <div className="empty-state-icon">⏳</div>
                <div className="empty-state-sub">Loading caterers...</div>
              </div>
            ) : filteredCaterers.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🍽️</div>
                <div className="empty-state-title">No caterers found</div>
                <div className="empty-state-sub">
                  {search || planFilter !== 'all' ? 'Try adjusting your filters.' : 'No approved caterers yet.'}
                </div>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Business Name</th>
                    <th>Owner</th>
                    <th>Current Plan</th>
                    <th>Expires</th>
                    <th>Bookings / mo</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCaterers.map((c) => {
                    const ps = planStyle(c.subscription_plan);
                    const expires = c.subscription_expires_at
                      ? new Date(c.subscription_expires_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
                      : '—';
                    return (
                      <tr key={c.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {c.logo_url ? (
                              <img
                                src={c.logo_url}
                                alt={c.business_name}
                                style={{ width: 36, height: 36, borderRadius: 10, objectFit: 'cover', flexShrink: 0, border: '1px solid #E5E7EB' }}
                              />
                            ) : (
                              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FEF3E8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#F97316', fontSize: 14, flexShrink: 0 }}>
                                {c.business_name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <div style={{ fontWeight: 700, color: '#111' }}>{c.business_name}</div>
                              <div style={{ fontSize: 11, color: '#9CA3AF' }}>{c.city ?? ''}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ color: '#6B7280', fontSize: 13 }}>
                          {(c.profiles as any)?.full_name ?? '—'}
                          <div style={{ fontSize: 11, color: '#9CA3AF' }}>{(c.profiles as any)?.email ?? ''}</div>
                        </td>
                        <td>
                          <span className="badge" style={{ background: ps.bg, color: ps.color }}>
                            {ps.label}
                          </span>
                        </td>
                        <td style={{ fontSize: 12, color: '#9CA3AF' }}>
                          {c.subscription_plan === 'free' ? '—' : expires}
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, color: '#F97316', fontSize: 15 }}>
                            {c.monthly_booking_count ?? 0}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── RENEWALS TAB ── */}
      {tab === 'expiring' && (
        <div>
          {expiringCaterers.length > 0 && (
            <div style={styles.alertSummary}>
              {expiredCount > 0 && (
                <span style={styles.alertChipExpired}>{expiredCount} expired</span>
              )}
              {expiringSoonCount > 0 && (
                <span style={styles.alertChipSoon}>{expiringSoonCount} expiring within 7 days</span>
              )}
            </div>
          )}

          {loading ? (
            <div className="empty-state">
              <div className="empty-state-icon">⏳</div>
              <div className="empty-state-sub">Loading...</div>
            </div>
          ) : expiringCaterers.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">✅</div>
              <div className="empty-state-title">No upcoming renewals</div>
              <div className="empty-state-sub">No paid subscriptions are expiring within the next 7 days.</div>
            </div>
          ) : (
            <div style={styles.paymentList}>
              {expiringCaterers.map((c) => {
                const ps = planStyle(c.subscription_plan);
                const isExpired = c.daysLeft < 0;
                return (
                  <div key={c.id} style={{ ...styles.paymentCard, borderLeft: `4px solid ${isExpired ? '#DC2626' : '#F59E0B'}` }}>
                    <div style={styles.paymentCardLeft}>
                      <div style={{ ...styles.planBadgeLg, background: ps.bg }}>
                        <span style={{ color: ps.color, fontWeight: 900, fontSize: 13 }}>{ps.label}</span>
                      </div>
                      <div>
                        <div style={styles.paymentCatererRow}>
                          {c.logo_url ? (
                            <img src={c.logo_url} alt="" style={{ width: 28, height: 28, borderRadius: 8, objectFit: 'cover', flexShrink: 0, border: '1px solid #E5E7EB' }} />
                          ) : (
                            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#FEF3E8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#F97316', fontSize: 12, flexShrink: 0 }}>
                              {c.business_name.charAt(0)}
                            </div>
                          )}
                          <div style={styles.paymentCaterer}>{c.business_name}</div>
                        </div>
                        <div style={styles.paymentMeta}>
                          <span style={{ fontSize: 12, color: '#9CA3AF' }}>
                            {(c.profiles as any)?.email ?? ''}
                          </span>
                          {c.subscription_expires_at && (
                            <span style={{ fontSize: 12, color: '#9CA3AF' }}>
                              Expires {new Date(c.subscription_expires_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div style={styles.paymentCardRight}>
                      <span
                        className="badge"
                        style={{
                          background: isExpired ? '#FEE2E2' : '#FEF3C7',
                          color: isExpired ? '#991B1B' : '#92400E',
                        }}
                      >
                        {isExpired ? `Expired ${Math.abs(c.daysLeft)}d ago` : c.daysLeft === 0 ? 'Expires today' : `${c.daysLeft}d left`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── PAYMENTS TAB — VIEW ONLY ── */}
      {tab === 'payments' && (
        <div>
          <div style={styles.autoNotice}>
            ℹ️ All payments are processed and confirmed automatically through Xendit (GCash). This list is for monitoring only.
          </div>

          {loading ? (
            <div className="empty-state">
              <div className="empty-state-icon">⏳</div>
              <div className="empty-state-sub">Loading payments...</div>
            </div>
          ) : payments.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📭</div>
              <div className="empty-state-title">No payments yet</div>
            </div>
          ) : (
            <div style={styles.paymentList}>
              {payments.map((p) => {
                const ps = planStyle(p.plan_id);
                return (
                  <div key={p.id} style={styles.paymentCard}>
                    <div style={styles.paymentCardLeft}>
                      <div style={{ ...styles.planBadgeLg, background: ps.bg }}>
                        <span style={{ color: ps.color, fontWeight: 900, fontSize: 13 }}>{ps.label}</span>
                        <span style={{ color: ps.color, fontSize: 15, fontWeight: 900 }}>
                          ₱{Number(p.amount).toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <div style={styles.paymentCatererRow}>
                          {(p.caterers as any)?.logo_url ? (
                            <img
                              src={(p.caterers as any).logo_url}
                              alt=""
                              style={{ width: 28, height: 28, borderRadius: 8, objectFit: 'cover', flexShrink: 0, border: '1px solid #E5E7EB' }}
                            />
                          ) : (
                            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#FEF3E8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#F97316', fontSize: 12, flexShrink: 0 }}>
                              {(p.caterers as any)?.business_name?.charAt(0) ?? '?'}
                            </div>
                          )}
                          <div style={styles.paymentCaterer}>
                            {(p.caterers as any)?.business_name ?? '—'}
                          </div>
                        </div>
                        <div style={styles.paymentMeta}>
                          {p.payment_method && (
                            <span style={styles.metaChip}>via {p.payment_method}</span>
                          )}
                          {p.payment_reference && (
                            <span style={styles.metaChip}>
                              Ref: {p.payment_reference.slice(0, 20)}...
                            </span>
                          )}
                          <span style={{ fontSize: 12, color: '#9CA3AF' }}>
                            {new Date(p.created_at).toLocaleDateString('en-PH', {
                              month: 'short', day: 'numeric', year: 'numeric',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div style={styles.paymentCardRight}>
                      <span className="badge badge-approved">confirmed</span>
                      {p.confirmed_at && (
                        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6 }}>
                          {new Date(p.confirmed_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  pageTitle:  { fontSize: 26, fontWeight: 900, color: '#111', marginBottom: 4 },
  pageSub:    { fontSize: 14, color: '#6B7280' },

  planSummary: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 },
  planPill: {
    borderRadius: 14, padding: '18px 16px', border: '1.5px solid',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
    transition: 'all 0.15s', fontFamily: 'inherit',
  },

  revenueRow: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 20 },
  revenueCard: {
    background: 'white', border: '1px solid #E8EAED', borderRadius: 12,
    padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 4,
  },
  revenueLabel: { fontSize: 12, color: '#6B7280', fontWeight: 600 },
  revenueValue: { fontSize: 20, fontWeight: 900, color: '#111' },

  autoNotice: {
    background: '#EFF6FF', border: '1px solid #BFDBFE',
    borderRadius: 10, padding: '12px 16px',
    fontSize: 13, color: '#1D4ED8', marginBottom: 16,
  },

  alertSummary: { display: 'flex', gap: 10, marginBottom: 16 },
  alertChipExpired: {
    background: '#FEE2E2', color: '#991B1B', fontWeight: 700, fontSize: 13,
    padding: '6px 14px', borderRadius: 20,
  },
  alertChipSoon: {
    background: '#FEF3C7', color: '#92400E', fontWeight: 700, fontSize: 13,
    padding: '6px 14px', borderRadius: 20,
  },

  tabs:      { display: 'flex', gap: 8, marginBottom: 20 },
  tab:       { padding: '10px 20px', borderRadius: 10, border: '1.5px solid #E8EAED', background: 'white', fontSize: 13, fontWeight: 700, color: '#6B7280', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 6 },
  tabActive: { background: '#111', color: 'white', border: '1.5px solid #111' },
  tabBadge: { background: '#DC2626', color: 'white', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 900 },

  filterBar: { display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' },
  searchInput: {
    flex: 1, maxWidth: 360, padding: '9px 14px', borderRadius: 8,
    border: '1px solid #E8EAED', fontSize: 13, outline: 'none',
  },
  planFilterSelect: {
    padding: '9px 14px', borderRadius: 8, border: '1px solid #E8EAED',
    fontSize: 13, cursor: 'pointer', background: 'white', outline: 'none', fontWeight: 600,
  },
  clearFilterBtn: {
    padding: '9px 14px', borderRadius: 8, border: '1px solid #E8EAED',
    fontSize: 13, cursor: 'pointer', background: '#F3F4F6', color: '#6B7280', fontWeight: 700,
  },

  paymentList: { display: 'flex', flexDirection: 'column', gap: 12 },
  paymentCard: {
    background: 'white', borderRadius: 14, border: '1px solid #E8EAED',
    padding: '18px 22px', display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    transition: 'box-shadow 0.15s',
  },
  paymentCardLeft:  { display: 'flex', alignItems: 'center', gap: 16 },
  paymentCardRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end' },
  paymentCatererRow:{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 },

  planBadgeLg: {
    borderRadius: 12, padding: '12px 16px',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    minWidth: 110, gap: 2,
  },

  paymentCaterer: { fontSize: 15, fontWeight: 800, color: '#111' },
  paymentMeta:    { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  metaChip: {
    background: '#F3F4F6', borderRadius: 6, padding: '2px 8px',
    fontSize: 11, color: '#6B7280', fontWeight: 600,
  },
};