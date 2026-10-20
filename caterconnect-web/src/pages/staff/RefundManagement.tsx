import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Wallet, Receipt, MessageSquareWarning, RefreshCw, Search, Eye,
  X, Clock, CheckCircle2, AlertTriangle, ExternalLink, Building2, User,
  Layers, AlertCircle, HelpCircle, Check, Send, ShieldCheck, XCircle
} from 'lucide-react';

type Section = 'submissions' | 'disputes' | 'refunds';
type RefundStatus = 'none' | 'pending' | 'processed' | 'failed';
type DisputeStatus = 'open' | 'investigating' | 'resolved';

type Booking = {
  id: string;
  customer_id: string;
  caterer_id: string;
  event_date: string | null;
  refund_status: RefundStatus;
  refund_amount: number | null;
  refund_account_details: string | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  refunded_at: string | null;
};
type Submission = {
  id: string;
  booking_id: string;
  caterer_id: string;
  transfer_reference: string | null;
  proof_path: string | null;
  status: string;
  submitted_at: string;
  review_note: string | null;
};
type Dispute = {
  id: string;
  booking_id: string;
  customer_id: string;
  reason: string;
  status: DisputeStatus;
  created_at: string;
  resolved_at: string | null;
  caterer_response?: string | null;
  caterer_responded_at?: string | null;
  staff_note?: string | null;
  staff_reviewed_at?: string | null;
};
type Profile = { id: string; full_name: string | null; email: string | null };
type Caterer = { id: string; business_name: string | null; account_standing: string | null };

