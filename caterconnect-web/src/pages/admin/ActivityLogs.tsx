import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { supabase } from '../../lib/supabase';

import {

  Calendar, CreditCard, ShieldCheck, ShieldAlert, Flag, Ban, UserCheck,

  RefreshCw, Activity, AlertCircle, Filter, Clock, Search, UserPlus,

  Eye, X, Layers, Users, Trash2, CheckCircle2, FileText, DollarSign, Tag, User, Briefcase, Hash

} from 'lucide-react';

type Category = 'staff' | 'users' | 'bookings' | 'payments' | 'system';

type Source = 'staff' | 'users' | 'bookings' | 'payments' | 'verifications' | 'complaints';

type Profile = { id: string; full_name: string | null; role: string | null };

type Log = {

  id: string; category: Category; type: string; icon: typeof Calendar;

  color: string; bg: string; border: string; time: string | null;

  text: string; entity: string; sub: string;

  actorId?: string | null; actorName?: string; actorRole?: string | null;

  targetId?: string | null; targetName?: string; targetRole?: string | null;

  action?: string; reason?: string | null; recordId: string;

  customerName?: string; catererName?: string; currentStatus?: string;

  planId?: string; amount?: number; subject?: string;

};

const BATCH = 25;

const SOURCES: Source[] = ['staff', 'users', 'bookings', 'payments', 'verifications', 'complaints'];

const categoryIcons: Record<string, typeof Layers> = {

  all: Layers,

  staff: UserCheck,

  users: Users,

  bookings: Calendar,

  payments: CreditCard,

  system: ShieldCheck,

};

const button: React.CSSProperties = { 

  border: '1px solid #E5E7EB', borderRadius: 10, background: '#FFF', 

  padding: '9px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', 

  color: '#374151', display: 'inline-flex', alignItems: 'center', transition: 'all 0.2s' 

};

const field: React.CSSProperties = { 

  padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: 10, 

  background: '#FFF', fontSize: 13, minWidth: 0, outline: 'none' 

};

const dateStart = (day: string) => new Date(`${day}T00:00:00`).toISOString();

const dateEnd = (day: string) => { const d = new Date(`${day}T00:00:00`); d.setDate(d.getDate() + 1); return d.toISOString(); };

const formatTime = (time: string | null) => time ? new Date(time).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'medium' }) : '—';

const timeAgo = (ts: string | null) => {

  if (!ts) return '—';

  const minutes = Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 60000));

  if (minutes < 1) return 'Just now';

  if (minutes < 60) return `${minutes}m ago`;

  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;

  return `${Math.floor(minutes / 1440)}d ago`;

};

const isMeaningful = (value: string | number | null | undefined): value is string | number =>

  value !== null && value !== undefined && String(value).trim() !== '' && String(value).trim() !== '—';

