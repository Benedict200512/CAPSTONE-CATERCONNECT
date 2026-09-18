import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  AlertTriangle, CheckCircle2, Loader2, FileText, 
  Layers, Clock, Lock 
} from 'lucide-react';

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

const PRIORITY_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  high:   { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' },
  medium: { bg: '#FEF3C7', color: '#D97706', border: '#FDE68A' },
  low:    { bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0' },
};

const STATUS_BADGE: Record<string, { bg: string; color: string; border: string }> = {
  open:       { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' },
  in_review: { bg: '#FEF3C7', color: '#D97706', border: '#FDE68A' },
  resolved:  { bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0' },
  closed:    { bg: '#F3F4F6', color: '#4B5563', border: '#E5E7EB' },
};

export default function Complaints() {
  const [complaints, setComplaints]       = useState<Complaint[]>([]);
  const [loading, setLoading]            = useState(true);
  const [filter, setFilter]              = useState('open');
  const [selected, setSelected]          = useState<Complaint | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [updating, setUpdating]          = useState(false);
  const [counts, setCounts]              = useState<Record<string, number>>({});

  const load = async () => {
    setLoading(true);

    const statuses = ['open', 'in_review', 'resolved', 'closed'];
    const countRes = await Promise.all(
      statuses.map(s =>
        supabase.from('complaints').select('id', { count: 'exact', head: true }).eq('status', s)
      )
    );
    const c: Record<string, number> = {};
    statuses.forEach((s, i) => { c[s] = countRes[i].count ?? 0; });
    setCounts(c);

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
    <div style={{ paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#111', marginBottom: 6, letterSpacing: '-0.5px' }}>Complaints & Disputes</h1>
          <p style={{ fontSize: 15, color: '#6B7280', margin: 0 }}>Investigate, prioritize, and resolve platform disputes between users.</p>
        </div>
        <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 999, padding: '8px 20px', fontSize: 13, color: '#111', display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#DC2626' }} />
          {totalOpen} ACTIVE DISPUTES
        </div>
      </div>

      {/* Consistent Segmented Filter Tabs with Icons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, background: '#F3F4F6', padding: 6, borderRadius: 14, border: '1px solid #E5E7EB', width: 'fit-content', flexWrap: 'wrap' }}>
        {[
          { key: 'all', icon: Layers, label: 'All Tickets', color: '#2563EB' },
          { key: 'open', icon: AlertTriangle, label: 'Open', color: '#DC2626' },
          { key: 'in_review', icon: Clock, label: 'In Review', color: '#D97706' },
          { key: 'resolved', icon: CheckCircle2, label: 'Resolved', color: '#16A34A' },
          { key: 'closed', icon: Lock, label: 'Closed', color: '#4B5563' },
        ].map((tab) => {
          const TabIcon = tab.icon;
          const isActive = filter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => { setFilter(tab.key); setSelected(null); }}
              style={{ 
                padding: '10px 20px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s', textTransform: 'capitalize',
                background: isActive ? '#FFFFFF' : 'transparent',
                color: isActive ? '#111' : '#6B7280',
                boxShadow: isActive ? '0 2px 4px rgba(0,0,0,0.04)' : 'none'
              }}
            >
              <TabIcon size={16} color={tab.color} />
              {tab.label}
              {counts[tab.key] !== undefined && counts[tab.key] > 0 && (
                <span style={{ marginLeft: 4, background: isActive ? '#111' : '#E5E7EB', color: isActive ? '#FFF' : '#4B5563', borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 800 }}>
                  {counts[tab.key]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 24, alignItems: 'start' }}>
        {/* LEFT LIST PANEL */}
        <div style={{ background: '#FFFFFF', borderRadius: 20, border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', overflow: 'hidden', maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 60, textAlign: 'center', color: '#9CA3AF', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <Loader2 size={28} className="animate-spin" color="#F97316" />
              <span style={{ fontSize: 14, fontWeight: 600 }}>Loading tickets...</span>
            </div>
          ) : complaints.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: '#9CA3AF' }}>
              <CheckCircle2 size={36} color="#16A34A" style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 16, fontWeight: 800, color: '#111', marginBottom: 4 }}>All clear!</div>
              <div style={{ fontSize: 13 }}>No complaints match this filter.</div>
            </div>
          ) : (
            <div>
              {complaints.map((c) => {
                const ps = PRIORITY_STYLE[c.priority] ?? PRIORITY_STYLE.medium;
                const bs = STATUS_BADGE[c.status] ?? STATUS_BADGE.open;
                const isActive = selected?.id === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => { setSelected(c); setResolutionNotes(c.resolution_notes ?? ''); }}
                    style={{ 
                      padding: '16px 20px', borderBottom: '1px solid #F3F4F6', cursor: 'pointer', transition: 'background 0.15s',
                      background: isActive ? '#FFF7ED' : 'transparent',
                      borderLeft: isActive ? '4px solid #F97316' : '4px solid transparent'
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#F9FAFB'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 800, background: ps.bg, color: ps.color, border: `1px solid ${ps.border}`, textTransform: 'uppercase' }}>
                        {c.priority}
                      </span>
                      <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 800, background: bs.bg, color: bs.color, border: `1px solid ${bs.border}`, textTransform: 'capitalize' }}>
                        {c.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#111', marginBottom: 2 }}>{c.complaint_type}</div>
                    {c.subject && (
                      <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.subject}</div>
                    )}
                    <div style={{ fontSize: 12, color: '#9CA3AF', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Against: {c.against_name ?? '—'}</span>
                      <span>{new Date(c.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT DETAIL PANEL */}
        <div style={{ background: '#FFFFFF', borderRadius: 20, border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', padding: 32, maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' }}>
          {!selected ? (
            <div style={{ textAlign: 'center', padding: '120px 40px', color: '#9CA3AF' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#F9FAFB', border: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <AlertTriangle size={32} color="#D1D5DB" />
              </div>
              <div style={{ fontWeight: 800, color: '#111', fontSize: 18, marginBottom: 6 }}>Select a complaint ticket</div>
              <div style={{ fontSize: 14 }}>Click a dispute from the list to review evidence and apply resolution notes.</div>
            </div>
          ) : (
            <div>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid #E5E7EB' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: 22, fontWeight: 900, color: '#111', margin: 0 }}>{selected.complaint_type}</h2>
                    <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 800, background: STATUS_BADGE[selected.status]?.bg, color: STATUS_BADGE[selected.status]?.color, border: `1px solid ${STATUS_BADGE[selected.status]?.border}`, textTransform: 'capitalize' }}>
                      {selected.status.replace('_', ' ')}
                    </span>
                  </div>
                  {selected.subject && <div style={{ fontSize: 14, color: '#4B5563', marginBottom: 4, fontWeight: 600 }}>{selected.subject}</div>}
                  <div style={{ fontSize: 12, color: '#9CA3AF' }}>Filed on {new Date(selected.created_at).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
                </div>
              </div>

              {/* Info Grid */}
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ fontSize: 12, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Case Metadata</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, background: '#F9FAFB', borderRadius: 16, padding: 16, border: '1px solid #E5E7EB' }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase' }}>Reporter</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{(selected.profiles as any)?.full_name ?? selected.reporter_role ?? '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase' }}>Respondent / Against</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{selected.against_name ?? '—'}</div>
                  </div>
                </div>
                <div style={{ marginTop: 12, background: '#FFFFFF', borderRadius: 14, padding: 16, border: '1px solid #E5E7EB' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Incident Description</div>
                  <div style={{ fontSize: 14, color: '#4B5563', lineHeight: 1.6 }}>{selected.description}</div>
                </div>
              </div>

              {/* Priority Control */}
              {selected.status !== 'closed' && (
                <div style={{ marginBottom: 24 }}>
                  <h4 style={{ fontSize: 12, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Adjust Priority Level</h4>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {['low', 'medium', 'high'].map((p) => {
                      const ps = PRIORITY_STYLE[p];
                      return (
                        <button key={p}
                          onClick={() => updatePriority(selected.id, p)}
                          style={{
                            flex: 1, padding: '10px', borderRadius: 10, cursor: 'pointer',
                            border: `1px solid ${selected.priority === p ? ps.color : '#E5E7EB'}`,
                            background: selected.priority === p ? ps.bg : '#FFF',
                            color: ps.color, fontWeight: 800, fontSize: 13, textTransform: 'capitalize',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                          }}>
                          {p}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Resolution Notes */}
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ fontSize: 12, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Resolution Log & Findings</h4>
                <textarea
                  style={{ width: '100%', borderRadius: 14, border: '1px solid #E5E7EB', padding: 14, fontSize: 14, color: '#111', outline: 'none', background: '#F9FAFB', fontFamily: 'inherit', resize: 'vertical' }}
                  placeholder="Document investigation steps, communications, and final outcome..."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  rows={4}
                  disabled={selected.status === 'closed'}
                />
              </div>

              {/* Action Buttons */}
              {selected.status !== 'closed' && (
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {selected.status === 'open' && (
                    <button style={{ flex: 1, padding: '14px', background: '#2563EB', color: '#FFF', border: 'none', borderRadius: 14, fontWeight: 800, cursor: updating ? 'not-allowed' : 'pointer' }}
                      onClick={() => updateStatus(selected.id, 'in_review')} disabled={updating}>
                      Mark In Review
                    </button>
                  )}
                  {(selected.status === 'open' || selected.status === 'in_review') && (
                    <button style={{ flex: 1, padding: '14px', background: '#16A34A', color: '#FFF', border: 'none', borderRadius: 14, fontWeight: 800, cursor: updating ? 'not-allowed' : 'pointer' }}
                      onClick={() => updateStatus(selected.id, 'resolved')} disabled={updating}>
                      Mark Resolved
                    </button>
                  )}
                  {selected.status === 'resolved' && (
                    <button style={{ flex: 1, padding: '14px', background: '#111', color: '#FFF', border: 'none', borderRadius: 14, fontWeight: 800, cursor: updating ? 'not-allowed' : 'pointer' }}
                      onClick={() => updateStatus(selected.id, 'closed')} disabled={updating}>
                      Close Ticket
                    </button>
                  )}
                </div>
              )}

              {selected.status === 'closed' && (
                <div style={{ background: '#F3F4F6', border: '1px solid #E5E7EB', borderRadius: 16, padding: 20, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <FileText size={24} color="#4B5563" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontWeight: 900, color: '#111', fontSize: 15, marginBottom: 4 }}>Ticket Closed</div>
                    {selected.resolution_notes && (
                      <div style={{ fontSize: 13, color: '#4B5563', lineHeight: 1.6 }}>{selected.resolution_notes}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}