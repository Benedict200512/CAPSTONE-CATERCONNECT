import { useEffect, useState } from 'react';
import RevenueTrendChart from './RevenueTrendChart';
import './Revenue.css';
import { supabase } from '../../lib/supabase';
import {
  PhilippinePeso,
  Calendar,
  Clock,
  CreditCard,
  ShieldCheck,
  TrendingUp,
  Loader2,
  ArrowUpRight,
  Receipt,
} from 'lucide-react';

type Payment = {
  id: string;
  amount: number | string | null;
  plan_id: string;
  payment_method: string | null;
  payment_reference: string | null;
  confirmed_at: string | null;
  caterers: { business_name: string } | null;
};

type PlanInfo = {
  label: string;
  price: number;
  color: string;
  bg: string;
  border: string;
};

export default function Revenue() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [planCounts, setPlanCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [filterPlan, setFilterPlan] = useState('all');

  useEffect(() => {
    const load = async () => {
      const [paymentsRes, caterersRes] = await Promise.all([
        supabase
          .from('subscription_payments')
          .select('*, caterers(business_name)')
          .eq('status', 'confirmed')
          .order('confirmed_at', { ascending: false }),

        supabase
          .from('caterers')
          .select('subscription_plan')
          .eq('verification_status', 'approved'),
      ]);

      setPayments((paymentsRes.data ?? []) as Payment[]);

      const counts: Record<string, number> = {
        free: 0,
        basic: 0,
        standard: 0,
        premium: 0,
      };

      (caterersRes.data ?? []).forEach((c: any) => {
        counts[c.subscription_plan] =
          (counts[c.subscription_plan] ?? 0) + 1;
      });

      setPlanCounts(counts);
      setLoading(false);
    };

    load();
  }, []);

  const now = Date.now();

  const totalRevenue = payments.reduce(
    (sum, payment) => sum + Number(payment.amount ?? 0),
    0
  );

  const monthRevenue = payments
    .filter(
      (payment) =>
        new Date(payment.confirmed_at ?? '').getTime() >
        now - 30 * 86400000
    )
    .reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);

  const weekRevenue = payments
    .filter(
      (payment) =>
        new Date(payment.confirmed_at ?? '').getTime() >
        now - 7 * 86400000
    )
    .reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);

  const planInfo: Record<string, PlanInfo> = {
    free: {
      label: 'Free',
      price: 0,
      color: '#6B7280',
      bg: '#F3F4F6',
      border: '#E5E7EB',
    },
    basic: {
      label: 'Basic',
      price: 299,
      color: '#C2410C',
      bg: '#FFF7ED',
      border: '#FED7AA',
    },
    standard: {
      label: 'Standard',
      price: 499,
      color: '#D97706',
      bg: '#FEF3C7',
      border: '#FDE68A',
    },
    premium: {
      label: 'Premium',
      price: 999,
      color: '#9A3412',
      bg: '#FFEDD5',
      border: '#FED7AA',
    },
  };

  const displayed =
    filterPlan === 'all'
      ? payments
      : payments.filter((payment) => payment.plan_id === filterPlan);

  const kpis = [
    {
      icon: PhilippinePeso,
      label: 'Total Revenue',
      value: `₱${totalRevenue.toLocaleString()}`,
      color: '#EA580C',
      bg: '#FFF7ED',
      accent: '#F97316',
    },
    {
      icon: Calendar,
      label: 'This Month',
      value: `₱${monthRevenue.toLocaleString()}`,
      color: '#F97316',
      bg: '#FFF7ED',
      accent: '#F97316',
    },
    {
      icon: Clock,
      label: 'This Week',
      value: `₱${weekRevenue.toLocaleString()}`,
      color: '#EA580C',
      bg: '#FFF7ED',
      accent: '#F97316',
    },
    {
      icon: CreditCard,
      label: 'Total Payments',
      value: payments.length.toLocaleString(),
      color: '#EA580C',
      bg: '#FFF7ED',
      accent: '#F97316',
    },
  ];

  const filters = ['all', 'basic', 'standard', 'premium'];

  const formatDate = (date: string | null) => {
    if (!date) return '—';

    return new Date(date).toLocaleDateString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderPlanBadge = (planId: string) => {
    const info = planInfo[planId];

    return (
      <span
        className="revenue-plan-badge"
        style={{
          background: info?.bg ?? '#F3F4F6',
          color: info?.color ?? '#6B7280',
          borderColor: info?.border ?? '#E5E7EB',
        }}
      >
        {info?.label ?? planId}
      </span>
    );
  };

  return (
    <div className="revenue-page">
      <style>{`
        .revenue-page {
          width: 100%;
          min-width: 0;
          padding-bottom: 40px;
          color: #111827;
        }

        .revenue-header {
          margin-bottom: 30px;
        }

        .revenue-header h1 {
          margin: 0 0 6px;
          font-size: 28px;
          line-height: 1.25;
          font-weight: 900;
          letter-spacing: -0.6px;
          color: #111827;
        }

        .revenue-header p {
          margin: 0;
          color: #6B7280;
          font-size: 15px;
          line-height: 1.6;
        }

        .revenue-kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 20px;
          margin-bottom: 30px;
        }

        .revenue-kpi-card {
          position: relative;
          min-width: 0;
          overflow: hidden;
          padding: 23px;
          background: #FFFFFF;
          border: 1px solid #E5E7EB;
          border-radius: 18px;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .revenue-kpi-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 20px -3px rgba(0,0,0,0.08);
        }

        .revenue-kpi-accent {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
        }

        .revenue-kpi-heading {
          display: flex;
          align-items: center;
          gap: 13px;
          margin: 4px 0 18px;
          min-width: 0;
        }

        .revenue-kpi-icon {
          width: 46px;
          height: 46px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 13px;
        }

        .revenue-kpi-label {
          min-width: 0;
          color: #6B7280;
          font-size: 13px;
          font-weight: 700;
        }

        .revenue-kpi-value {
          overflow-wrap: anywhere;
          color: #111827;
          font-size: clamp(22px, 2vw, 31px);
          line-height: 1.2;
          font-weight: 900;
          letter-spacing: -1px;
        }

        .revenue-notice {
          display: flex;
          align-items: center;
          gap: 22px;
          padding: 24px 28px;
          margin-bottom: 34px;
          border: 1px solid #BBF7D0;
          border-radius: 18px;
          background: linear-gradient(to right, #F0FDF4, #DCFCE7);
          box-shadow: 0 4px 6px -1px rgba(22,163,74,0.05);
        }

        .revenue-notice-icon {
          width: 62px;
          height: 62px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #FFFFFF;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
        }

        .revenue-notice h2 {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
          margin: 0 0 6px;
          color: #14532D;
          font-size: 17px;
          font-weight: 900;
        }

        .revenue-notice p {
          max-width: 900px;
          margin: 0;
          color: #166534;
          font-size: 14px;
          line-height: 1.7;
        }

        .revenue-section-title {
          margin: 0 0 16px;
          color: #111827;
          font-size: 20px;
          font-weight: 900;
          letter-spacing: -0.5px;
        }

        .revenue-plan-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 20px;
          margin-bottom: 38px;
        }

        .revenue-plan-card {
          position: relative;
          min-width: 0;
          overflow: hidden;
          padding: 26px 20px;
          text-align: center;
          background: #FFFFFF;
          border: 1px solid #E5E7EB;
          border-radius: 18px;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);
        }

        .revenue-plan-accent {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
        }

        .revenue-plan-name {
          margin-bottom: 12px;
          font-size: 13px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .revenue-plan-count {
          margin-bottom: 12px;
          color: #111827;
          font-size: 38px;
          line-height: 1.2;
          font-weight: 900;
          letter-spacing: -1.5px;
        }

        .revenue-plan-price {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 6px 12px;
          border: 1px solid;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 700;
        }

        .revenue-ledger-heading {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          flex-wrap: wrap;
          gap: 16px;
          margin-bottom: 18px;
        }

        .revenue-ledger-heading h2 {
          margin: 0 0 4px;
          color: #111827;
          font-size: 20px;
          font-weight: 900;
          letter-spacing: -0.5px;
        }

        .revenue-ledger-heading p {
          margin: 0;
          color: #6B7280;
          font-size: 14px;
          line-height: 1.5;
        }

        .revenue-filter-group {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          padding: 5px;
          border: 1px solid #E5E7EB;
          border-radius: 13px;
          background: #F3F4F6;
        }

        .revenue-filter-button {
          padding: 8px 16px;
          border: none;
          border-radius: 9px;
          background: transparent;
          color: #6B7280;
          font-size: 13px;
          font-weight: 700;
          text-transform: capitalize;
          cursor: pointer;
          transition: all 0.2s;
        }

        .revenue-filter-button:hover {
          color: #111827;
        }

        .revenue-filter-button.active {
          background: #FFFFFF;
          color: #111827;
          box-shadow: 0 2px 4px rgba(0,0,0,0.04);
        }

        .revenue-ledger {
          overflow: hidden;
          background: #FFFFFF;
          border: 1px solid #E5E7EB;
          border-radius: 18px;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);
        }

        .revenue-table-wrap {
          width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }

        .revenue-table {
          width: 100%;
          min-width: 900px;
          border-collapse: collapse;
          text-align: left;
        }

        .revenue-table th {
          padding: 16px 20px;
          border-bottom: 1px solid #E5E7EB;
          background: #F9FAFB;
          color: #6B7280;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          white-space: nowrap;
        }

        .revenue-table td {
          padding: 19px 20px;
          border-bottom: 1px solid #F3F4F6;
          color: #374151;
          font-size: 13px;
          vertical-align: middle;
        }

        .revenue-table tbody tr:last-child td {
          border-bottom: none;
        }

        .revenue-table tbody tr {
          transition: background 0.2s ease;
        }

        .revenue-table tbody tr:hover {
          background: #F9FAFB;
        }

        .revenue-plan-badge {
          display: inline-flex;
          align-items: center;
          padding: 6px 11px;
          border: 1px solid;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
        }

        .revenue-method-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 6px 9px;
          border: 1px solid #E5E7EB;
          border-radius: 8px;
          background: #F3F4F6;
          color: #4B5563;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .revenue-reference {
          display: inline-block;
          max-width: 190px;
          overflow-wrap: anywhere;
          padding: 4px 8px;
          border: 1px solid #F3F4F6;
          border-radius: 6px;
          background: #F9FAFB;
          color: #6B7280;
          font-family: monospace;
          font-size: 11px;
        }

        .revenue-mobile-list {
          display: none;
        }

        .revenue-payment-card {
          padding: 17px;
          border-bottom: 1px solid #F3F4F6;
        }

        .revenue-payment-card:last-child {
          border-bottom: none;
        }

        .revenue-payment-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 14px;
        }

        .revenue-payment-name {
          min-width: 0;
          color: #111827;
          font-size: 14px;
          font-weight: 800;
          overflow-wrap: anywhere;
        }

        .revenue-payment-amount {
          flex-shrink: 0;
          color: #16A34A;
          font-size: 17px;
          font-weight: 900;
          white-space: nowrap;
        }

        .revenue-payment-details {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 13px;
        }

        .revenue-payment-detail {
          min-width: 0;
        }

        .revenue-payment-detail label {
          display: block;
          margin-bottom: 5px;
          color: #9CA3AF;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }

        .revenue-payment-detail span {
          display: block;
          color: #4B5563;
          font-size: 12px;
          overflow-wrap: anywhere;
        }

        .revenue-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 15px;
          padding: 65px 20px;
          text-align: center;
          color: #9CA3AF;
        }

        .revenue-empty-icon {
          width: 68px;
          height: 68px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #E5E7EB;
          border-radius: 50%;
          background: #F9FAFB;
        }

        .revenue-empty-state h3 {
          margin: 0 0 5px;
          color: #111827;
          font-size: 17px;
          font-weight: 800;
        }

        .revenue-empty-state p {
          margin: 0;
          color: #6B7280;
          font-size: 13px;
          line-height: 1.5;
        }

        .revenue-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 15px;
          padding: 65px 20px;
          color: #9CA3AF;
          text-align: center;
          font-size: 14px;
          font-weight: 600;
        }

        @media (max-width: 1200px) {
          .revenue-kpi-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .revenue-plan-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 768px) {
          .revenue-page {
            padding-bottom: 28px;
          }

          .revenue-header {
            margin-bottom: 22px;
          }

          .revenue-header h1 {
            font-size: 24px;
          }

          .revenue-header p {
            font-size: 13px;
          }

          .revenue-kpi-grid {
            gap: 13px;
            margin-bottom: 22px;
          }

          .revenue-kpi-card {
            padding: 18px;
            border-radius: 15px;
          }

          .revenue-kpi-heading {
            gap: 10px;
            margin-bottom: 13px;
          }

          .revenue-kpi-icon {
            width: 40px;
            height: 40px;
            border-radius: 11px;
          }

          .revenue-kpi-icon svg {
            width: 21px;
            height: 21px;
          }

          .revenue-kpi-label {
            font-size: 12px;
          }

          .revenue-kpi-value {
            font-size: 25px;
          }

          .revenue-notice {
            align-items: flex-start;
            gap: 14px;
            padding: 19px;
            margin-bottom: 28px;
            border-radius: 15px;
          }

          .revenue-notice-icon {
            width: 46px;
            height: 46px;
          }

          .revenue-notice-icon svg {
            width: 24px;
            height: 24px;
          }

          .revenue-notice h2 {
            font-size: 15px;
          }

          .revenue-notice p {
            font-size: 12px;
          }

          .revenue-plan-grid {
            gap: 13px;
            margin-bottom: 30px;
          }

          .revenue-plan-card {
            padding: 22px 14px;
            border-radius: 15px;
          }

          .revenue-plan-count {
            font-size: 33px;
          }

          .revenue-ledger-heading {
            align-items: flex-start;
            flex-direction: column;
            gap: 13px;
          }

          .revenue-ledger-heading h2,
          .revenue-section-title {
            font-size: 18px;
          }

          .revenue-ledger-heading p {
            font-size: 12px;
          }

          .revenue-filter-group {
            width: 100%;
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }

          .revenue-filter-button {
            padding: 9px 5px;
            font-size: 12px;
          }
        }

        @media (max-width: 560px) {
          .revenue-kpi-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .revenue-kpi-card {
            padding: 15px;
          }

          .revenue-kpi-heading {
            align-items: flex-start;
            flex-direction: column;
            gap: 9px;
          }

          .revenue-kpi-value {
            font-size: 22px;
          }

          .revenue-notice {
            flex-direction: column;
          }

          .revenue-notice h2 {
            font-size: 14px;
          }

          .revenue-plan-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .revenue-table-wrap {
            display: none;
          }

          .revenue-mobile-list {
            display: block;
          }

          .revenue-payment-details {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .revenue-ledger {
            border-radius: 15px;
          }
        }

        @media (max-width: 360px) {
          .revenue-header h1 {
            font-size: 21px;
          }

          .revenue-kpi-card {
            padding: 12px;
          }

          .revenue-kpi-value {
            font-size: 19px;
          }

          .revenue-filter-button {
            font-size: 11px;
          }

          .revenue-payment-card {
            padding: 14px;
          }

          .revenue-payment-amount {
            font-size: 15px;
          }
        }
      `}</style>

      {/* Header */}
      <div className="revenue-header">
        <h1>Revenue & Subscriptions</h1>
        <p>
          Monitor subscription cash flow and platform tier distribution.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="revenue-kpi-grid">
        {kpis.map((card) => {
          const Icon = card.icon;

          return (
            <div className="revenue-kpi-card" key={card.label}>
              <div
                className="revenue-kpi-accent"
                style={{ background: card.accent }}
              />

              <div className="revenue-kpi-heading">
                <div
                  className="revenue-kpi-icon"
                  style={{ background: card.bg }}
                >
                  <Icon size={23} color={card.color} />
                </div>

                <div className="revenue-kpi-label">{card.label}</div>
              </div>

              <div className="revenue-kpi-value">
                {loading ? (
                  <Loader2
                    size={24}
                    className="animate-spin"
                    color="#9CA3AF"
                  />
                ) : (
                  card.value
                )}
              </div>
            </div>
          );
        })}
      </div>

      <section className="cc-revenue-page-chart" aria-label="Revenue trend"><RevenueTrendChart payments={payments} loading={loading} totalRevenue={totalRevenue}/></section>

      {/* Zero Commission Notice */}
      <div className="revenue-notice">
        <div className="revenue-notice-icon">
          <TrendingUp size={30} color="#16A34A" />
        </div>

        <div>
          <h2>
            Fair-Trade Zero Commission Model
            <ShieldCheck size={19} color="#16A34A" />
          </h2>

          <p>
            CaterConnect operates on a strict zero-commission policy for
            event bookings. Independent caterers retain 100% of their
            earnings. Platform sustainability is driven entirely by our
            fixed, transparent monthly infrastructure plans.
          </p>
        </div>
      </div>

      {/* Tier Distribution */}
      <h2 className="revenue-section-title">Tier Distribution</h2>

      <div className="revenue-plan-grid">
        {Object.entries(planInfo).map(([key, info]) => (
          <div className="revenue-plan-card" key={key}>
            <div
              className="revenue-plan-accent"
              style={{ background: info.color }}
            />

            <div
              className="revenue-plan-name"
              style={{ color: info.color }}
            >
              {info.label} Plan
            </div>

            <div className="revenue-plan-count">
              {loading ? (
                <Loader2
                  size={27}
                  className="animate-spin"
                  color="#9CA3AF"
                  style={{ margin: 'auto' }}
                />
              ) : (
                planCounts[key] ?? 0
              )}
            </div>

            <div
              className="revenue-plan-price"
              style={{
                background: info.bg,
                color: info.color,
                borderColor: info.border,
              }}
            >
              {info.price === 0 ? 'Free Entry' : `₱${info.price} / mo`}
            </div>
          </div>
        ))}
      </div>

      {/* Payment Ledger Heading and Filters */}
      <div className="revenue-ledger-heading">
        <div>
          <h2>Payment Ledger</h2>
          <p>
            A complete chronological history of all confirmed transactions.
          </p>
        </div>

        <div className="revenue-filter-group">
          {filters.map((plan) => (
            <button
              key={plan}
              type="button"
              onClick={() => setFilterPlan(plan)}
              className={`revenue-filter-button ${
                filterPlan === plan ? 'active' : ''
              }`}
            >
              {plan}
            </button>
          ))}
        </div>
      </div>

      {/* Payment Ledger */}
      <div className="revenue-ledger">
        {loading ? (
          <div className="revenue-loading">
            <Loader2
              size={34}
              color="#16A34A"
              className="animate-spin"
            />
            <div>Loading transaction ledger...</div>
          </div>
        ) : displayed.length === 0 ? (
          <div className="revenue-empty-state">
            <div className="revenue-empty-icon">
              <Receipt size={30} color="#D1D5DB" />
            </div>

            <div>
              <h3>No transactions found</h3>
              <p>
                No confirmed payments match the current filter criteria.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop and Tablet Table */}
            <div className="revenue-table-wrap">
              <table className="revenue-table">
                <thead>
                  <tr>
                    <th>Caterer Entity</th>
                    <th>Sub Plan</th>
                    <th>Amount Paid</th>
                    <th>Gateway</th>
                    <th>Reference ID</th>
                    <th style={{ textAlign: 'right' }}>Timestamp</th>
                  </tr>
                </thead>

                <tbody>
                  {displayed.map((payment) => (
                    <tr key={payment.id}>
                      <td>
                        <strong style={{ color: '#111827' }}>
                          {payment.caterers?.business_name ?? '—'}
                        </strong>
                      </td>

                      <td>{renderPlanBadge(payment.plan_id)}</td>

                      <td>
                        <strong
                          style={{
                            color: '#16A34A',
                            fontSize: 14,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          ₱{Number(payment.amount ?? 0).toLocaleString()}
                        </strong>
                      </td>

                      <td>
                        <span className="revenue-method-badge">
                          {payment.payment_method ?? 'GCASH'}
                          <ArrowUpRight size={12} />
                        </span>
                      </td>

                      <td>
                        <span className="revenue-reference">
                          {payment.payment_reference ?? '—'}
                        </span>
                      </td>

                      <td
                        style={{
                          textAlign: 'right',
                          color: '#6B7280',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {formatDate(payment.confirmed_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Transaction Cards */}
            <div className="revenue-mobile-list">
              {displayed.map((payment) => (
                <div className="revenue-payment-card" key={payment.id}>
                  <div className="revenue-payment-top">
                    <div className="revenue-payment-name">
                      {payment.caterers?.business_name ?? '—'}
                      <div style={{ marginTop: 8 }}>
                        {renderPlanBadge(payment.plan_id)}
                      </div>
                    </div>

                    <div className="revenue-payment-amount">
                      ₱{Number(payment.amount ?? 0).toLocaleString()}
                    </div>
                  </div>

                  <div className="revenue-payment-details">
                    <div className="revenue-payment-detail">
                      <label>Payment Method</label>
                      <span>
                        {payment.payment_method ?? 'GCASH'}
                      </span>
                    </div>

                    <div className="revenue-payment-detail">
                      <label>Reference ID</label>
                      <span>
                        {payment.payment_reference ?? '—'}
                      </span>
                    </div>

                    <div className="revenue-payment-detail">
                      <label>Confirmed Date</label>
                      <span>{formatDate(payment.confirmed_at)}</span>
                    </div>

                    <div className="revenue-payment-detail">
                      <label>Transaction Status</label>
                      <span style={{ color: '#16A34A', fontWeight: 700 }}>
                        Confirmed
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
