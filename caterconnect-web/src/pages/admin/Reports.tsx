import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Calendar, Users, CreditCard, AlertCircle, Download, Loader2, FileSpreadsheet, ShieldCheck } from 'lucide-react';

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
      icon: Calendar,
      title: 'Booking Report',
      desc: 'Export all recent event bookings containing statuses, timelines, caterer entities, and customer data.',
      color: '#2563EB',
      bg: '#DBEAFE',
      accent: 'linear-gradient(135deg, #2563EB 0%, #60A5FA 100%)',
      count: data.bookings.length,
      preview: data.bookings.slice(0, 3).map(b => `${(b.profiles as any)?.full_name ?? 'Unknown'} → ${(b.caterers as any)?.business_name ?? 'Unknown'}`),
    },
    {
      id: 'users',
      icon: Users,
      title: 'User Directory Report',
      desc: 'Export registered user base across all roles (Customers, Caterers, Staff, Admin) with creation logs.',
      color: '#7C3AED',
      bg: '#F5F3FF',
      accent: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)',
      count: data.users.length,
      preview: data.users.slice(0, 3).map(u => `${u.full_name ?? 'Unknown'} (${u.role})`),
    },
    {
      id: 'payments',
      icon: CreditCard,
      title: 'Revenue Report',
      desc: 'Export confirmed subscription payments organized by tier levels, caterer entities, and total amounts.',
      color: '#16A34A',
      bg: '#DCFCE7',
      accent: 'linear-gradient(135deg, #16A34A 0%, #4ADE80 100%)',
      count: data.payments.length,
      preview: data.payments.slice(0, 3).map(p => `${(p.caterers as any)?.business_name ?? 'Unknown'} — ₱${Number(p.amount).toLocaleString()}`),
    },
    {
      id: 'complaints',
      icon: AlertCircle,
      title: 'Complaint & Ticket Report',
      desc: 'Export customer and partner complaints, tracking current resolution workflows and reporting profiles.',
      color: '#DC2626',
      bg: '#FEE2E2',
      accent: 'linear-gradient(135deg, #DC2626 0%, #F87171 100%)',
      count: data.complaints.length,
      preview: data.complaints.slice(0, 3).map(c => `${c.subject ?? 'Unknown'} — Status: ${c.status}`),
    },
  ];

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#111', marginBottom: 6, letterSpacing: '-0.5px' }}>System Reports</h1>
          <p style={{ fontSize: 15, color: '#6B7280', margin: 0 }}>Extract real-time database analytics and metrics into portable CSV files.</p>
        </div>
        
        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 999, padding: '8px 18px', fontSize: 13, color: '#166534', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <ShieldCheck size={16} color="#16A34A" /> Live Database Linked
        </div>
      </div>

      {/* Reports Grid: Balanced 2x2 layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
        {reports.map((r) => {
          const Icon = r.icon;
          return (
            <div key={r.id} style={{ position: 'relative', background: '#FFFFFF', borderRadius: 20, border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', padding: 28, display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'transform 0.2s, box-shadow 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 20px -3px rgba(0,0,0,0.06)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.02)'; }}>
              
              {/* Top Accent Strip */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: r.accent }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, marginTop: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: r.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={26} color={r.color} />
                  </div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#111', letterSpacing: '-0.3px' }}>{r.title}</div>
                    <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2, fontWeight: 600 }}>
                      {loading ? 'Scanning database...' : `${r.count} records available`}
                    </div>
                  </div>
                </div>
              </div>

              <p style={{ fontSize: 14, color: '#4B5563', lineHeight: 1.6, marginBottom: 20, flex: 1 }}>{r.desc}</p>

              {/* Data Preview Box */}
              {!loading && r.preview.length > 0 && (
                <div style={{ background: '#F9FAFB', borderRadius: 14, border: '1px solid #E5E7EB', padding: '14px 16px', marginBottom: 24 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF', marginBottom: 8, letterSpacing: 1, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FileSpreadsheet size={12} /> Live Preview Snapshot
                  </div>
                  {r.preview.map((item, i) => (
                    <div key={i} style={{ fontSize: 13, color: '#4B5563', padding: '5px 0', borderBottom: i < r.preview.length - 1 ? '1px solid #E5E7EB' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>
                      • {item}
                    </div>
                  ))}
                </div>
              )}

              {/* Export Button */}
              <button
                onClick={() => exportCSV(r.id)}
                disabled={exporting === r.id || loading}
                style={{ 
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px',
                  background: '#111', color: '#FFF', border: 'none', borderRadius: 14, fontSize: 14, fontWeight: 800, cursor: (exporting === r.id || loading) ? 'not-allowed' : 'pointer',
                  opacity: (exporting === r.id || loading) ? 0.7 : 1, transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                }}
                onMouseEnter={e => { if (!(exporting === r.id || loading)) e.currentTarget.style.background = '#27272A'; }}
                onMouseLeave={e => { if (!(exporting === r.id || loading)) e.currentTarget.style.background = '#111'; }}
              >
                {exporting === r.id ? (
                  <><Loader2 size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} /> Compiling CSV File...</>
                ) : (
                  <><Download size={16} /> Export to CSV</>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}