function activityDetails(log: Log): Array<[string, string | number | null | undefined, typeof User]> {

  const when = formatTime(log.time);

  switch (log.type) {

    case 'moderation':

      return [

        ['Action', log.action, Tag], 

        ['Staff member', log.actorName, User], 

        ['Staff role', log.actorRole, ShieldCheck],

        ['Affected user', log.targetName, UserCheck], 

        ['Affected user role', log.targetRole, Users],

        ['Reason', log.reason, FileText], 

        ['Date and time', when, Clock],

        ['Event ID', log.recordId, Hash], 

        ['Staff ID', log.actorId, Hash], 

        ['Affected user ID', log.targetId, Hash],

      ];

    case 'registration':

      return [

        ['User', log.targetName, User], 

        ['Account role', log.targetRole, ShieldCheck],

        ['Profile created at', when, Clock], 

        ['Profile ID', log.recordId, Hash],

        ['Note', 'Profile creation does not confirm email verification', AlertCircle],

      ];

    case 'booking':

      return [

        ['Customer', log.customerName, User], 

        ['Caterer', log.catererName, Briefcase],

        ['Activity', 'Booking created', Activity], 

        ['Current booking status', log.currentStatus, CheckCircle2],

        ['Booking created at', when, Clock], 

        ['Booking ID', log.recordId, Hash],

        ['Note', 'Current status may differ from the status when the booking was created', AlertCircle],

      ];

    case 'payment':

      return [

        ['Caterer', log.catererName, Briefcase], 

        ['Subscription plan', log.planId?.toUpperCase(), Tag],

        ['Amount', log.amount === undefined ? undefined : `₱${log.amount.toLocaleString('en-PH')}`, DollarSign],

        ['Activity', 'Subscription payment confirmed', CheckCircle2], 

        ['Confirmed at', when, Clock],

        ['Payment ID', log.recordId, Hash],

      ];

    case 'verification':

      return [

        ['Caterer', log.catererName, Briefcase], 

        ['Verification status', log.currentStatus, ShieldCheck],

        ['Reviewed at', when, Clock], 

        ['Caterer ID', log.recordId, Hash],

      ];

    case 'complaint':

      return [

        ['Reporter', log.actorName, User], 

        ['Subject', log.subject, FileText],

        ['Current complaint status', log.currentStatus, AlertCircle],

        ['Complaint filed at', when, Clock], 

        ['Complaint ID', log.recordId, Hash],

      ];

    default:

      return [

        ['Activity', log.text, Activity], 

        ['Date and time', when, Clock], 

        ['Record ID', log.recordId, Hash]

      ];

  }

}

