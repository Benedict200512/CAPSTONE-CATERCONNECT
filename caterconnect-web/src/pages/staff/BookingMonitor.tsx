import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Search, Calendar, ChevronDown, ChevronUp, Loader2, X,
  Users, Store, MapPin, Tag, Wallet, ShieldCheck, Clock,
  Layers, CheckCircle2, XCircle, Activity
} from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  all:              { label: 'All', icon: Layers, color: '#2563EB' },
  pending:          { label: 'Pending', icon: Clock, color: '#D97706' },
  confirmed:        { label: 'Confirmed', icon: CheckCircle2, color: '#16A34A' },
  awaiting_payment: { label: 'Awaiting Payment', icon: Wallet, color: '#0284C7' },
  paid:             { label: 'Paid', icon: ShieldCheck, color: '#059669' },
  ongoing:          { label: 'Ongoing', icon: Activity, color: '#7C3AED' },
  completed:        { label: 'Completed', icon: CheckCircle2, color: '#15803D' },
  cancelled:        { label: 'Cancelled', icon: XCircle, color: '#6B7280' },
  rejected:         { label: 'Rejected', icon: XCircle, color: '#DC2626' },
};

const STATUS_FILTERS = Object.keys(STATUS_CONFIG);

const STATUS_BADGE: Record<string, string> = {
  pending:          'badge-pending',
  confirmed:        'badge-approved',
  awaiting_payment: 'badge-review',
  paid:             'badge-paid',
  ongoing:          'badge-ongoing',
  completed:        'badge-completed',
  cancelled:        'badge-cancelled',
  rejected:         'badge-rejected',
};

