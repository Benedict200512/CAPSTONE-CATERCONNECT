import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

const STATUS_FILTERS = ['all', 'pending', 'confirmed', 'awaiting_payment', 'paid', 'ongoing', 'completed', 'cancelled', 'rejected'];

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

      const statuses = ['pending', 'confirmed', 'awaiting_payment', 'paid', 'ongoing', 'completed', 'cancelled'];
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
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Booking Monitor</h1>
          <p className="page-sub">Track all bookings across the platform in real time</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={s.statPill}>
            <span style={{ fontSize: 20, fontWeight: 900, color: '#F97316', display: 'block' }}>{counts.all ?? '—'}</span>
            <span style={{ fontSize: 11, color: '#6B7280' }}>total bookings</span>
          </div>
          <div style={s.statPill}>
            <span style={{ fontSize: 20, fontWeight: 900, color: '#16A34A', display: 'block' }}>₱{totalAmount.toLocaleString()}</span>
            <span style={{ fontSize: 11, color: '#6B7280' }}>total value shown</span>
          </div>
        </div>
      </div>

      {/* Status tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
        {STATUS_FILTERS.map((sf) => (
          <button key={sf} className={`tab-btn ${filter === sf ? 'active' : ''}`}
            onClick={() => setFilter(sf)}
            style={{ whiteSpace: 'nowrap', fontSize: 12, padding: '7px 14px' }}>
            {sf === 'all' ? 'All' : sf.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
            {counts[sf] !== undefined && (
              <span style={{ marginLeft: 6, background: filter === sf ? 'rgba(255,255,255,0.2)' : '#F3F4F6', color: filter === sf ? 'white' : '#6B7280', borderRadius: 10, padding: '1px 6px', fontSize: 11, fontWeight: 700 }}>
                {counts[sf]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input className="form-input" placeholder="🔍  Search by customer or caterer name..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', maxWidth: 380 }} />
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="empty-state"><div className="empty-state-icon">⏳</div><div className="empty-state-sub">Loading bookings...</div></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <div className="empty-state-title">No bookings found</div>
            <div className="empty-state-sub">{filter !== 'all' ? 'No bookings match this status.' : 'Bookings will appear here once customers start booking.'}</div>
          </div>
        ) : (
          <table>
            <thead>
              <tr><th>Customer</th><th>Caterer</th><th>Event Date</th><th>Guests</th><th>Total</th><th>Downpayment</th><th>Status</th><th>Booked On</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(selected?.id === b.id ? null : b)}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {(b.profiles as any)?.avatar_url ? (
                        <img src={(b.profiles as any).avatar_url} alt=""
                          style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1.5px solid #E5E7EB' }} />
                      ) : (
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#2563EB', fontSize: 12, flexShrink: 0 }}>
                          {((b.profiles as any)?.full_name ?? 'C').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div style={{ fontWeight: 700 }}>{(b.profiles as any)?.full_name ?? '—'}</div>
                        <div style={{ fontSize: 11, color: '#9CA3AF' }}>{(b.profiles as any)?.email ?? ''}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {(b.caterers as any)?.logo_url ? (
                        <img src={(b.caterers as any).logo_url} alt=""
                          style={{ width: 28, height: 28, borderRadius: 8, objectFit: 'cover', flexShrink: 0, border: '1px solid #E5E7EB' }} />
                      ) : (
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#7C3AED', fontSize: 11, flexShrink: 0 }}>
                          {((b.caterers as any)?.business_name ?? 'C').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span style={{ fontWeight: 600 }}>{(b.caterers as any)?.business_name ?? '—'}</span>
                    </div>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {b.event_date ? new Date(b.event_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 700 }}>{b.guest_count ?? '—'}</td>
                  <td style={{ fontWeight: 800, color: '#F97316' }}>₱{Number(b.total_cost ?? 0).toLocaleString()}</td>
                  <td style={{ color: '#6B7280' }}>₱{Number(b.downpayment_amount ?? 0).toLocaleString()}</td>
                  <td><span className={`badge ${STATUS_BADGE[b.status] ?? 'badge-pending'}`}>{b.status.replace('_', ' ')}</span></td>
                  <td style={{ fontSize: 12, color: '#9CA3AF', whiteSpace: 'nowrap' }}>
                    {new Date(b.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td>
                    <button className="btn btn-outline btn-sm" onClick={e => { e.stopPropagation(); setSelected(selected?.id === b.id ? null : b); }}>
                      {selected?.id === b.id ? '▲' : '▼'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Expanded row detail */}
      {selected && (
        <div className="card" style={{ marginTop: 16, borderLeft: '4px solid #F97316' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 4 }}>Booking Detail</div>
              <div style={{ fontSize: 12, color: '#9CA3AF' }}>ID: {selected.id}</div>
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => setSelected(null)}>✕ Close</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[
              { label: 'Customer',    value: (selected.profiles as any)?.full_name ?? '—' },
              { label: 'Caterer',     value: (selected.caterers as any)?.business_name ?? '—' },
              { label: 'Event Date',  value: selected.event_date ? new Date(selected.event_date).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }) : '—' },
              { label: 'Guests',      value: `${selected.guest_count ?? '—'} guests` },
              { label: 'Event Type',  value: selected.event_type ?? '—' },
              { label: 'Venue',       value: selected.venue ?? '—' },
              { label: 'Total Cost',  value: `₱${Number(selected.total_cost ?? 0).toLocaleString()}` },
              { label: 'Downpayment', value: `₱${Number(selected.downpayment_amount ?? 0).toLocaleString()}` },
              { label: 'Status',      value: selected.status },
            ].map(row => (
              <div key={row.label} style={{ background: '#F8F9FA', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{row.label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{row.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  statPill: { background: 'white', border: '1px solid #E8E4DE', borderRadius: 12, padding: '10px 18px', textAlign: 'center' },
};