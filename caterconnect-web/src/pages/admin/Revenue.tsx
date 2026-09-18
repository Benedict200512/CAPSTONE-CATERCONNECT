import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { DollarSign, Calendar, Clock, CreditCard, ShieldCheck, TrendingUp, Loader2, ArrowUpRight, Receipt } from 'lucide-react';

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

  const planInfo: Record<string, { label: string; price: number; color: string; bg: string; border: string }> = {
    free:     { label: 'Free',     price: 0,   color: '#6B7280', bg: '#F3F4F6', border: '#E5E7EB' },
    basic:    { label: 'Basic',    price: 299, color: '#2563EB', bg: '#DBEAFE', border: '#BFDBFE' },
    standard: { label: 'Standard', price: 499, color: '#D97706', bg: '#FEF3C7', border: '#FDE68A' },
    premium:  { label: 'Premium',  price: 999, color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
  };

  const displayed = filterPlan === 'all' ? payments : payments.filter(p => p.plan_id === filterPlan);

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Header Section */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: '#111', marginBottom: 6, letterSpacing: '-0.5px' }}>Revenue & Subscriptions</h1>
        <p style={{ fontSize: 15, color: '#6B7280', margin: 0 }}>Monitor subscription cash flow and platform tier distribution.</p>
      </div>

      {/* Primary KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24, marginBottom: 32 }}>
        {[
          { icon: DollarSign, label: 'Total Revenue',  value: `₱${totalRevenue.toLocaleString()}`,  color: '#16A34A', bg: '#DCFCE7', accent: 'linear-gradient(135deg, #16A34A 0%, #4ADE80 100%)' },
          { icon: Calendar,   label: 'This Month',     value: `₱${monthRevenue.toLocaleString()}`,  color: '#F97316', bg: '#FFF7ED', accent: 'linear-gradient(135deg, #F97316 0%, #FB923C 100%)' },
          { icon: Clock,      label: 'This Week',      value: `₱${weekRevenue.toLocaleString()}`,   color: '#2563EB', bg: '#DBEAFE', accent: 'linear-gradient(135deg, #2563EB 0%, #60A5FA 100%)' },
          { icon: CreditCard, label: 'Total Payments', value: payments.length,                      color: '#7C3AED', bg: '#F5F3FF', accent: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)' },
        ].map((c, idx) => {
          const Icon = c.icon;
          return (
            <div key={idx} style={{ position: 'relative', background: '#FFFFFF', borderRadius: 20, padding: 24, border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -2px rgba(0,0,0,0.02)', overflow: 'hidden', transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'default' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 20px -3px rgba(0,0,0,0.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.02)'; }}>
              
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: c.accent }} />
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, marginTop: 4 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={24} color={c.color} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#6B7280' }}>{c.label}</div>
              </div>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#111', letterSpacing: '-1px' }}>
                {loading ? <Loader2 size={24} className="animate-spin" color="#9CA3AF" /> : c.value}
              </div>
            </div>
          );
        })}
      </div>

      {/* Zero Commission Hero Notice */}
      <div style={{ background: 'linear-gradient(to right, #F0FDF4, #DCFCE7)', borderRadius: 20, padding: '24px 32px', border: '1px solid #BBF7D0', marginBottom: 36, display: 'flex', alignItems: 'center', gap: 24, boxShadow: '0 4px 6px -1px rgba(22, 163, 74, 0.05)' }}>
        <div style={{ background: '#FFFFFF', padding: 16, borderRadius: '50%', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', flexShrink: 0 }}>
          <TrendingUp size={32} color="#16A34A" />
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#14532D', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            Fair-Trade Zero Commission Model <ShieldCheck size={20} color="#16A34A" />
          </div>
          <div style={{ fontSize: 15, color: '#166534', lineHeight: 1.6, maxWidth: '90%' }}>
            CaterConnect operates on a strict zero-commission policy for event bookings. Independent caterers retain 100% of their earnings. Platform sustainability is driven entirely by our fixed, transparent monthly infrastructure plans.
          </div>
        </div>
      </div>

      {/* Plan Distribution Stats */}
      <h2 style={{ fontSize: 20, fontWeight: 900, color: '#111', marginBottom: 16, letterSpacing: '-0.5px' }}>Tier Distribution</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24, marginBottom: 40 }}>
        {Object.entries(planInfo).map(([key, info]) => (
          <div key={key} style={{ background: '#FFFFFF', borderRadius: 20, border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', padding: '28px 24px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: info.color }} />
            
            <div style={{ fontSize: 14, fontWeight: 800, color: info.color, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
              {info.label} Plan
            </div>
            <div style={{ fontSize: 42, fontWeight: 900, color: '#111', marginBottom: 12, letterSpacing: '-1.5px' }}>
              {loading ? <Loader2 size={28} className="animate-spin" color="#9CA3AF" style={{ margin: 'auto' }} /> : (planCounts[key] ?? 0)}
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: info.bg, color: info.color, padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, border: `1px solid ${info.border}` }}>
              {info.price === 0 ? 'Free Entry' : `₱${info.price} / mo`}
            </div>
          </div>
        ))}
      </div>

      {/* Payment History Ledger */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: '#111', marginBottom: 4, letterSpacing: '-0.5px' }}>Payment Ledger</h2>
          <p style={{ fontSize: 14, color: '#6B7280', margin: 0 }}>A complete chronological history of all confirmed transactions.</p>
        </div>
        
        {/* Segmented Filter Controls */}
        <div style={{ display: 'flex', gap: 6, background: '#F3F4F6', padding: 6, borderRadius: 14, border: '1px solid #E5E7EB' }}>
          {['all', 'basic', 'standard', 'premium'].map(p => (
            <button 
              key={p} 
              onClick={() => setFilterPlan(p)} 
              style={{ 
                padding: '8px 18px', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 10, cursor: 'pointer', textTransform: 'capitalize', transition: 'all 0.2s',
                background: filterPlan === p ? '#FFFFFF' : 'transparent', color: filterPlan === p ? '#111' : '#6B7280',
                boxShadow: filterPlan === p ? '0 2px 4px rgba(0,0,0,0.04)' : 'none'
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: '#FFFFFF', borderRadius: 20, border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 80, textAlign: 'center', color: '#9CA3AF', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <Loader2 size={36} color="#16A34A" className="animate-spin" />
            <div style={{ fontSize: 15, fontWeight: 600 }}>Loading transaction ledger...</div>
          </div>
        ) : displayed.length === 0 ? (
          <div style={{ padding: 80, textAlign: 'center', color: '#9CA3AF', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #E5E7EB' }}>
              <Receipt size={32} color="#D1D5DB" />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#111', marginBottom: 4 }}>No transactions found</div>
              <div style={{ fontSize: 14 }}>No confirmed payments match the current filter criteria.</div>
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                  <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Caterer Entity</th>
                  <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Sub Plan</th>
                  <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Amount paid</th>
                  <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Gateway</th>
                  <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Reference ID</th>
                  <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'right' }}>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((p, i) => (
                  <tr key={p.id} style={{ borderBottom: i === displayed.length - 1 ? 'none' : '1px solid #F3F4F6', transition: 'background 0.2s ease' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '20px 24px', fontSize: 14, fontWeight: 800, color: '#111' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {(p.caterers as any)?.business_name ?? '—'}
                      </div>
                    </td>
                    <td style={{ padding: '20px 24px' }}>
                      <span style={{ padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: planInfo[p.plan_id]?.bg, color: planInfo[p.plan_id]?.color, border: `1px solid ${planInfo[p.plan_id]?.border}` }}>
                        {planInfo[p.plan_id]?.label ?? p.plan_id}
                      </span>
                    </td>
                    <td style={{ padding: '20px 24px', fontSize: 15, fontWeight: 900, color: '#16A34A' }}>
                      ₱{Number(p.amount).toLocaleString()}
                    </td>
                    <td style={{ padding: '20px 24px' }}>
                      <span style={{ padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: 800, background: '#F3F4F6', color: '#4B5563', textTransform: 'uppercase', border: '1px solid #E5E7EB', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {p.payment_method ?? 'GCASH'} <ArrowUpRight size={12} />
                      </span>
                    </td>
                    <td style={{ padding: '20px 24px' }}>
                      <span style={{ fontSize: 12, color: '#6B7280', fontFamily: 'monospace', background: '#F9FAFB', padding: '4px 8px', borderRadius: 6, border: '1px solid #F3F4F6' }}>
                        {p.payment_reference ?? '—'}
                      </span>
                    </td>
                    <td style={{ padding: '20px 24px', fontSize: 13, color: '#6B7280', textAlign: 'right', fontWeight: 500 }}>
                      {p.confirmed_at ? new Date(p.confirmed_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}