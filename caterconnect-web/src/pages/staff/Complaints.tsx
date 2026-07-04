import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type Complaint = {
  id: string;
  reporter_id: string | null;
  reporter_role: string | null;
  against_name: string | null;
  complaint_type: string;
  subject: string | null;
  description: string;
  priority: string;
  status: string;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
  profiles?: { full_name: string; email: string } | null;
};

const PRIORITY_STYLE: Record<string, { bg: string; color: string }> = {
  high:   { bg: '#FEE2E2', color: '#991B1B' },
  medium: { bg: '#FEF3C7', color: '#92400E' },
  low:    { bg: '#DCFCE7', color: '#166534' },
};

const STATUS_BADGE: Record<string, string> = {
  open:      'badge-open',
  in_review: 'badge-review',
  resolved:  'badge-resolved',
  closed:    'badge-closed',
};

export default function Complaints() {
  const [complaints, setComplaints]       = useState<Complaint[]>([]);
  const [loading, setLoading]             = useState(true);
  const [filter, setFilter]               = useState('open');
  const [selected, setSelected]           = useState<Complaint | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [updating, setUpdating]           = useState(false);
  const [counts, setCounts]               = useState<Record<string, number>>({});

  const load = async () => {
    setLoading(true);

    // Load counts for all statuses
    const statuses = ['open', 'in_review', 'resolved', 'closed'];
    const countRes = await Promise.all(
      statuses.map(s =>
        supabase.from('complaints').select('id', { count: 'exact', head: true }).eq('status', s)
      )
    );
    const c: Record<string, number> = {};
    statuses.forEach((s, i) => { c[s] = countRes[i].count ?? 0; });
    setCounts(c);

    // Load complaints with reporter info
    let query = supabase
      .from('complaints')
      .select('*, profiles(full_name, email)')
      .order('created_at', { ascending: false });

    if (filter !== 'all') query = query.eq('status', filter);

    const { data, error } = await query;
    if (error) console.error('Complaints error:', error.message);
    setComplaints((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const updateStatus = async (id: string, status: string) => {
    setUpdating(true);
    await supabase.from('complaints').update({
      status,
      resolution_notes: resolutionNotes || null,
      updated_at: new Date().toISOString(),
    }).eq('id', id);
    setUpdating(false);
    setSelected(null);
    setResolutionNotes('');
    load();
  };

  const updatePriority = async (id: string, priority: string) => {
    await supabase.from('complaints').update({ priority, updated_at: new Date().toISOString() }).eq('id', id);
    load();
    if (selected?.id === id) setSelected({ ...selected, priority });
  };

  const totalOpen = counts.open ?? 0;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Complaints & Disputes</h1>
          <p className="page-sub">Investigate and resolve platform disputes between users</p>
        </div>
        {totalOpen > 0 && (
          <div style={s.urgentPill}>
            <span style={{ fontSize: 20, fontWeight: 900 }}>{totalOpen}</span>
            <span style={{ fontSize: 12, fontWeight: 700 }}>need attention</span>
          </div>
        )}
      </div>

      {/* Status tabs with counts */}
      <div className="tab-bar">
        {[
          { key: 'all',       label: 'All',       icon: '📋' },
          { key: 'open',      label: 'Open',      icon: '🔴' },
          { key: 'in_review', label: 'In Review', icon: '🔍' },
          { key: 'resolved',  label: 'Resolved',  icon: '✅' },
          { key: 'closed',    label: 'Closed',    icon: '🔒' },
        ].map((tab) => (
          <button
            key={tab.key}
            className={`tab-btn ${filter === tab.key ? 'active' : ''}`}
            onClick={() => { setFilter(tab.key); setSelected(null); }}
          >
            {tab.icon} {tab.label}
            {counts[tab.key] !== undefined && counts[tab.key] > 0 && (
              <span style={{
                marginLeft: 6, background: filter === tab.key ? 'rgba(255,255,255,0.2)' : '#F3F4F6',
                color: filter === tab.key ? 'white' : '#6B7280',
                borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700,
              }}>
                {counts[tab.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      <div style={s.splitView}>
        {/* LEFT — list */}
        <div style={s.listPanel}>
          {loading ? (
            <div className="empty-state">
              <div className="empty-state-icon">⏳</div>
              <div className="empty-state-sub">Loading complaints...</div>
            </div>
          ) : complaints.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">{filter === 'open' ? '✅' : '📭'}</div>
              <div className="empty-state-title">
                {filter === 'open' ? 'All clear!' : `No ${filter.replace('_', ' ')} complaints`}
              </div>
              <div className="empty-state-sub">
                {filter === 'open' ? 'No open complaints right now.' : 'Nothing here yet.'}
              </div>
            </div>
          ) : (
            complaints.map((c) => {
              const ps = PRIORITY_STYLE[c.priority] ?? PRIORITY_STYLE.medium;
              const isActive = selected?.id === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => { setSelected(c); setResolutionNotes(c.resolution_notes ?? ''); }}
                  style={{ ...s.listItem, ...(isActive ? s.listItemActive : {}) }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ ...s.priorityDot, background: ps.color }} />
                      <span style={{ ...s.priorityLabel, background: ps.bg, color: ps.color }}>
                        {c.priority}
                      </span>
                      <span className={`badge ${STATUS_BADGE[c.status] ?? 'badge-open'}`}>
                        {c.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div style={s.listItemType}>{c.complaint_type}</div>
                    {c.subject && (
                      <div style={s.listItemSubject}>{c.subject}</div>
                    )}
                    <div style={s.listItemMeta}>
                      <span>Against: {c.against_name ?? '—'}</span>
                      <span>·</span>
                      <span>{new Date(c.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</span>
                    </div>
                  </div>
                  <span style={{ color: '#D1D5DB', fontSize: 20 }}>›</span>
                </div>
              );
            })
          )}
        </div>

        {/* RIGHT — detail */}
        <div style={s.detailPanel}>
          {!selected ? (
            <div className="empty-state" style={{ padding: '80px 40px' }}>
              <div className="empty-state-icon">⚠️</div>
              <div className="empty-state-title">Select a complaint</div>
              <div className="empty-state-sub">Click a complaint from the list to review details and take action</div>
            </div>
          ) : (
            <div>
              {/* Detail header */}
              <div style={s.detailHeader}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: 20, fontWeight: 900, color: '#111', margin: 0 }}>
                      {selected.complaint_type}
                    </h2>
                    <span className={`badge ${STATUS_BADGE[selected.status] ?? 'badge-open'}`}>
                      {selected.status.replace('_', ' ')}
                    </span>
                    <span style={{
                      ...s.priorityLabel,
                      ...PRIORITY_STYLE[selected.priority],
                    }}>
                      {selected.priority} priority
                    </span>
                  </div>
                  {selected.subject && (
                    <div style={{ fontSize: 14, color: '#6B7280', marginBottom: 4 }}>{selected.subject}</div>
                  )}
                  <div style={{ fontSize: 13, color: '#9CA3AF' }}>
                    Filed {new Date(selected.created_at).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
              </div>

              {/* Info grid */}
              <div style={s.section}>
                <div style={s.sectionTitle}>Complaint Details</div>
                <div style={s.infoGrid}>
                  {[
                    { label: 'Reporter',      value: (selected.profiles as any)?.full_name ?? selected.reporter_role ?? '—' },
                    { label: 'Reporter Role', value: selected.reporter_role ?? '—' },
                    { label: 'Against',       value: selected.against_name ?? '—' },
                    { label: 'Type',          value: selected.complaint_type },
                  ].map(row => (
                    <div key={row.label} style={s.infoCell}>
                      <span style={s.infoCellLabel}>{row.label}</span>
                      <span style={s.infoCellValue}>{row.value}</span>
                    </div>
                  ))}
                </div>

                <div style={s.descBox}>
                  <div style={s.descLabel}>Description</div>
                  <div style={s.descText}>{selected.description}</div>
                </div>
              </div>

              {/* Change priority */}
              {selected.status !== 'closed' && (
                <div style={s.section}>
                  <div style={s.sectionTitle}>Change Priority</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {['low', 'medium', 'high'].map((p) => {
                      const ps = PRIORITY_STYLE[p];
                      return (
                        <button key={p}
                          onClick={() => updatePriority(selected.id, p)}
                          style={{
                            padding: '7px 18px', borderRadius: 8, cursor: 'pointer',
                            border: `1.5px solid ${ps.color}`,
                            background: selected.priority === p ? ps.bg : 'white',
                            color: ps.color, fontWeight: 700, fontSize: 13,
                            transition: 'all 0.15s',
                          }}>
                          {p.charAt(0).toUpperCase() + p.slice(1)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Resolution notes */}
              <div style={s.section}>
                <div style={s.sectionTitle}>Resolution Notes</div>
                <textarea
                  style={s.textarea}
                  placeholder="Document your investigation findings and resolution steps..."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  rows={4}
                  disabled={selected.status === 'closed'}
                />
              </div>

              {/* Action buttons */}
              {selected.status !== 'closed' && (
                <div style={s.actionGrid}>
                  {selected.status === 'open' && (
                    <button className="btn btn-outline" style={{ justifyContent: 'center' }}
                      onClick={() => updateStatus(selected.id, 'in_review')} disabled={updating}>
                      🔍 Mark In Review
                    </button>
                  )}
                  {(selected.status === 'open' || selected.status === 'in_review') && (
                    <button className="btn btn-green" style={{ justifyContent: 'center' }}
                      onClick={() => updateStatus(selected.id, 'resolved')} disabled={updating}>
                      ✅ Mark Resolved
                    </button>
                  )}
                  {selected.status === 'resolved' && (
                    <button className="btn btn-black" style={{ justifyContent: 'center' }}
                      onClick={() => updateStatus(selected.id, 'closed')} disabled={updating}>
                      🔒 Close Complaint
                    </button>
                  )}
                  <button className="btn btn-red" style={{ justifyContent: 'center' }}
                    onClick={() => {
                      if (window.confirm('Escalate this complaint to admin for further review?')) {
                        updateStatus(selected.id, 'in_review');
                      }
                    }}
                    disabled={updating}>
                    ⬆️ Escalate to Admin
                  </button>
                </div>
              )}

              {/* Closed banner */}
              {selected.status === 'closed' && (
                <div style={s.closedBanner}>
                  <span style={{ fontSize: 24 }}>🔒</span>
                  <div>
                    <div style={{ fontWeight: 800, color: '#374151', marginBottom: 4 }}>Complaint Closed</div>
                    {selected.resolution_notes && (
                      <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6 }}>
                        {selected.resolution_notes}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Updating indicator */}
              {updating && (
                <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 13, marginTop: 12 }}>
                  ⏳ Saving...
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  urgentPill: {
    background: '#FEE2E2', border: '1.5px solid #FECACA',
    borderRadius: 12, padding: '10px 18px', textAlign: 'center',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
    color: '#DC2626',
  },
  splitView: { display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'start' },
  listPanel: {
    background: 'white', borderRadius: 16, border: '1px solid #E8EAED',
    overflow: 'hidden', maxHeight: 'calc(100vh - 260px)', overflowY: 'auto',
  },
  listItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '14px 16px', borderBottom: '1px solid #F3F4F6',
    cursor: 'pointer', transition: 'background 0.1s',
  },
  listItemActive: { background: '#FEF3E8', borderLeft: '3px solid #F97316' },
  listItemType: { fontSize: 14, fontWeight: 800, color: '#111', marginBottom: 2 },
  listItemSubject: { fontSize: 12, color: '#6B7280', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  listItemMeta: { display: 'flex', gap: 6, fontSize: 11, color: '#9CA3AF' },
  priorityDot: { width: 6, height: 6, borderRadius: '50%', flexShrink: 0 },
  priorityLabel: { display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 800 },

  detailPanel: {
    background: 'white', borderRadius: 16, border: '1px solid #E8EAED',
    padding: '24px', maxHeight: 'calc(100vh - 260px)', overflowY: 'auto',
  },
  detailHeader: { marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid #E5E7EB' },

  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 11, fontWeight: 800, color: '#6B7280', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 },

  infoGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden', marginBottom: 12 },
  infoCell: { display: 'flex', flexDirection: 'column', padding: '12px 16px', borderBottom: '1px solid #E5E7EB', borderRight: '1px solid #E5E7EB' },
  infoCellLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' },
  infoCellValue: { fontSize: 14, color: '#111', fontWeight: 600 },

  descBox: { background: '#F9FAFB', borderRadius: 10, padding: '14px', border: '1px solid #E5E7EB' },
  descLabel: { fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 8 },
  descText: { fontSize: 14, color: '#374151', lineHeight: 1.7 },

  textarea: {
    width: '100%', borderRadius: 10, border: '1.5px solid #E8EAED',
    padding: '12px 14px', fontSize: 14, color: '#111',
    resize: 'vertical', outline: 'none', fontFamily: 'inherit',
    background: '#F9FAFB', boxSizing: 'border-box',
  },
  actionGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  closedBanner: {
    display: 'flex', gap: 14, alignItems: 'flex-start',
    background: '#F3F4F6', borderRadius: 14, padding: '16px 18px',
    border: '1px solid #E5E7EB', marginTop: 8,
  },
};