export default function ActivityLogs() {

  const [logs, setLogs] = useState<Log[]>([]);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState('');

  const [category, setCategory] = useState<'all' | Category>('all');

  const [search, setSearch] = useState('');

  const [fromDate, setFromDate] = useState('');

  const [toDate, setToDate] = useState('');

  const [staffId, setStaffId] = useState('');

  const [action, setAction] = useState('');

  const [targetRole, setTargetRole] = useState('');

  const [staffOptions, setStaffOptions] = useState<Profile[]>([]);

  const [selected, setSelected] = useState<Log | null>(null);

  const [hasMore, setHasMore] = useState<Record<Source, boolean>>({

    staff: true, users: true, bookings: true, payments: true, verifications: true, complaints: true,

  });

  const offsets = useRef<Record<Source, number>>({

    staff: 0, users: 0, bookings: 0, payments: 0, verifications: 0, complaints: 0,

  });

  const requestId = useRef(0);

  const busy = useRef(false);

  useEffect(() => {

    let active = true;

    supabase.from('profiles').select('id, full_name, role')

      .in('role', ['staff', 'admin']).order('full_name', { ascending: true })

      .then(({ data, error: e }) => {

        if (active && !e) setStaffOptions((data ?? []) as Profile[]);

      });

    return () => { active = false; };

  }, []);

  const invalidDates = Boolean(fromDate && toDate && fromDate > toDate);

  const activeSources = useMemo<Source[]>(() => {

    if (category === 'all') return SOURCES;

    if (category === 'system') return ['verifications', 'complaints'];

    return [category];

  }, [category]);

  const load = useCallback(async (reset: boolean) => {

    if (invalidDates || (busy.current && !reset)) return;

    const token = ++requestId.current;

    busy.current = true;

    setLoading(true);

    setError('');

    const currentOffsets = reset

      ? Object.fromEntries(SOURCES.map(s => [s, 0])) as Record<Source, number>

      : { ...offsets.current };

    const nextMore = reset

      ? Object.fromEntries(SOURCES.map(s => [s, true])) as Record<Source, boolean>

      : { ...hasMore };

    try {

      const tasks = activeSources.filter(s => nextMore[s]).map(async source => {

        const timestamp = source === 'payments' ? 'confirmed_at' : source === 'verifications' ? 'reviewed_at' : 'created_at';

        const select = {

          staff: 'id, user_id, actor_id, action, reason, created_at',

          users: 'id, full_name, role, created_at',

          bookings: 'id, status, created_at, profiles(full_name), caterers(business_name)',

          payments: 'id, plan_id, amount, confirmed_at, caterers(business_name)',

          verifications: 'id, business_name, verification_status, reviewed_at',

          complaints: 'id, reporter_id, subject, status, created_at',

        }[source];

        const table = {

          staff: 'account_monitoring_events', users: 'profiles', bookings: 'bookings',

          payments: 'subscription_payments', verifications: 'caterers', complaints: 'complaints',

        }[source];

        let query = supabase.from(table).select(select)

          .order(timestamp, { ascending: false })

          .range(currentOffsets[source], currentOffsets[source] + BATCH - 1);

        if (source === 'payments') query = query.eq('status', 'confirmed');

        if (source === 'verifications') query = query.not('reviewed_at', 'is', null);

        if (source === 'staff' && staffId) query = query.eq('actor_id', staffId);

        if (source === 'staff' && action) query = query.eq('action', action);

        if (fromDate) query = query.gte(timestamp, dateStart(fromDate));

        if (toDate) query = query.lt(timestamp, dateEnd(toDate));

        const { data, error: e } = await query;

        if (e) throw new Error(`${source}: ${e.message}`);

        return { source, rows: (data ?? []) as any[] };

      });

      const results = await Promise.allSettled(tasks);

      if (token !== requestId.current) return;

      const failures: string[] = [];

      const successes: { source: Source; rows: any[] }[] = [];

      results.forEach(r => r.status === 'fulfilled' ? successes.push(r.value) : failures.push(String(r.reason)));

      if (failures.length) setError(failures.join(' | '));

      const ids = [...new Set(successes.flatMap(({ source, rows }) =>

        source === 'staff' ? rows.flatMap(r => [r.actor_id, r.user_id]) :

        source === 'complaints' ? rows.map(r => r.reporter_id) : []

      ).filter((id): id is string => typeof id === 'string' && id.length > 0))];

      const profiles = ids.length

        ? await supabase.from('profiles').select('id, full_name, role').in('id', ids)

        : { data: [] as Profile[], error: null };

      if (profiles.error) setError(prev => [prev, `Profile names: ${profiles.error!.message}`].filter(Boolean).join(' | '));

      const people = new Map((profiles.data ?? []).map(p => [p.id, p as Profile]));

      const newLogs: Log[] = [];

      for (const { source, rows } of successes) {

        currentOffsets[source] += rows.length;

        nextMore[source] = rows.length === BATCH;

        for (const r of rows) {

          if (source === 'staff') {

            const actor = people.get(r.actor_id);

            const target = people.get(r.user_id);

            const act = String(r.action ?? '').toLowerCase();

            const danger = act === 'suspend', flag = act === 'flag' || act === 'unflag';

            const labels: Record<string, string> = { flag: 'flagged', unflag: 'unflagged', suspend: 'suspended', reactivate: 'reactivated' };

            newLogs.push({

              id: `staff-${r.id}`, recordId: r.id, category: 'staff', type: 'moderation',

              icon: danger ? Ban : flag ? Flag : UserCheck,

              color: danger ? '#DC2626' : flag ? '#D97706' : '#16A34A',

              bg: danger ? '#FEE2E2' : flag ? '#FEF3C7' : '#DCFCE7',

              border: danger ? '#FECACA' : flag ? '#FDE68A' : '#BBF7D0',

              time: r.created_at, text: `Account ${labels[act] ?? act}`,

              actorId: r.actor_id, actorName: actor?.full_name ?? 'Unknown staff', actorRole: actor?.role,

              targetId: r.user_id, targetName: target?.full_name ?? 'Unknown user', targetRole: target?.role,

              action: act, reason: r.reason,

              entity: `By: ${actor?.full_name ?? 'Unknown staff'} (${actor?.role ?? 'unknown role'}) → ${target?.full_name ?? 'Unknown user'} (${target?.role ?? 'unknown role'})`,

              sub: `Reason: ${r.reason || 'No reason recorded'}`,

            });

          } else if (source === 'users') {

            newLogs.push({ id: `registration-${r.id}`, recordId: r.id, category: 'users', type: 'registration',

              icon: UserPlus, color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', time: r.created_at,

              text: 'New user registered', entity: `${r.full_name || 'Unnamed user'} (${r.role || 'unknown role'})`,

              sub: 'User profile created (not proof of email verification)', targetId: r.id, targetName: r.full_name, targetRole: r.role });

          } else if (source === 'bookings') {

            newLogs.push({ id: `booking-${r.id}`, recordId: r.id, category: 'bookings', type: 'booking',

              icon: Calendar, color: '#F97316', bg: '#FFF7ED', border: '#FFEDD5', time: r.created_at,

              text: 'New booking requested',

              entity: `${r.profiles?.full_name ?? '—'} → ${r.caterers?.business_name ?? '—'}`, sub: `Current status: ${r.status}`, customerName: r.profiles?.full_name ?? undefined,

              catererName: r.caterers?.business_name ?? undefined, currentStatus: r.status });

          } else if (source === 'payments') {

            newLogs.push({ id: `payment-${r.id}`, recordId: r.id, category: 'payments', type: 'payment',

              icon: CreditCard, color: '#16A34A', bg: '#DCFCE7', border: '#BBF7D0', time: r.confirmed_at,

              text: 'Subscription payment confirmed', entity: r.caterers?.business_name ?? '—',

              sub: `${String(r.plan_id ?? '').toUpperCase()} Plan • ₱${Number(r.amount ?? 0).toLocaleString()}`,

              catererName: r.caterers?.business_name ?? undefined, planId: String(r.plan_id ?? ''), amount: Number(r.amount ?? 0) });

          } else if (source === 'verifications') {

            const approved = r.verification_status === 'approved';

            newLogs.push({ id: `verification-${r.id}`, recordId: r.id, category: 'system', type: 'verification',

              icon: approved ? ShieldCheck : ShieldAlert, color: approved ? '#16A34A' : '#DC2626',

              bg: approved ? '#DCFCE7' : '#FEE2E2', border: approved ? '#BBF7D0' : '#FECACA',

              time: r.reviewed_at, text: `Caterer verification ${r.verification_status}`,

              entity: r.business_name ?? '—', sub: 'System Security',

              catererName: r.business_name ?? undefined, currentStatus: r.verification_status });

          } else {

            newLogs.push({ id: `complaint-${r.id}`, recordId: r.id, category: 'system', type: 'complaint',

              icon: AlertCircle, color: '#DC2626', bg: '#FEE2E2', border: '#FECACA',

              time: r.created_at, text: `New complaint filed: "${r.subject ?? '—'}"`,

              entity: `By ${people.get(r.reporter_id)?.full_name ?? 'Unknown reporter'}`, sub: `Status: ${r.status}`,

              actorId: r.reporter_id, actorName: people.get(r.reporter_id)?.full_name ?? 'Unknown reporter',

              subject: r.subject ?? undefined, currentStatus: r.status });

          }

        }

      }

      offsets.current = currentOffsets;

      setHasMore(nextMore);

      setLogs(old => {

        const map = new Map((reset ? [] : old).map(l => [l.id, l]));

        newLogs.forEach(l => map.set(l.id, l));

        return [...map.values()].sort((a, b) => new Date(b.time ?? 0).getTime() - new Date(a.time ?? 0).getTime());

      });

    } catch (e) {

      if (token === requestId.current) setError(e instanceof Error ? e.message : 'Unable to load activity logs.');

    } finally {

      if (token === requestId.current) { busy.current = false; setLoading(false); }

    }

  }, [activeSources, hasMore, staffId, action, fromDate, toDate, invalidDates]);

  useEffect(() => {

    requestId.current++;

    busy.current = false;

    offsets.current = Object.fromEntries(SOURCES.map(s => [s, 0])) as Record<Source, number>;

    setLogs([]);

    setHasMore(Object.fromEntries(SOURCES.map(s => [s, true])) as Record<Source, boolean>);

    if (!invalidDates) void load(true);

    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, [category, staffId, action, fromDate, toDate, invalidDates]);

  const visible = useMemo(() => {

    const term = search.trim().toLowerCase();

    return logs.filter(l => {

      if (category !== 'all' && l.category !== category) return false;

      if (targetRole && (l.targetRole ?? '') !== targetRole) return false;

      if (staffId && l.category !== 'staff' && category === 'all') return false;

      if (action && l.category !== 'staff' && category === 'all') return false;

      return !term || [l.text, l.entity, l.sub, l.actorName, l.targetName, l.actorId, l.targetId, l.recordId]

        .some(v => String(v ?? '').toLowerCase().includes(term));

    });

  }, [logs, search, targetRole, category, staffId, action]);

  const more = activeSources.some(s => hasMore[s]);

  const clear = () => {

    setCategory('all'); setSearch(''); setFromDate(''); setToDate('');

    setStaffId(''); setAction(''); setTargetRole('');

  };

  return (

    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", paddingBottom: 40, color: '#111827' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>

        <div>

          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#111', margin: '0 0 6px', letterSpacing: '-0.5px' }}>Activity Logs</h1>

          <p style={{ color: '#6B7280', fontSize: 14, margin: 0 }}>Monitor platform operations and staff account moderation history.</p>

        </div>

        <button style={button} disabled={loading} onClick={() => void load(true)}>

          <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none', verticalAlign: 'middle', marginRight: 6 }} />

          {loading ? 'Compiling activity logs...' : 'Refresh logs'}

        </button>

      </div>

      {error && (

        <div role="alert" style={{ background: '#FEF2F2', color: '#991B1B', padding: 14, borderRadius: 12, marginBottom: 16, border: '1px solid #FECACA', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>

          <AlertCircle size={16} /> Some activity could not be loaded: {error}

        </div>

      )}

      <div style={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: 20, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', overflow: 'hidden' }}>

        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', gap: 8, flexWrap: 'wrap', background: '#F9FAFB', alignItems: 'center' }}>

          <Filter size={16} color="#9CA3AF" style={{ marginRight: 4 }} />

          <span style={{ fontSize: 13, fontWeight: 700, color: '#6B7280', marginRight: 4 }}>Category:</span>

          {(['all', 'staff', 'users', 'bookings', 'payments', 'system'] as const).map(c => {

            const Icon = categoryIcons[c] || Layers;

            const isActive = category === c;

            return (

              <button key={c} onClick={() => setCategory(c)} 

                style={{ 

                  ...button, borderRadius: 20, padding: '7px 14px', fontSize: 12.5, textTransform: 'capitalize', 

                  background: isActive ? '#111827' : '#FFF', color: isActive ? '#FFF' : '#374151',

                  borderColor: isActive ? '#111827' : '#E5E7EB', display: 'inline-flex', alignItems: 'center', gap: 6,

                  boxShadow: isActive ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'

                }}>

                <Icon size={13} color={isActive ? '#F97316' : '#9CA3AF'} />

                {c}

              </button>

            );

          })}

        </div>

        <div style={{ padding: 20, borderBottom: '1px solid #E5E7EB', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, background: '#FFFFFF' }}>

          <label style={{ display: 'grid', gap: 6, fontSize: 12, fontWeight: 700, color: '#4B5563' }}>

            Search loaded records

            <span style={{ position: 'relative', display: 'block' }}>

              <Search size={15} style={{ position: 'absolute', top: 12, left: 12, color: '#9CA3AF' }} />

              <input type="search" value={search} onChange={e => setSearch(e.target.value)}

                placeholder="Staff, user, reason, ID..." style={{ ...field, width: '100%', boxSizing: 'border-box', paddingLeft: 36 }} />

            </span>

          </label>

          <label style={{ display: 'grid', gap: 6, fontSize: 12, fontWeight: 700, color: '#4B5563' }}>

            From date

            <input type="date" style={field} value={fromDate} max={toDate || undefined} onChange={e => setFromDate(e.target.value)} />

          </label>

          <label style={{ display: 'grid', gap: 6, fontSize: 12, fontWeight: 700, color: '#4B5563' }}>

            To date

            <input type="date" style={field} value={toDate} min={fromDate || undefined} onChange={e => setToDate(e.target.value)} />

          </label>

          <label style={{ display: 'grid', gap: 6, fontSize: 12, fontWeight: 700, color: '#4B5563' }}>

            Staff member

            <select style={field} value={staffId} onChange={e => setStaffId(e.target.value)}>

              <option value="">All Staff</option>

              {staffOptions.map(p => <option key={p.id} value={p.id}>{p.full_name ?? p.id} ({p.role})</option>)}

            </select>

          </label>

          <label style={{ display: 'grid', gap: 6, fontSize: 12, fontWeight: 700, color: '#4B5563' }}>

            Moderation action

            <select style={field} value={action} onChange={e => setAction(e.target.value)}>

              <option value="">All actions</option>

              {['flag', 'unflag', 'suspend', 'reactivate'].map(a => <option key={a} value={a}>{a[0].toUpperCase() + a.slice(1)}</option>)}

            </select>

          </label>

          <label style={{ display: 'grid', gap: 6, fontSize: 12, fontWeight: 700, color: '#4B5563' }}>

            Affected user role (loaded)

            <select style={field} value={targetRole} onChange={e => setTargetRole(e.target.value)}>

              <option value="">All roles</option>

              {['customer', 'caterer', 'staff', 'admin'].map(r => <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</option>)}

            </select>

          </label>

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}>

            <button 

              style={{ 

                ...button, 

                width: '100%', 

                justifyContent: 'center', 

                background: '#FEF2F2', 

                color: '#DC2626', 

                borderColor: '#FEE2E2',

                fontWeight: 800 

              }} 

              onClick={clear}

              onMouseEnter={e => e.currentTarget.style.background = '#FEE2E2'}

              onMouseLeave={e => e.currentTarget.style.background = '#FEF2F2'}

            >

              <Trash2 size={14} style={{ marginRight: 6 }} /> Clear filters

            </button>

          </div>

        </div>

        <div style={{ padding: '12px 20px', background: '#F9FAFB', color: '#6B7280', fontSize: 12.5, borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>

          <span><strong>{visible.length}</strong> matching loaded records · <strong>{logs.length}</strong> loaded total</span>

          <span style={{ color: '#9CA3AF' }}>Date, staff, and action filters are applied at the database level.</span>

        </div>

        {invalidDates && <p role="alert" style={{ color: '#B91C1C', padding: '12px 20px', margin: 0, fontSize: 13, background: '#FEF2F2' }}>From date cannot be later than To date.</p>}

        <div style={{ padding: 24 }}>

          {loading && logs.length === 0 ? (

            <div style={{ padding: 60, textAlign: 'center', color: '#9CA3AF', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>

              <Activity size={32} color="#F97316" style={{ animation: 'spin 1s linear infinite' }} />

              <div style={{ fontSize: 14, fontWeight: 600 }}>Compiling activity logs...</div>

            </div>

          ) : visible.length === 0 ? (

            <div style={{ padding: 60, textAlign: 'center', color: '#9CA3AF', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>

              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#F3F4F6', display: 'grid', placeItems: 'center' }}>

                <Clock size={26} color="#9CA3AF" />

              </div>

              <div>

                <div style={{ fontSize: 16, fontWeight: 800, color: '#111', marginBottom: 4 }}>No matching activity found</div>

                <div style={{ fontSize: 13, color: '#6B7280' }}>{more ? 'Load older records to continue searching.' : 'No further records available for selected filters.'}</div>

              </div>

            </div>

          ) : (

            <div style={{ display: 'grid', gap: 14 }}>

              {visible.map(l => {

                const Icon = l.icon;

                return (

                  <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 16, transition: 'transform 0.15s ease' }}>

                    <div style={{ background: l.bg, color: l.color, border: `1px solid ${l.border}`, borderRadius: '50%', width: 44, height: 44, flexShrink: 0, display: 'grid', placeItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>

                      <Icon size={20} />

                    </div>

                    <div style={{ flex: 1, minWidth: 0, border: '1px solid #E5E7EB', background: '#FAFAFA', borderRadius: 14, padding: '16px 20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>

                      <div style={{ minWidth: 0, flex: 1 }}>

                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>

                          <strong style={{ fontSize: 14.5, color: '#111', fontWeight: 800 }}>{l.text}</strong>

                          <span style={{ color: l.color, background: l.bg, padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>{l.category}</span>

                        </div>

                        <div style={{ color: '#4B5563', fontSize: 13.5, marginBottom: 4, overflowWrap: 'anywhere' }}>{l.entity}</div>

                        <div style={{ color: '#6B7280', fontSize: 12.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{l.sub}</div>

                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>

                        <span style={{ color: l.color, background: l.bg, padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 800 }}>{timeAgo(l.time)}</span>

                        <button style={button} onClick={() => setSelected(l)}>

                          <Eye size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} /> Details

                        </button>

                      </div>

                    </div>

                  </div>

                );

              })}

            </div>

          )}

          {more && !invalidDates && (

            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>

              <button style={button} disabled={loading} onClick={() => void load(false)}>

                <RefreshCw size={14} style={{ marginRight: 7 }} />

                {loading ? 'Compiling activity logs...' : 'Load older records'}

              </button>

            </div>

          )}

          {!more && !loading && logs.length > 0 && (

            <p style={{ textAlign: 'center', fontSize: 12.5, color: '#9CA3AF', marginTop: 24 }}>End of available records for selected filters.</p>

          )}

        </div>

      </div>

      {selected && (

        <div role="presentation" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(17,24,39,0.6)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', padding: 16 }} onMouseDown={e => { if (e.target === e.currentTarget) setSelected(null); }}>

          <div role="dialog" aria-modal="true" aria-label="Activity details" style={{ background: '#FFF', borderRadius: 20, padding: 28, maxWidth: 620, width: '100%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, borderBottom: '1px solid #E5E7EB', paddingBottom: 14 }}>

              <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0, color: '#111' }}>Activity details</h2>

              <button style={{ ...button, borderRadius: '50%', width: 36, height: 36, padding: 0, display: 'grid', placeItems: 'center' }} onClick={() => setSelected(null)} aria-label="Close details">

                <X size={18} />

              </button>

            </div>

            <p style={{ color: '#111827', fontWeight: 800, fontSize: 16, marginBottom: 16 }}>{selected.text}</p>

            <div style={{ display: 'grid', gap: 4 }}>

              {activityDetails(selected).filter(([, value]) => isMeaningful(value)).map(([name, value, DetailIcon]) => (

                <div key={name} style={{ borderBottom: '1px solid #F3F4F6', padding: '10px 0', display: 'grid', gridTemplateColumns: '160px 1fr', gap: 12, fontSize: 13, alignItems: 'center' }}>

                  <strong style={{ color: '#6B7280', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>

                    <DetailIcon size={15} color="#9CA3AF" /> {name}

                  </strong>

                  <span style={{ color: '#111827', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontWeight: 500 }}>{value}</span>

                </div>

              ))}

            </div>

            <p style={{ color: '#6B7280', fontSize: 12, marginTop: 20, marginBottom: 0, borderTop: '1px solid #F3F4F6', paddingTop: 14 }}>

              Read-only view. Displayed records are subject to security access policies.

            </p>

          </div>

        </div>

      )}

    </div>

  );

}