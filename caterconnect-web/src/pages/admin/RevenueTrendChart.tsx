import { useMemo } from 'react';

type RevenuePayment = { amount: number | string | null; confirmed_at?: string | null };
type Props = { payments: RevenuePayment[]; loading?: boolean; title?: string; totalRevenue: number };
const php = (n: number) => `₱${n.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;
const dayKey = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

/** Presentational chart: only confirmed subscription payments from callers. */
export default function RevenueTrendChart({ payments, loading = false, title = 'Revenue Overview', totalRevenue }: Props) {
  const days = useMemo(() => {
    const today = new Date();
    const list = Array.from({ length: 7 }, (_, idx) => {
      const d = new Date(today.getTime() - (6 - idx) * 86_400_000);
      return { key: dayKey(d), label: d.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' }), amount: 0 };
    });
    const byKey = new Map(list.map((d, i) => [d.key, i]));
    payments.forEach((p) => {
      if (!p.confirmed_at) return;
      const date = new Date(p.confirmed_at);
      if (Number.isNaN(date.getTime())) return;
      const index = byKey.get(dayKey(date));
      if (index !== undefined) list[index].amount += Number(p.amount ?? 0) || 0;
    });
    return list;
  }, [payments]);
  const maxValue = Math.max(1, ...days.map((d) => d.amount));
  const upper = maxValue === 1 ? 1 : Math.ceil(maxValue / Math.pow(10, Math.max(0, Math.floor(Math.log10(maxValue)) - 1))) * Math.pow(10, Math.max(0, Math.floor(Math.log10(maxValue)) - 1));
  const point = (value: number, index: number) => ({ x: 67 + index * 91, y: 224 - (value / upper) * 180 });
  const points = days.map((d, i) => point(d.amount, i));
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const area = `${line} L ${points[points.length - 1].x} 224 L ${points[0].x} 224 Z`;
  const periodTotal = days.reduce((sum, d) => sum + d.amount, 0);
  return (
    <div className="cc-revenue-graph" aria-label={`${title}: confirmed subscription revenue for the last seven Philippine calendar days`}>
      <div className="cc-revenue-graph-head">
        <div><h2>{title}</h2><p>Confirmed subscription payments · Last 7 days (Philippine time)</p></div>
        <span className="cc-revenue-period">Last 7 days</span>
      </div>
      <div className="cc-revenue-graph-body">
        <div className="cc-revenue-svg-wrap">
          <svg viewBox="0 0 650 265" role="img" aria-label={days.map(d => `${d.label}: ${php(d.amount)}`).join('; ')} preserveAspectRatio="xMidYMid meet">
            <defs><linearGradient id="cc-revenue-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FB923C" stopOpacity=".27"/><stop offset="100%" stopColor="#FB923C" stopOpacity=".015"/></linearGradient></defs>
            {[0,1,2,3,4].map(i => { const y = 44 + i * 45; const value = upper * (4-i)/4; return <g key={i}><line x1="67" x2="620" y1={y} y2={y} stroke="#E9E6E1" strokeWidth="1"/><text x="58" y={y+4} textAnchor="end" fill="#8B9099" fontSize="12">{php(value)}</text></g>; })}
            <path d={area} fill="url(#cc-revenue-area)"/><path d={line} fill="none" stroke="#F97316" strokeWidth="3.4" strokeLinejoin="round" strokeLinecap="round"/>
            {points.map((p, i) => <g key={i}><circle cx={p.x} cy={p.y} r="5" fill="#F97316" stroke="white" strokeWidth="2.5"><title>{`${days[i].label}: ${php(days[i].amount)}`}</title></circle><text x={p.x} y="248" textAnchor="middle" fill="#64748B" fontSize="12">{days[i].label}</text></g>)}
          </svg>
        </div>
        <div className="cc-revenue-graph-summary">
          <span>Total Revenue</span><strong>{loading ? '—' : php(totalRevenue)}</strong>
          <div className="cc-revenue-graph-divider" />
          <span>Last 7 days</span><b>{loading ? '—' : php(periodTotal)}</b>
          <small>Based on recorded confirmation dates, not estimated revenue.</small>
        </div>
      </div>
    </div>
  );
}