const money = (n: number | null | undefined) =>
  `₱${Number(n ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = (s: string | null | undefined) => s ? new Date(s).toLocaleString('en-PH') : '—';
const destination = (raw: string | null | undefined) => {
  if (!raw) return 'Not provided';
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v !== 'object' || Array.isArray(v)) return raw;
    return [
      v.method || v.payment_method || v.refund_method,
      v.bank_name,
      v.account_holder || v.account_holder_name || v.account_name || v.name,
      v.account_number || v.mobile_number || v.gcash_number || v.number
    ].filter(Boolean).join(' · ') || raw;
  } catch { return raw; }
};

const getStatusIcon = (status: string, isActive: boolean = false) => {
  const colors: Record<string, string> = {
    all: '#2563EB',
    submitted: '#0284C7',
    verified: '#16A34A',
    rejected: '#DC2626',
    open: '#D97706',
    investigating: '#7C3AED',
    resolved: '#15803D',
    pending: '#D97706',
    processed: '#16A34A',
    failed: '#DC2626'
  };
  const color = isActive ? '#FFFFFF' : (colors[status.toLowerCase()] || '#6B7280');
  
  switch (status.toLowerCase()) {
    case 'all': return <Layers size={13} color={color} style={{ verticalAlign: 'middle', marginRight: 5 }} />;
    case 'submitted': return <Send size={13} color={color} style={{ verticalAlign: 'middle', marginRight: 5 }} />;
    case 'verified': return <ShieldCheck size={13} color={color} style={{ verticalAlign: 'middle', marginRight: 5 }} />;
    case 'rejected': return <XCircle size={13} color={color} style={{ verticalAlign: 'middle', marginRight: 5 }} />;
    case 'open': return <AlertCircle size={13} color={color} style={{ verticalAlign: 'middle', marginRight: 5 }} />;
    case 'investigating': return <HelpCircle size={13} color={color} style={{ verticalAlign: 'middle', marginRight: 5 }} />;
    case 'resolved': return <Check size={13} color={color} style={{ verticalAlign: 'middle', marginRight: 5 }} />;
    case 'pending': return <Clock size={13} color={color} style={{ verticalAlign: 'middle', marginRight: 5 }} />;
    case 'processed': return <CheckCircle2 size={13} color={color} style={{ verticalAlign: 'middle', marginRight: 5 }} />;
    case 'failed': return <XCircle size={13} color={color} style={{ verticalAlign: 'middle', marginRight: 5 }} />;
    default: return <Layers size={13} color={color} style={{ verticalAlign: 'middle', marginRight: 5 }} />;
  }
};

const panel: React.CSSProperties = {
  background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 20, padding: 24, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)'
};
const button: React.CSSProperties = {
  background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12,
  padding: '10px 18px', cursor: 'pointer', fontWeight: 800, fontSize: 13, color: '#4B5563', boxShadow: '0 1px 2px rgba(0,0,0,0.02)', display: 'inline-flex', alignItems: 'center', transition: 'all 0.2s'
};
const muted: React.CSSProperties = { color: '#6B7280', fontSize: 13, fontWeight: 500 };
const chip = (status: string): React.CSSProperties => {
  const green = ['processed', 'resolved', 'verified'].includes(status);
  const red = ['failed', 'rejected'].includes(status);
  return {
    display: 'inline-flex', alignItems: 'center', borderRadius: 20, padding: '4px 12px',
    background: green ? '#DCFCE7' : red ? '#FEE2E2' : '#FEF3C7',
    color: green ? '#166534' : red ? '#991B1B' : '#92400E',
    fontSize: 11.5, fontWeight: 800, textTransform: 'uppercase'
  };
};

export default function RefundManagement() {
  const [section, setSection] = useState<Section>('submissions');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [caterers, setCaterers] = useState<Record<string, Caterer>>({});
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<{ type: Section; bookingId: string } | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [receiptError, setReceiptError] = useState('');
  const [receiptLoading, setReceiptLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const issues: string[] = [];
    try {
      const [b, s, d] = await Promise.all([
        supabase.from('bookings')
          .select('id, customer_id, caterer_id, event_date, refund_status, refund_amount, refund_account_details, cancellation_reason, cancelled_at, refunded_at')
          .neq('refund_status', 'none').order('cancelled_at', { ascending: false }),
        supabase.from('refund_transfer_submissions')
          .select('id, booking_id, caterer_id, transfer_reference, proof_path, status, submitted_at, review_note')
          .order('submitted_at', { ascending: false }),
        supabase.from('refund_disputes')
          .select('*').order('created_at', { ascending: false })
      ]);

      if (b.error) issues.push(`Refund bookings: ${b.error.message}`);
      else setBookings((b.data ?? []) as Booking[]);
      if (s.error) issues.push(`Refund submissions: ${s.error.message}`);
      else setSubmissions((s.data ?? []) as Submission[]);
      if (d.error) issues.push(`Refund disputes: ${d.error.message}`);
      else setDisputes((d.data ?? []) as Dispute[]);

      const visibleBookings = (b.data ?? []) as Booking[];
      const visibleSubmissions = (s.data ?? []) as Submission[];
      const visibleDisputes = (d.data ?? []) as Dispute[];
      const customerIds = [...new Set([
        ...visibleBookings.map(x => x.customer_id),
        ...visibleDisputes.map(x => x.customer_id)
      ].filter(Boolean))];
      const catererIds = [...new Set([
        ...visibleBookings.map(x => x.caterer_id),
        ...visibleSubmissions.map(x => x.caterer_id)
      ].filter(Boolean))];

      const [p, c] = await Promise.all([
        customerIds.length
          ? supabase.from('profiles').select('id, full_name, email').in('id', customerIds)
          : Promise.resolve({ data: [], error: null }),
        catererIds.length
          ? supabase.from('caterers').select('id, business_name, account_standing').in('id', catererIds)
          : Promise.resolve({ data: [], error: null })
      ]);
      if (p.error) issues.push(`Customer names: ${p.error.message}`);
      else setProfiles(Object.fromEntries(((p.data ?? []) as Profile[]).map(x => [x.id, x])));
      if (c.error) issues.push(`Caterer names: ${c.error.message}`);
      else setCaterers(Object.fromEntries(((c.data ?? []) as Caterer[]).map(x => [x.id, x])));
    } catch (e: any) {
      issues.push(e?.message || 'Unexpected loading error');
    } finally {
      setErrors(issues);
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const bookingMap = useMemo(() => Object.fromEntries(bookings.map(x => [x.id, x])), [bookings]);
  const submissionMap = useMemo(() => Object.fromEntries(submissions.map(x => [x.booking_id, x])), [submissions]);
  const disputeMap = useMemo(() => Object.fromEntries(disputes.map(x => [x.booking_id, x])), [disputes]);

  const name = (b?: Booking) => b ? profiles[b.customer_id]?.full_name || 'Customer' : 'Booking unavailable';
  const vendor = (b?: Booking, catererId?: string) =>
    caterers[b?.caterer_id || catererId || '']?.business_name || 'Caterer';
  const matches = (values: (string | null | undefined)[]) =>
    !search.trim() || values.some(x => String(x ?? '').toLowerCase().includes(search.trim().toLowerCase()));

  const filteredSubmissions = submissions.filter(x => {
    const b = bookingMap[x.booking_id];
    return (filter === 'all' || x.status === filter) &&
      matches([x.booking_id, x.transfer_reference, name(b), vendor(b, x.caterer_id)]);
  });
  const filteredDisputes = disputes.filter(x => {
    const b = bookingMap[x.booking_id];
    return (filter === 'all' || x.status === filter) &&
      matches([x.booking_id, x.reason, x.caterer_response, name(b), vendor(b)]);
  });
  const filteredBookings = bookings.filter(x =>
    (filter === 'all' || x.refund_status === filter) &&
    matches([x.id, name(x), vendor(x), destination(x.refund_account_details)])
  );

  const openDetails = async (type: Section, bookingId: string) => {
    if (selected?.type === type && selected.bookingId === bookingId) {
      setSelected(null);
      setReceiptUrl(null);
      return;
    }
    setSelected({ type, bookingId });
    setReceiptUrl(null);
    setReceiptError('');
    const proof = submissionMap[bookingId];
    if (!proof?.proof_path) return;
    setReceiptLoading(true);
    const { data, error } = await supabase.storage.from('refund-proofs')
      .createSignedUrl(proof.proof_path, 600);
    setReceiptLoading(false);
    if (error) setReceiptError(error.message);
    else setReceiptUrl(data?.signedUrl || null);
  };

  const changeSection = (next: Section) => {
    setSection(next);
    setFilter('all');
    setSearch('');
    setSelected(null);
    setReceiptUrl(null);
  };

  const statusOptions = section === 'submissions'
    ? ['all', 'submitted', 'verified', 'rejected']
    : section === 'disputes'
      ? ['all', 'open', 'investigating', 'resolved']
      : ['all', 'pending', 'processed', 'failed'];

  const currentBooking = selected ? bookingMap[selected.bookingId] : undefined;
  const currentSubmission = selected ? submissionMap[selected.bookingId] : undefined;
  const currentDispute = selected ? disputeMap[selected.bookingId] : undefined;
  const pendingAmount = bookings.filter(x => x.refund_status === 'pending')
    .reduce((sum, x) => sum + Number(x.refund_amount || 0), 0);
  const processedAmount = bookings.filter(x => x.refund_status === 'processed')
    .reduce((sum, x) => sum + Number(x.refund_amount || 0), 0);

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", paddingBottom: 40, color: '#111827' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#111', marginBottom: 6, letterSpacing: '-0.5px' }}>Refund Monitoring</h1>
          <p style={{ fontSize: 15, color: '#6B7280', margin: 0 }}>
            Track refund transfers, customer reports, and refund progress.
          </p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} style={button}>
          <RefreshCw size={16} style={{ verticalAlign: 'middle', marginRight: 7 }} />
          {loading ? 'Refreshing...' : 'Refresh all'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, background: '#F3F4F6', padding: 6, borderRadius: 14, border: '1px solid #E5E7EB', width: 'fit-content', flexWrap: 'wrap' }}>
        {([
          ['submissions', Receipt, 'Refund Submissions', submissions.length, '#2563EB'],
          ['disputes', MessageSquareWarning, 'Refund Disputes', disputes.length, '#D97706'],
          ['refunds', Wallet, 'Refund Tracking', bookings.length, '#16A34A']
        ] as const).map(([key, Icon, title, count, color]) => {
          const isActive = section === key;
          return (
            <button key={key} type="button" onClick={() => changeSection(key)}
              style={{
                padding: '10px 20px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s',
                background: isActive ? '#FFFFFF' : 'transparent',
                color: isActive ? '#111' : '#6B7280',
                boxShadow: isActive ? '0 2px 4px rgba(0,0,0,0.04)' : 'none'
              }}>
              <div style={{ width: 26, height: 26, borderRadius: 8, background: isActive ? `${color}15` : '#E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={15} color={isActive ? color : '#6B7280'} />
              </div>
              {title} ({count})
            </button>
          );
        })}
      </div>

      {errors.length > 0 && (
        <div style={{ ...panel, background: '#FEF2F2', borderColor: '#FECACA', marginBottom: 24 }}>
          <strong style={{ color: '#991B1B', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}><AlertTriangle size={16} /> Unable to load some records</strong>
          {errors.map((e, i) => <p key={i} style={{ color: '#991B1B', fontSize: 13, marginBottom: 4 }}>{e}</p>)}
          <p style={{ ...muted, marginTop: 6, marginBottom: 0 }}>Some records could not be loaded. Please contact the system administrator if the problem persists.</p>
        </div>
      )}

      {section === 'refunds' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 28 }}>
          <div style={{ ...panel, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={24} />
            </div>
            <div>
              <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Pending customer confirmation</span>
              <span style={{ fontSize: 22, fontWeight: 900, color: '#111' }}>{money(pendingAmount)}</span>
            </div>
          </div>
          <div style={{ ...panel, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: '#F0FDF4', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={24} />
            </div>
            <div>
              <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Customer-confirmed refunds</span>
              <span style={{ fontSize: 22, fontWeight: 900, color: '#111' }}>{money(processedAmount)}</span>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        {statusOptions.map(x => {
          const count = section === 'submissions'
            ? submissions.filter(y => x === 'all' || y.status === x).length
            : section === 'disputes'
              ? disputes.filter(y => x === 'all' || y.status === x).length
              : bookings.filter(y => x === 'all' || y.refund_status === x).length;
          const isFilterActive = filter === x;
          return (
            <button key={x} type="button" onClick={() => { setFilter(x); setSelected(null); }}
              style={{
                padding: '8px 16px', borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s',
                background: isFilterActive ? '#111' : '#FFFFFF',
                color: isFilterActive ? '#FFF' : '#4B5563',
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                display: 'inline-flex', alignItems: 'center'
              }}>
              {getStatusIcon(x, isFilterActive)}
              {x === 'all' ? 'All' : x[0].toUpperCase() + x.slice(1)} ({count})
            </button>
          );
        })}
      </div>

      <div style={{ position: 'relative', marginBottom: 24, maxWidth: 420 }}>
        <Search size={18} color="#9CA3AF" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search customer, Caterer, reference, complaint or booking ID..."
          style={{ width: '100%', boxSizing: 'border-box', padding: '12px 16px 12px 44px',
            borderRadius: 14, border: '1px solid #E5E7EB', outline: 'none', fontSize: 14, background: '#FFF', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }} />
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        {loading && <div style={{ ...panel, textAlign: 'center', color: '#9CA3AF', fontWeight: 600 }}>Loading current records...</div>}

        {!loading && section === 'submissions' && filteredSubmissions.map(s => {
          const b = bookingMap[s.booking_id];
          return (
            <div key={s.id} style={panel}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#111', marginBottom: 4 }}>{vendor(b, s.caterer_id)} → {name(b)}</div>
                  <p style={{ ...muted, margin: '4px 0 8px' }}>
                    {money(b?.refund_amount)} · Submitted {date(s.submitted_at)}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={chip(s.status)}>{getStatusIcon(s.status, false)}{s.status}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#6B7280' }}>Refund: {b?.refund_status || 'Booking unavailable'}</span>
                  </div>
                  <p style={{ ...muted, margin: '8px 0 0', fontFamily: 'monospace' }}>Reference: {s.transfer_reference || 'Not provided'}</p>
                </div>
                <button type="button" style={button} onClick={() => void openDetails('submissions', s.booking_id)}>
                  <Eye size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} /> View evidence
                </button>
              </div>
            </div>
          );
        })}

        {!loading && section === 'disputes' && filteredDisputes.map(d => {
          const b = bookingMap[d.booking_id];
          return (
            <div key={d.id} style={panel}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#111', marginBottom: 4 }}>{name(b)} · {vendor(b)}</div>
                  <p style={{ ...muted, margin: '4px 0 8px' }}>{money(b?.refund_amount)} · Reported {date(d.created_at)}</p>
                  <div style={{ marginBottom: 10 }}><span style={chip(d.status)}>{getStatusIcon(d.status, false)}{d.status}</span></div>
                  <p style={{ fontSize: 14, color: '#374151', whiteSpace: 'pre-wrap', background: '#F9FAFB', padding: 12, borderRadius: 10, border: '1px solid #E5E7EB', margin: 0 }}>{d.reason}</p>
                </div>
                <button type="button" style={button} onClick={() => void openDetails('disputes', d.booking_id)}>
                  <Eye size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} /> View dispute
                </button>
              </div>
            </div>
          );
        })}

        {!loading && section === 'refunds' && filteredBookings.map(b => (
          <div key={b.id} style={panel}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#111', marginBottom: 4 }}>{name(b)} · {vendor(b)}</div>
                <p style={{ ...muted, margin: '4px 0 8px' }}>Refund amount: {money(b.refund_amount)} · Cancelled {date(b.cancelled_at)}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span style={chip(b.refund_status)}>{getStatusIcon(b.refund_status, false)}{b.refund_status}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#6B7280' }}>
                    Evidence: {submissionMap[b.id] ? 'Submitted' : 'Not submitted'} · Dispute: {disputeMap[b.id]?.status || 'None'}
                  </span>
                </div>
              </div>
              <button type="button" style={button} onClick={() => void openDetails('refunds', b.id)}>
                <Eye size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} /> View tracking
              </button>
            </div>
          </div>
        ))}

        {!loading && (
          (section === 'submissions' && filteredSubmissions.length === 0) ||
          (section === 'disputes' && filteredDisputes.length === 0) ||
          (section === 'refunds' && filteredBookings.length === 0)
        ) && (
          <div style={{ ...panel, textAlign: 'center', padding: 60, color: '#6B7280' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#111', marginBottom: 6 }}>No matching records visible</div>
            <p style={{ ...muted, margin: 0 }}>Try selecting All, clearing the search, or refreshing the records.</p>
          </div>
        )}
      </div>

      {selected && (
        <div style={{ ...panel, marginTop: 28, borderLeft: '4px solid #F97316' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #E5E7EB' }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 900, color: '#111', margin: '0 0 4px' }}>Refund activity details</h2>
              <p style={{ fontSize: 12, color: '#9CA3AF', fontFamily: 'monospace', margin: 0 }}>Booking ID: {selected.bookingId}</p>
            </div>
            <button type="button" style={button} onClick={() => { setSelected(null); setReceiptUrl(null); }}><X size={16} /></button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16, marginBottom: 20 }}>
            <div style={{ background: '#F9FAFB', borderRadius: 16, padding: '16px 18px', border: '1px solid #E5E7EB', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <User size={20} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Customer Info</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#111' }}>{name(currentBooking)}</div>
                <div style={{ fontSize: 12.5, color: '#6B7280', marginTop: 2 }}>{currentBooking ? profiles[currentBooking.customer_id]?.email || '—' : 'Booking not visible to Staff'}</div>
              </div>
            </div>

            <div style={{ background: '#F9FAFB', borderRadius: 16, padding: '16px 18px', border: '1px solid #E5E7EB', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: '#F5F3FF', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Building2 size={20} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Caterer Partner</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#111' }}>{vendor(currentBooking, currentSubmission?.caterer_id)}</div>
                <div style={{ fontSize: 12.5, color: '#6B7280', marginTop: 2 }}>Account standing: {caterers[currentBooking?.caterer_id || currentSubmission?.caterer_id || '']?.account_standing || 'Unknown'}</div>
              </div>
            </div>

            <div style={{ background: '#F9FAFB', borderRadius: 16, padding: '16px 18px', border: '1px solid #E5E7EB', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: '#F0FDF4', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Wallet size={20} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Refund Overview</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#111', marginTop: 2 }}>{money(currentBooking?.refund_amount)}</div>
                <div style={{ marginTop: 6 }}><span style={chip(currentBooking?.refund_status || 'unknown')}>{getStatusIcon(currentBooking?.refund_status || 'unknown', false)}{currentBooking?.refund_status || 'Unknown'}</span></div>
              </div>
            </div>
          </div>

          <div style={{ background: '#F9FAFB', borderRadius: 16, padding: 20, border: '1px solid #E5E7EB', marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', marginBottom: 6 }}>Customer refund destination</div>
            <p style={{ fontSize: 14, color: '#111', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: '0 0 16px', fontFamily: 'monospace' }}>{destination(currentBooking?.refund_account_details)}</p>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', marginBottom: 6 }}>Cancellation reason</div>
            <p style={{ fontSize: 14, color: '#374151', whiteSpace: 'pre-wrap', margin: '0 0 16px' }}>{currentBooking?.cancellation_reason || 'Not provided'}</p>
            <p style={{ ...muted, margin: 0 }}>Customer receipt confirmation / processed at: {date(currentBooking?.refunded_at)}</p>
          </div>

          <div style={{ background: '#F9FAFB', borderRadius: 16, padding: 20, border: '1px solid #E5E7EB', marginBottom: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#111', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#FFF7ED', color: '#F97316', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Receipt size={16} />
              </div>
              Caterer transfer submission
            </div>
            {currentSubmission ? (
              <>
                <p style={{ fontSize: 14, margin: '0 0 6px' }}>Transfer reference: <code style={{ background: '#E5E7EB', padding: '2px 6px', borderRadius: 6, fontWeight: 700 }}>{currentSubmission.transfer_reference || 'Not provided'}</code></p>
                <p style={{ ...muted, margin: '0 0 10px' }}>Submitted: {date(currentSubmission.submitted_at)}</p>
                <div style={{ marginBottom: 12 }}><span style={chip(currentSubmission.status)}>{getStatusIcon(currentSubmission.status, false)}{currentSubmission.status}</span></div>
                {currentSubmission.review_note && <p style={{ fontSize: 13.5, color: '#374151' }}>Existing review note: {currentSubmission.review_note}</p>}
                {receiptLoading && <p style={muted}>Loading private receipt...</p>}
                {receiptError && <p style={{ color: '#B91C1C', fontSize: 13 }}>Receipt access error: {receiptError}</p>}
                {receiptUrl && (
                  <div style={{ marginTop: 12 }}>
                    <a href={receiptUrl} target="_blank" rel="noopener noreferrer"
                      style={{ color: '#2563EB', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5 }}>
                      <ExternalLink size={15} /> Open receipt (10-minute signed URL)
                    </a>
                    <div><img src={receiptUrl} alt="Caterer transfer evidence" style={{
                      maxWidth: '100%', maxHeight: 420, objectFit: 'contain', marginTop: 12,
                      border: '1px solid #E5E7EB', borderRadius: 10
                    }} /></div>
                  </div>
                )}
                {!receiptLoading && !receiptUrl && !receiptError &&
                  <p style={muted}>No receipt image available.</p>}
              </>
            ) : <p style={muted}>The Caterer has not submitted transfer evidence yet.</p>}
          </div>

          <div style={{ background: '#F9FAFB', borderRadius: 16, padding: 20, border: '1px solid #E5E7EB' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#111', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#FEF2F2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MessageSquareWarning size={16} />
              </div>
              Customer refund dispute
            </div>
            {currentDispute ? (
              <>
                <div style={{ marginBottom: 10 }}><span style={chip(currentDispute.status)}>{getStatusIcon(currentDispute.status, false)}{currentDispute.status}</span></div>
                <p style={{ ...muted, margin: '0 0 12px' }}>Reported: {date(currentDispute.created_at)} · Resolved: {date(currentDispute.resolved_at)}</p>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', marginBottom: 4 }}>Customer report</div>
                <p style={{ fontSize: 14, color: '#374151', whiteSpace: 'pre-wrap', margin: '0 0 14px' }}>{currentDispute.reason}</p>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', marginBottom: 4 }}>Caterer response</div>
                <p style={{ fontSize: 14, color: '#374151', whiteSpace: 'pre-wrap', margin: '0 0 10px' }}>{currentDispute.caterer_response || 'No response yet.'}</p>
                <p style={{ ...muted, margin: '0 0 14px' }}>Caterer responded: {date(currentDispute.caterer_responded_at)}</p>
                {currentDispute.staff_note && (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', marginBottom: 4 }}>Historical staff note</div>
                    <p style={{ fontSize: 14, color: '#374151', whiteSpace: 'pre-wrap', margin: 0 }}>{currentDispute.staff_note}</p>
                  </>
                )}
              </>
            ) : <p style={muted}>No Customer dispute has been filed for this booking.</p>}
          </div>
          <p style={{ ...muted, marginTop: 18, marginBottom: 0, fontSize: 12.5 }}>
            Read-only Staff monitoring. The Caterer submits refund evidence; the Customer confirms actual receipt.
            Viewing evidence does not verify payment or change any status.
          </p>
        </div>
      )}
    </div>
  );
}