export default function BookingMonitor() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      let query = supabase
        .from('bookings')
        .select('id, event_date, guest_count, total_cost, downpayment_amount, status, created_at, event_type, venue, profiles(full_name, email, avatar_url), caterers(business_name, logo_url)')
        .order('created_at', { ascending: false })
        .limit(150);
      if (filter !== 'all') query = query.eq('status', filter);
      const { data } = await query;
      setBookings(data ?? []);

      const statuses = ['pending', 'confirmed', 'awaiting_payment', 'paid', 'ongoing', 'completed', 'cancelled', 'rejected'];
      const countRes = await Promise.all(
        statuses.map(s => supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('status', s))
      );
      const c: Record<string, number> = {};
      statuses.forEach((s, i) => { c[s] = countRes[i].count ?? 0; });
      c.all = Object.values(c).reduce((a, b) => a + b, 0);
      setCounts(c);
      setLoading(false);
    };
    load();
  }, [filter]);

  const filtered = bookings.filter(b => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (b.profiles as any)?.full_name?.toLowerCase().includes(q) ||
           (b.caterers as any)?.business_name?.toLowerCase().includes(q);
  });

  const totalAmount = filtered.reduce((s, b) => s + Number(b.total_cost ?? 0), 0);

  return (
    <div style={{ paddingBottom: 40, fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#111', marginBottom: 6, letterSpacing: '-0.01em' }}>Booking Monitor</h1>
          <p style={{ fontSize: 14, color: '#6B7280', margin: 0, lineHeight: 1.4 }}>Track all bookings across the platform in real time</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={s.statPill}>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#EA580C', display: 'block', lineHeight: 1 }}>{counts.all ?? '—'}</span>
            <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Total Bookings</span>
          </div>
          <div style={s.statPill}>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#16A34A', display: 'block', lineHeight: 1 }}>₱{totalAmount.toLocaleString()}</span>
            <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Total Value Shown</span>
          </div>
        </div>
      </div>

      {/* Status tabs with Icons (Compact wrapping layout) */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap', width: '100%' }}>
        {STATUS_FILTERS.map((sf) => {
          const config = STATUS_CONFIG[sf] || { label: sf, icon: Layers, color: '#6B7280' };
          const IconComponent = config.icon;
          const isActive = filter === sf;
          return (
            <button key={sf} className={`tab-btn ${isActive ? 'active' : ''}`}
              onClick={() => setFilter(sf)}
              style={{ whiteSpace: 'nowrap', fontSize: 12.5, padding: '6px 12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
              <IconComponent size={14} color={isActive ? '#FFFFFF' : config.color} />
              {config.label}
              {counts[sf] !== undefined && (
                <span style={{ marginLeft: 5, background: isActive ? 'rgba(255,255,255,0.25)' : '#F3F4F6', color: isActive ? 'white' : '#6B7280', borderRadius: 10, padding: '1px 5px', fontSize: 10.5, fontWeight: 700 }}>
                  {counts[sf]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 20, maxWidth: 400 }}>
        <Search size={18} color="#9CA3AF" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)' }} />
        <input 
          type="text"
          placeholder="Search by customer or caterer name..."
          value={search} 
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '12px 16px 12px 44px', borderRadius: 14, border: '1px solid #E8E4DE', outline: 'none', fontSize: 14, background: '#FFF' }} 
        />
      </div>

      {/* Table */}
      <div style={{ background: '#FFFFFF', borderRadius: 24, border: '1px solid #E8E4DE', boxShadow: '0 10px 30px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 80, textAlign: 'center', color: '#9CA3AF', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <Loader2 size={36} color="#EA580C" className="animate-spin" />
            <span style={{ fontSize: 14, fontWeight: 600 }}>Loading bookings ledger...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 80, textAlign: 'center', color: '#9CA3AF', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#FAF8F5', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #E8E4DE' }}>
              <Calendar size={32} color="#D1D5DB" />
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#111', marginBottom: 4 }}>No bookings found</div>
              <div style={{ fontSize: 13.5, color: '#6B7280' }}>{filter !== 'all' ? 'No bookings match this status filter.' : 'Bookings will appear here once customers start booking.'}</div>
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E8E4DE' }}>
                  <th style={{ padding: '16px 20px', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5 }}>Customer</th>
                  <th style={{ padding: '16px 20px', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5 }}>Caterer</th>
                  <th style={{ padding: '16px 20px', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5 }}>Event Date</th>
                  <th style={{ padding: '16px 20px', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' }}>Guests</th>
                  <th style={{ padding: '16px 20px', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5 }}>Total</th>
                  <th style={{ padding: '16px 20px', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5 }}>Downpayment</th>
                  <th style={{ padding: '16px 20px', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5 }}>Status</th>
                  <th style={{ padding: '16px 20px', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5 }}>Booked On</th>
                  <th style={{ padding: '16px 20px' }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b, i) => (
                  <tr key={b.id} style={{ cursor: 'pointer', borderBottom: i === filtered.length - 1 ? 'none' : '1px solid #E8E4DE', transition: 'background 0.15s' }} 
                    onClick={() => setSelected(selected?.id === b.id ? null : b)}
                    onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '18px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {(b.profiles as any)?.avatar_url ? (
                          <img src={(b.profiles as any).avatar_url} alt=""
                            style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1.5px solid #E5E7EB' }} />
                        ) : (
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#2563EB', fontSize: 14, flexShrink: 0 }}>
                            {((b.profiles as any)?.full_name ?? 'C').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>{(b.profiles as any)?.full_name ?? '—'}</div>
                          <div style={{ fontSize: 12, color: '#9CA3AF' }}>{(b.profiles as any)?.email ?? ''}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '18px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {(b.caterers as any)?.logo_url ? (
                          <img src={(b.caterers as any).logo_url} alt=""
                            style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover', flexShrink: 0, border: '1px solid #E5E7EB' }} />
                        ) : (
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#7C3AED', fontSize: 12, flexShrink: 0 }}>
                            {((b.caterers as any)?.business_name ?? 'C').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>{(b.caterers as any)?.business_name ?? '—'}</span>
                      </div>
                    </td>
                    <td style={{ padding: '18px 20px', whiteSpace: 'nowrap', fontSize: 13, fontWeight: 600, color: '#4B5563' }}>
                      {b.event_date ? new Date(b.event_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </td>
                    <td style={{ padding: '18px 20px', textAlign: 'center', fontWeight: 700, fontSize: 14, color: '#111' }}>{b.guest_count ?? '—'}</td>
                    <td style={{ padding: '18px 20px', fontWeight: 800, color: '#EA580C', fontSize: 14.5 }}>₱{Number(b.total_cost ?? 0).toLocaleString()}</td>
                    <td style={{ padding: '18px 20px', color: '#6B7280', fontSize: 13, fontWeight: 600 }}>₱{Number(b.downpayment_amount ?? 0).toLocaleString()}</td>
                    <td style={{ padding: '18px 20px' }}><span className={`badge ${STATUS_BADGE[b.status] ?? 'badge-pending'}`}>{b.status.replace('_', ' ')}</span></td>
                    <td style={{ padding: '18px 20px', fontSize: 12, color: '#9CA3AF', whiteSpace: 'nowrap' }}>
                      {new Date(b.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '18px 20px', textAlign: 'right' }}>
                      <button style={{ background: '#FAF8F5', border: '1px solid #E8E4DE', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} 
                        onClick={e => { e.stopPropagation(); setSelected(selected?.id === b.id ? null : b); }}>
                        {selected?.id === b.id ? <ChevronUp size={16} color="#4B5563" /> : <ChevronDown size={16} color="#4B5563" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Expanded row detail with rich custom formatting and icons */}
      {selected && (
        <div style={{ background: '#FFFFFF', borderRadius: 24, border: '1px solid #E8E4DE', borderLeft: '4px solid #EA580C', marginTop: 24, padding: 32, boxShadow: '0 10px 30px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #E8E4DE' }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#111', marginBottom: 4 }}>Booking Detail Overview</div>
              <div style={{ fontSize: 12, color: '#9CA3AF', fontFamily: 'monospace' }}>ID: {selected.id}</div>
            </div>
            <button style={{ background: '#FAF8F5', border: '1px solid #E8E4DE', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#4B5563' }} 
              onClick={() => setSelected(null)}>
              <X size={14} /> Close View
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            
            {/* Customer Card */}
            <div style={{ background: '#FAF8F5', borderRadius: 16, padding: '16px 18px', border: '1px solid #E8E4DE', display: 'flex', alignItems: 'center', gap: 14 }}>
              {(selected.profiles as any)?.avatar_url ? (
                <img src={(selected.profiles as any).avatar_url} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid #FED7AA' }} />
              ) : (
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#2563EB', fontSize: 16 }}>
                  {((selected.profiles as any)?.full_name ?? 'C').charAt(0).toUpperCase()}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Users size={12} color="#6B7280" /> Customer
                </div>
                <div style={{ fontSize: 14.5, fontWeight: 800, color: '#111', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {(selected.profiles as any)?.full_name ?? '—'}
                </div>
                <div style={{ fontSize: 12, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {(selected.profiles as any)?.email ?? ''}
                </div>
              </div>
            </div>

            {/* Caterer Card */}
            <div style={{ background: '#FAF8F5', borderRadius: 16, padding: '16px 18px', border: '1px solid #E8E4DE', display: 'flex', alignItems: 'center', gap: 14 }}>
              {(selected.caterers as any)?.logo_url ? (
                <img src={(selected.caterers as any).logo_url} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', border: '2px solid #FED7AA' }} />
              ) : (
                <div style={{ width: 44, height: 44, borderRadius: 10, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#7C3AED', fontSize: 16 }}>
                  {((selected.caterers as any)?.business_name ?? 'C').charAt(0).toUpperCase()}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Store size={12} color="#6B7280" /> Caterer Partner
                </div>
                <div style={{ fontSize: 14.5, fontWeight: 800, color: '#111', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {(selected.caterers as any)?.business_name ?? '—'}
                </div>
              </div>
            </div>

            {/* Event Date */}
            <div style={{ background: '#FAF8F5', borderRadius: 16, padding: '16px 18px', border: '1px solid #E8E4DE', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#FFF7ED', border: '1px solid #FED7AA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Calendar size={20} color="#EA580C" />
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Event Date</div>
                <div style={{ fontSize: 14.5, fontWeight: 800, color: '#111', marginTop: 2 }}>
                  {selected.event_date ? new Date(selected.event_date).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'}
                </div>
              </div>
            </div>

            {/* Guests */}
            <div style={{ background: '#FAF8F5', borderRadius: 16, padding: '16px 18px', border: '1px solid #E8E4DE', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#EFF6FF', border: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={20} color="#2563EB" />
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Guest Count</div>
                <div style={{ fontSize: 14.5, fontWeight: 800, color: '#111', marginTop: 2 }}>
                  {selected.guest_count ?? '—'} guests
                </div>
              </div>
            </div>

            {/* Event Type */}
            <div style={{ background: '#FAF8F5', borderRadius: 16, padding: '16px 18px', border: '1px solid #E8E4DE', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#F0FDF4', border: '1px solid #BBF7D0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Tag size={20} color="#16A34A" />
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Event Type</div>
                <div style={{ fontSize: 14.5, fontWeight: 800, color: '#111', marginTop: 2 }}>
                  {selected.event_type ?? '—'}
                </div>
              </div>
            </div>

            {/* Venue */}
            <div style={{ background: '#FAF8F5', borderRadius: 16, padding: '16px 18px', border: '1px solid #E8E4DE', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#FEF2F2', border: '1px solid #FECACA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MapPin size={20} color="#DC2626" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Venue Location</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#111', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selected.venue ?? '—'}
                </div>
              </div>
            </div>

            {/* Total Cost */}
            <div style={{ background: '#FAF8F5', borderRadius: 16, padding: '16px 18px', border: '1px solid #E8E4DE', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#FFF7ED', border: '1px solid #FED7AA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Wallet size={20} color="#EA580C" />
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Total Cost</div>
                <div style={{ fontSize: 15, fontWeight: 900, color: '#EA580C', marginTop: 2 }}>
                  ₱{Number(selected.total_cost ?? 0).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Downpayment */}
            <div style={{ background: '#FAF8F5', borderRadius: 16, padding: '16px 18px', border: '1px solid #E8E4DE', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#F5F3FF', border: '1px solid #DDD6FE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldCheck size={20} color="#7C3AED" />
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Downpayment Required</div>
                <div style={{ fontSize: 15, fontWeight: 900, color: '#7C3AED', marginTop: 2 }}>
                  ₱{Number(selected.downpayment_amount ?? 0).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Status */}
            <div style={{ background: '#FAF8F5', borderRadius: 16, padding: '16px 18px', border: '1px solid #E8E4DE', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#F3F4F6', border: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={20} color="#4B5563" />
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Current Status</div>
                <div style={{ marginTop: 4 }}>
                  <span className={`badge ${STATUS_BADGE[selected.status] ?? 'badge-pending'}`}>
                    {selected.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  statPill: { background: 'white', border: '1px solid #E8E4DE', borderRadius: 20, padding: '12px 22px', textAlign: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' },
};