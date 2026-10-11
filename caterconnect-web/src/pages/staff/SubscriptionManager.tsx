import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  CreditCard, Search, Clock, 
  AlertCircle, CheckCircle2, Building2,
  X, Loader2, DollarSign, RefreshCw, Send 
} from 'lucide-react';

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
  const [payments, setPayments]    = useState<Payment[]>([]);
  const [caterers, setCaterers]    = useState<Caterer[]>([]);
  const [loading, setLoading]      = useState(true);
  const [tab, setTab]              = useState<'caterers' | 'expiring' | 'payments'>('caterers');
  const [search, setSearch]        = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [notifyingId, setNotifyingId] = useState<string | null>(null);

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

  const handleNotifyCaterer = async (caterer: Caterer & { daysLeft: number }) => {
    if (!caterer.user_id) return;
    try {
      setNotifyingId(caterer.id);
      const message = caterer.daysLeft < 0 
        ? `Your ${caterer.subscription_plan.toUpperCase()} subscription has expired. Please renew your plan to keep your premium features active.`
        : `Your ${caterer.subscription_plan.toUpperCase()} subscription is expiring in ${caterer.daysLeft} day(s). Please renew your subscription soon.`;

      const { error } = await supabase.from('notifications').insert({
        user_id: caterer.user_id,
        title: 'Subscription Expiry Notice',
        message: message,
        type: 'subscription', // Satisfies the not-null constraint on 'type'
        is_read: false,
      });

      if (error) throw error;
      alert(`Successfully sent notification to ${caterer.business_name}!`);
    } catch (err: any) {
      console.error('Error sending notification:', err);
      alert('Failed to send notification: ' + err.message);
    } finally {
      setNotifyingId(null);
    }
  };

  const planStyle = (planId: string) => PLANS.find((p) => p.id === planId) ?? PLANS[0];

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

  const totalRevenue = payments.reduce((s, p) => s + Number(p.amount), 0);
  const thisMonthRevenue = payments
    .filter(p => p.confirmed_at && new Date(p.confirmed_at) > new Date(now - 30 * 86400000))
    .reduce((s, p) => s + Number(p.amount), 0);

  const filteredCaterers = caterers.filter(c => {
    const matchesPlan = planFilter === 'all' || c.subscription_plan === planFilter;
    const matchesSearch = !search ||
      c.business_name.toLowerCase().includes(search.toLowerCase()) ||
      (c.profiles as any)?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      (c.profiles as any)?.email?.toLowerCase().includes(search.toLowerCase());
    return matchesPlan && matchesSearch;
  });

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#111', marginBottom: 6, letterSpacing: '-0.5px' }}>Subscription Management</h1>
          <p style={{ fontSize: 15, color: '#6B7280', margin: 0 }}>Payments are auto-confirmed via Xendit. Monitor caterer plans and renewals here.</p>
        </div>
      </div>

      {/* Plan Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        {PLANS.map((plan) => {
          const count = caterers.filter((c) => c.subscription_plan === plan.id).length;
          const isActive = planFilter === plan.id;
          return (
            <button
              key={plan.id}
              onClick={() => { setPlanFilter(isActive ? 'all' : plan.id); setTab('caterers'); }}
              style={{
                background: plan.bg,
                borderColor: isActive ? plan.color : '#E5E7EB',
                borderWidth: isActive ? '2px' : '1px',
                borderStyle: 'solid',
                borderRadius: 20, padding: '20px 24px',
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6,
                cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left',
                boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.05)' : 'none'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: plan.color, textTransform: 'uppercase', letterSpacing: 0.5 }}>{plan.label} Plan</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', background: 'rgba(255,255,255,0.6)', padding: '2px 8px', borderRadius: 10 }}>
                  {plan.price === 0 ? 'Free' : `₱${plan.price}/mo`}
                </span>
              </div>
              <span style={{ fontSize: 32, fontWeight: 900, color: '#111', lineHeight: 1 }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Revenue Mini Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 28 }}>
        <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 16, padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: '#F0FDF4', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DollarSign size={24} />
          </div>
          <div>
            <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Revenue (30 Days)</span>
            <span style={{ fontSize: 22, fontWeight: 900, color: '#111' }}>₱{thisMonthRevenue.toLocaleString()}</span>
          </div>
        </div>
        <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 16, padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CreditCard size={24} />
          </div>
          <div>
            <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Total Platform Revenue</span>
            <span style={{ fontSize: 22, fontWeight: 900, color: '#111' }}>₱{totalRevenue.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Consistent Segmented Filter Navigation Tabs with Icons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, background: '#F3F4F6', padding: 6, borderRadius: 14, border: '1px solid #E5E7EB', width: 'fit-content', flexWrap: 'wrap' }}>
        {[
          { key: 'caterers', icon: Building2, label: 'Caterer Plans', color: '#2563EB' },
          { key: 'expiring', icon: Clock, label: 'Renewals', color: '#D97706', count: expiringCaterers.length },
          { key: 'payments', icon: CreditCard, label: 'Payment History', color: '#16A34A' },
        ].map((tabItem) => {
          const TabIcon = tabItem.icon;
          const isActive = tab === tabItem.key;
          return (
            <button
              key={tabItem.key}
              onClick={() => setTab(tabItem.key as any)}
              style={{ 
                padding: '10px 20px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s',
                background: isActive ? '#FFFFFF' : 'transparent',
                color: isActive ? '#111' : '#6B7280',
                boxShadow: isActive ? '0 2px 4px rgba(0,0,0,0.04)' : 'none'
              }}
            >
              <TabIcon size={16} color={isActive ? tabItem.color : '#6B7280'} />
              {tabItem.label}
              {tabItem.key === 'expiring' && expiringCaterers.length > 0 && (
                <span style={{ marginLeft: 4, background: '#DC2626', color: '#FFF', borderRadius: 8, padding: '2px 6px', fontSize: 11, fontWeight: 800 }}>
                  {expiringCaterers.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Caterers Tab */}
      {tab === 'caterers' && (
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 280, maxWidth: 400 }}>
              <Search size={18} color="#9CA3AF" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search business, owner, or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: '100%', padding: '12px 16px 12px 44px', borderRadius: 14, border: '1px solid #E5E7EB', outline: 'none', fontSize: 14, background: '#FFF' }}
              />
            </div>
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              style={{ padding: '12px 16px', borderRadius: 14, border: '1px solid #E5E7EB', fontSize: 14, fontWeight: 700, background: '#FFF', outline: 'none', cursor: 'pointer' }}
            >
              <option value="all">All Plans</option>
              {PLANS.map((p) => (
                <option key={p.id} value={p.id}>{p.label} Plan</option>
              ))}
            </select>
            {(planFilter !== 'all' || search) && (
              <button
                onClick={() => { setPlanFilter('all'); setSearch(''); }}
                style={{ padding: '12px 18px', borderRadius: 14, border: '1px solid #E5E7EB', background: '#F9FAFB', color: '#4B5563', fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <X size={14} /> Clear
              </button>
            )}
          </div>

          <div style={{ background: '#FFFFFF', borderRadius: 20, border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: 80, textAlign: 'center', color: '#9CA3AF', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <Loader2 size={36} color="#F97316" className="animate-spin" />
                <span style={{ fontSize: 15, fontWeight: 600 }}>Loading active caterer ledger...</span>
              </div>
            ) : filteredCaterers.length === 0 ? (
              <div style={{ padding: 80, textAlign: 'center', color: '#9CA3AF', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #E5E7EB' }}>
                  <Building2 size={32} color="#D1D5DB" />
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#111', marginBottom: 4 }}>No caterers found</div>
                  <div style={{ fontSize: 14 }}>Try modifying your active filter parameters.</div>
                </div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                      <th style={{ padding: '16px 20px', fontSize: 12, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Business Name</th>
                      <th style={{ padding: '16px 20px', fontSize: 12, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Owner Details</th>
                      <th style={{ padding: '16px 20px', fontSize: 12, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Current Plan</th>
                      <th style={{ padding: '16px 20px', fontSize: 12, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Expiration Date</th>
                      <th style={{ padding: '16px 20px', fontSize: 12, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Monthly Bookings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCaterers.map((c, i) => {
                      const ps = planStyle(c.subscription_plan);
                      const expires = c.subscription_expires_at
                        ? new Date(c.subscription_expires_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
                        : '—';
                      return (
                        <tr key={c.id} style={{ borderBottom: i === filteredCaterers.length - 1 ? 'none' : '1px solid #F3F4F6', transition: 'background 0.15s' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          
                          <td style={{ padding: '18px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              {c.logo_url ? (
                                <img src={c.logo_url} alt="" style={{ width: 36, height: 36, borderRadius: 10, objectFit: 'cover', border: '1px solid #E5E7EB' }} />
                              ) : (
                                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FEF3E8', color: '#F97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14 }}>
                                  {c.business_name.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <div style={{ fontWeight: 800, fontSize: 14, color: '#111' }}>{c.business_name}</div>
                                <div style={{ fontSize: 12, color: '#9CA3AF' }}>{c.city ?? ''}</div>
                              </div>
                            </div>
                          </td>

                          <td style={{ padding: '18px 20px' }}>
                            <div style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>{(c.profiles as any)?.full_name ?? '—'}</div>
                            <div style={{ fontSize: 12, color: '#9CA3AF' }}>{(c.profiles as any)?.email ?? ''}</div>
                          </td>

                          <td style={{ padding: '18px 20px' }}>
                            <span style={{ padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 800, background: ps.bg, color: ps.color }}>
                              {ps.label}
                            </span>
                          </td>

                          <td style={{ padding: '18px 20px', fontSize: 13, fontWeight: 600, color: '#4B5563' }}>
                            {c.subscription_plan === 'free' ? '—' : expires}
                          </td>

                          <td style={{ padding: '18px 20px', fontWeight: 900, fontSize: 15, color: '#F97316' }}>
                            {c.monthly_booking_count ?? 0}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Renewals Tab */}
      {tab === 'expiring' && (
        <div>
          {expiringCaterers.length > 0 && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              {expiredCount > 0 && (
                <div style={{ background: '#FEE2E2', color: '#991B1B', border: '1px solid #FECACA', padding: '8px 16px', borderRadius: 12, fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertCircle size={16} /> {expiredCount} Expired Subscriptions
                </div>
              )}
              {expiringSoonCount > 0 && (
                <div style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A', padding: '8px 16px', borderRadius: 12, fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={16} /> {expiringSoonCount} Expiring within 7 days
                </div>
              )}
            </div>
          )}

          {loading ? (
            <div style={{ padding: 80, textAlign: 'center', color: '#9CA3AF', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <Loader2 size={36} color="#F97316" className="animate-spin" />
              <span style={{ fontSize: 15, fontWeight: 600 }}>Loading renewal queue...</span>
            </div>
          ) : expiringCaterers.length === 0 ? (
            <div style={{ background: '#FFFFFF', borderRadius: 20, border: '1px solid #E5E7EB', padding: 80, textAlign: 'center', color: '#9CA3AF' }}>
              <CheckCircle2 size={36} color="#16A34A" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: 18, fontWeight: 800, color: '#111', marginBottom: 4 }}>No upcoming renewals required</div>
              <div style={{ fontSize: 14 }}>All active paid subscriptions are secure and up to date.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {expiringCaterers.map((c) => {
                const ps = planStyle(c.subscription_plan);
                const isExpired = c.daysLeft < 0;
                const isNotifying = notifyingId === c.id;
                return (
                  <div key={c.id} style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E5E7EB', borderLeft: `4px solid ${isExpired ? '#DC2626' : '#F59E0B'}`, padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', flexWrap: 'wrap', gap: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ padding: '8px 14px', borderRadius: 10, background: ps.bg, color: ps.color, fontWeight: 900, fontSize: 13, textAlign: 'center' }}>
                        {ps.label}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                          {c.logo_url ? (
                            <img src={c.logo_url} alt="" style={{ width: 28, height: 28, borderRadius: 8, objectFit: 'cover', border: '1px solid #E5E7EB' }} />
                          ) : (
                            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#FEF3E8', color: '#F97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12 }}>
                              {c.business_name.charAt(0)}
                            </div>
                          )}
                          <span style={{ fontSize: 16, fontWeight: 900, color: '#111' }}>{c.business_name}</span>
                        </div>
                        <div style={{ fontSize: 13, color: '#6B7280', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          <span>{(c.profiles as any)?.email ?? ''}</span>
                          <span>•</span>
                          <span>Expires {new Date(c.subscription_expires_at!).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 800, background: isExpired ? '#FEE2E2' : '#FEF3C7', color: isExpired ? '#991B1B' : '#92400E', border: `1px solid ${isExpired ? '#FECACA' : '#FDE68A'}` }}>
                        {isExpired ? `Expired ${Math.abs(c.daysLeft)} days ago` : c.daysLeft === 0 ? 'Expires today' : `${c.daysLeft} days left`}
                      </span>
                      <button
                        onClick={() => handleNotifyCaterer(c)}
                        disabled={isNotifying}
                        style={{
                          background: '#F97316', color: '#FFF', border: 'none', padding: '8px 14px', borderRadius: 10,
                          fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                          opacity: isNotifying ? 0.7 : 1, transition: 'background 0.2s'
                        }}
                      >
                        {isNotifying ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                        Notify Caterer
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Payment History Tab */}
      {tab === 'payments' && (
        <div>
          <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 14, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, color: '#1D4ED8', fontSize: 14, fontWeight: 600 }}>
            <RefreshCw size={18} /> All payments are securely processed and confirmed automatically through Xendit (GCash / Cards). This ledger serves for real-time tracking.
          </div>

          {loading ? (
            <div style={{ padding: 80, textAlign: 'center', color: '#9CA3AF', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <Loader2 size={36} color="#F97316" className="animate-spin" />
              <span style={{ fontSize: 15, fontWeight: 600 }}>Loading payment audit trails...</span>
            </div>
          ) : payments.length === 0 ? (
            <div style={{ background: '#FFFFFF', borderRadius: 20, border: '1px solid #E5E7EB', padding: 80, textAlign: 'center', color: '#9CA3AF' }}>
              <CreditCard size={36} color="#D1D5DB" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: 18, fontWeight: 800, color: '#111', marginBottom: 4 }}>No payment logs found</div>
              <div style={{ fontSize: 14 }}>Successful transactions will appear here instantly.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {payments.map((p) => {
                const ps = planStyle(p.plan_id);
                return (
                  <div key={p.id} style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E5E7EB', padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ padding: '10px 16px', borderRadius: 12, background: ps.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 100 }}>
                        <span style={{ color: ps.color, fontWeight: 900, fontSize: 12, textTransform: 'uppercase' }}>{ps.label}</span>
                        <span style={{ color: ps.color, fontSize: 16, fontWeight: 900 }}>₱{Number(p.amount).toLocaleString()}</span>
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                          {(p.caterers as any)?.logo_url ? (
                            <img src={(p.caterers as any).logo_url} alt="" style={{ width: 28, height: 28, borderRadius: 8, objectFit: 'cover', border: '1px solid #E5E7EB' }} />
                          ) : (
                            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#FEF3E8', color: '#F97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12 }}>
                              {(p.caterers as any)?.business_name?.charAt(0) ?? '—'}
                            </div>
                          )}
                          <span style={{ fontSize: 16, fontWeight: 900, color: '#111' }}>{(p.caterers as any)?.business_name ?? '—'}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                          {p.payment_method && <span style={{ background: '#F3F4F6', borderRadius: 6, padding: '2px 8px', fontSize: 11, color: '#4B5563', fontWeight: 700 }}>via {p.payment_method}</span>}
                          {p.payment_reference && <span style={{ background: '#F3F4F6', borderRadius: 6, padding: '2px 8px', fontSize: 11, color: '#4B5563', fontWeight: 700, fontFamily: 'monospace' }}>Ref: {p.payment_reference.slice(0, 16)}...</span>}
                          <span style={{ fontSize: 12, color: '#9CA3AF' }}>
                            {new Date(p.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 800, background: '#DCFCE7', color: '#166534', border: '1px solid #BBF7D0', textTransform: 'uppercase' }}>
                        Confirmed
                      </span>
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