import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function Revenue() {
  const [payments, setPayments] = useState<any[]>([]);
  const [planCounts, setPlanCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [filterPlan, setFilterPlan] = useState('all');

  useEffect(() => {
    const load = async () => {
      const [paymentsRes, caterersRes] = await Promise.all([
        supabase.from('subscription_payments').select('*, caterers(business_name)').eq('status', 'confirmed').order('confirmed_at', { ascending: false }),
        supabase.from('caterers').select('subscription_plan').eq('verification_status', 'approved'),
      ]);
      setPayments(paymentsRes.data ?? []);
      const counts: Record<string, number> = { free: 0, basic: 0, standard: 0, premium: 0 };
      (caterersRes.data ?? []).forEach((c: any) => { counts[c.subscription_plan] = (counts[c.subscription_plan] ?? 0) + 1; });
      setPlanCounts(counts);
      setLoading(false);
    };
    load();
  }, []);

  const now = Date.now();
  const totalRevenue  = payments.reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const monthRevenue  = payments.filter(p => new Date(p.confirmed_at) > new Date(now - 30 * 86400000)).reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const weekRevenue   = payments.filter(p => new Date(p.confirmed_at) > new Date(now -  7 * 86400000)).reduce((s, p) => s + Number(p.amount ?? 0), 0);

  const planInfo: Record<string, { label: string; price: number; color: string; bg: string }> = {
    free:     { label: 'Free',     price: 0,   color: '#6B7280', bg: '#F3F4F6' },
    basic:    { label: 'Basic',    price: 299, color: '#2563EB', bg: '#DBEAFE' },
    standard: { label: 'Standard', price: 499, color: '#D97706', bg: '#FEF3C7' },
    premium:  { label: 'Premium',  price: 999, color: '#7C3AED', bg: '#F5F3FF' },
  };

  const displayed = filterPlan === 'all' ? payments : payments.filter(p => p.plan_id === filterPlan);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Revenue & Subscriptions</h1>
          <p className="page-sub">Subscription-based revenue — caterers keep 100% of booking earnings</p>
        </div>
      </div>

      {/* Revenue summary */}
      <div className="stat-grid" style={{ marginBottom: 24 }}>
        {[
          { icon: '💰', label: 'Total Revenue',     value: `₱${totalRevenue.toLocaleString()}`,  color: '#16A34A', bg: '#DCFCE7' },
          { icon: '📅', label: 'This Month',        value: `₱${monthRevenue.toLocaleString()}`,  color: '#F97316', bg: '#FEF3E8' },
          { icon: '🗓️', label: 'This Week',         value: `₱${weekRevenue.toLocaleString()}`,   color: '#2563EB', bg: '#DBEAFE' },
          { icon: '✅', label: 'Total Payments',    value: payments.length,                      color: '#7C3AED', bg: '#F5F3FF' },
        ].map(c => (
          <div key={c.label} className="card stat-card">
            <div className="stat-icon" style={{ background: c.bg }}>{c.icon}</div>
            <div>
              <div className="stat-val" style={{ color: c.color }}>{loading ? '—' : c.value}</div>
              <div className="stat-lbl">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Plan distribution */}
      <h2 style={{ fontSize: 17, fontWeight: 900, marginBottom: 14 }}>Caterer Plan Distribution</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
        {Object.entries(planInfo).map(([key, info]) => (
          <div key={key} className="card" style={{ textAlign: 'center', borderTop: `3px solid ${info.color}`, paddingTop: 20 }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: info.color, marginBottom: 4 }}>{loading ? '—' : (planCounts[key] ?? 0)}</div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{info.label} Plan</div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>{info.price === 0 ? 'Free' : `₱${info.price}/mo`}</div>
          </div>
        ))}
      </div>

      {/* Zero commission notice */}
      <div style={{ background: '#F0FDF4', borderRadius: 14, padding: 18, border: '1px solid #86EFAC', marginBottom: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#166534', marginBottom: 4 }}>🎉 Zero Commission Model</div>
        <div style={{ fontSize: 13, color: '#15803D', lineHeight: 1.7 }}>
          CaterConnect does not charge commissions on bookings. Caterers keep 100% of their earnings.
          Revenue is generated solely through monthly subscription fees.
        </div>
      </div>

      {/* Payment history */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ fontSize: 17, fontWeight: 900 }}>Payment History</h2>
        <div className="tab-bar" style={{ marginBottom: 0 }}>
          {['all', 'basic', 'standard', 'premium'].map(p => (
            <button key={p} className={`tab-btn ${filterPlan === p ? 'active' : ''}`} onClick={() => setFilterPlan(p)} style={{ padding: '6px 14px', fontSize: 12 }}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="empty-state"><div className="empty-state-icon">⏳</div><div className="empty-state-sub">Loading...</div></div>
        ) : displayed.length === 0 ? (
          <div className="empty-state"><div className="empty-state-icon">💳</div><div className="empty-state-title">No payments yet</div></div>
        ) : (
          <table>
            <thead><tr><th>Caterer</th><th>Plan</th><th>Amount</th><th>Method</th><th>Reference</th><th>Date</th></tr></thead>
            <tbody>
              {displayed.map((p) => (
                <tr key={p.id}>
                  <td><strong>{(p.caterers as any)?.business_name ?? '—'}</strong></td>
                  <td>
                    <span className="badge" style={{ background: planInfo[p.plan_id]?.bg, color: planInfo[p.plan_id]?.color }}>
                      {planInfo[p.plan_id]?.label ?? p.plan_id}
                    </span>
                  </td>
                  <td style={{ fontWeight: 800, color: '#16A34A' }}>₱{Number(p.amount).toLocaleString()}</td>
                  <td><span className="badge badge-review">{p.payment_method ?? 'gcash'}</span></td>
                  <td style={{ fontSize: 12, color: '#9CA3AF', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.payment_reference ?? '—'}</td>
                  <td style={{ fontSize: 12, color: '#9CA3AF' }}>{p.confirmed_at ? new Date(p.confirmed_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}