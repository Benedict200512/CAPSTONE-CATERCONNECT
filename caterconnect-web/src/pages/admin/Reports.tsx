import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function Reports() {
  const [data, setData] = useState<Record<string, any[]>>({ bookings: [], users: [], payments: [], complaints: [] });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const [bookings, users, payments, complaints] = await Promise.all([
        supabase.from('bookings').select('*, profiles(full_name, email), caterers(business_name)').order('created_at', { ascending: false }).limit(200),
        supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(200),
        supabase.from('subscription_payments').select('*, caterers(business_name)').eq('status', 'confirmed').order('confirmed_at', { ascending: false }).limit(200),
        supabase.from('complaints').select('*, profiles(full_name, email)').order('created_at', { ascending: false }).limit(200),
      ]);
      setData({
        bookings: bookings.data ?? [],
        users: users.data ?? [],
        payments: payments.data ?? [],
        complaints: complaints.data ?? [],
      });
      setLoading(false);
    };
    load();
  }, []);

  const exportCSV = (type: string) => {
    setExporting(type);

    const rows: Record<string, any>[] = data[type] ?? [];
    if (rows.length === 0) { setExporting(null); return; }

    // Flatten nested objects for CSV
    const flat = rows.map(row => {
      const obj: Record<string, any> = {};
      Object.entries(row).forEach(([k, v]) => {
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          Object.entries(v as Record<string, any>).forEach(([nk, nv]) => { obj[`${k}_${nk}`] = nv; });
        } else { obj[k] = v; }
      });
      return obj;
    });

    const headers = Object.keys(flat[0]);
    const csv = [headers.join(','), ...flat.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `caterconnect_${type}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(null);
  };

  const reports = [
    {
      id: 'bookings',
      icon: '📅',
      title: 'Booking Report',
      desc: 'All bookings with status, event dates, caterer, customer, and amounts.',
      color: '#2563EB',
      bg: '#DBEAFE',
      count: data.bookings.length,
      preview: data.bookings.slice(0, 3).map(b => `${(b.profiles as any)?.full_name ?? '—'} → ${(b.caterers as any)?.business_name ?? '—'}`),
    },
    {
      id: 'users',
      icon: '👥',
      title: 'User Report',
      desc: 'All registered users with roles, emails, and registration dates.',
      color: '#7C3AED',
      bg: '#F5F3FF',
      count: data.users.length,
      preview: data.users.slice(0, 3).map(u => `${u.full_name ?? '—'} (${u.role})`),
    },
    {
      id: 'payments',
      icon: '💰',
      title: 'Revenue Report',
      desc: 'Confirmed subscription payments by caterer, plan, and amount.',
      color: '#16A34A',
      bg: '#DCFCE7',
      count: data.payments.length,
      preview: data.payments.slice(0, 3).map(p => `${(p.caterers as any)?.business_name ?? '—'} — ₱${Number(p.amount).toLocaleString()}`),
    },
    {
      id: 'complaints',
      icon: '🚨',
      title: 'Complaint Report',
      desc: 'All complaints with priority, status, and reporter information.',
      color: '#DC2626',
      bg: '#FEE2E2',
      count: data.complaints.length,
      preview: data.complaints.slice(0, 3).map(c => `${c.subject ?? '—'} — ${c.status}`),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">System Reports</h1>
          <p className="page-sub">Export real-time platform data as CSV</p>
        </div>
        <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 10, padding: '8px 14px', fontSize: 13, color: '#15803D', fontWeight: 600 }}>
          ✅ Live data — exports reflect current database
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20, marginBottom: 28 }}>
        {reports.map((r) => (
          <div key={r.id} className="card" style={{ borderTop: `3px solid ${r.color}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: r.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{r.icon}</div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 900 }}>{r.title}</div>
                  <div style={{ fontSize: 12, color: '#9CA3AF' }}>{loading ? '...' : `${r.count} records`}</div>
                </div>
              </div>
            </div>

            <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, marginBottom: 14 }}>{r.desc}</p>

            {/* Preview */}
            {!loading && r.preview.length > 0 && (
              <div style={{ background: '#F8F9FA', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', marginBottom: 6, letterSpacing: 0.5 }}>PREVIEW</div>
                {r.preview.map((item, i) => (
                  <div key={i} style={{ fontSize: 12, color: '#6B7280', padding: '3px 0', borderBottom: i < r.preview.length - 1 ? '1px solid #E9ECEF' : 'none' }}>
                    {item}
                  </div>
                ))}
              </div>
            )}

            <button
              className="btn btn-black"
              onClick={() => exportCSV(r.id)}
              disabled={exporting === r.id || loading}
              style={{ width: '100%', justifyContent: 'center', opacity: (exporting === r.id || loading) ? 0.6 : 1 }}
            >
              {exporting === r.id ? '⏳ Exporting...' : '⬇️ Export CSV'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}