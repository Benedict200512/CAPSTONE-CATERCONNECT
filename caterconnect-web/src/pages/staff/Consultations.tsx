import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

type Consultation = {
  id: string;
  from_name: string | null;
  from_role: string | null;
  subject: string;
  message: string;
  status: string;
  staff_reply: string | null;
  replied_at: string | null;
  created_at: string;
};

export default function Consultations() {
  const { profile } = useAuth();
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('open');
  const [selected, setSelected] = useState<Consultation | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const load = async () => {
    setLoading(true);
    let query = supabase.from('consultations').select('*').order('created_at', { ascending: false });
    if (filter !== 'all') query = query.eq('status', filter);
    const { data } = await query;
    setConsultations(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const sendReply = async () => {
    if (!selected || !reply.trim()) return;
    setSending(true);
    await supabase.from('consultations').update({
      staff_reply: reply,
      replied_at: new Date().toISOString(),
      status: 'resolved',
      updated_at: new Date().toISOString(),
    }).eq('id', selected.id);
    setSending(false);
    setReply('');
    setSelected(null);
    load();
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('consultations').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    setSelected(null);
    load();
  };

  const roleColors: Record<string, { bg: string; color: string; icon: string }> = {
    customer: { bg: '#DBEAFE', color: '#1E40AF', icon: '👤' },
    caterer:  { bg: '#FEF3C7', color: '#92400E', icon: '🍽️' },
  };

  return (
    <div>
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.pageTitle}>Consultations</h1>
          <p style={styles.pageSub}>Respond to customer and caterer inquiries and support requests</p>
        </div>
        <div style={styles.inboxSummary}>
          <span style={styles.inboxCount}>
            {consultations.filter((c) => c.status === 'open').length}
          </span>
          <span style={styles.inboxLabel}>unread</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        {[
          { key: 'all', label: 'All', icon: '📋' },
          { key: 'open', label: 'Open', icon: '📬' },
          { key: 'in_review', label: 'In Review', icon: '🔍' },
          { key: 'resolved', label: 'Resolved', icon: '✅' },
          { key: 'closed', label: 'Closed', icon: '🔒' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setFilter(tab.key); setSelected(null); }}
            style={{ ...styles.tab, ...(filter === tab.key ? styles.tabActive : {}) }}
          >
            {tab.icon} {tab.label}
            {tab.key === 'open' && consultations.filter(c => c.status === 'open').length > 0 && (
              <span style={styles.tabBadge}>
                {consultations.filter(c => c.status === 'open').length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div style={styles.splitView}>
        {/* List */}
        <div style={styles.listPanel}>
          {loading ? (
            <div style={styles.empty}>⏳ Loading consultations...</div>
          ) : consultations.length === 0 ? (
            <div style={styles.empty}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
              <div>No {filter} consultations</div>
            </div>
          ) : (
            consultations.map((c) => {
              const rs = roleColors[c.from_role ?? 'customer'] ?? roleColors.customer;
              const isUnread = c.status === 'open';
              return (
                <div
                  key={c.id}
                  onClick={() => { setSelected(c); setReply(c.staff_reply ?? ''); }}
                  style={{ ...styles.listItem, ...(selected?.id === c.id ? styles.listItemActive : {}), ...(isUnread ? styles.listItemUnread : {}) }}
                >
                  <div style={{ ...styles.listAvatar, background: rs.bg }}>
                    <span style={{ fontSize: 18 }}>{rs.icon}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={styles.listItemName}>{c.from_name ?? 'Anonymous'}</div>
                      {isUnread && <div style={styles.unreadDot} />}
                    </div>
                    <div style={styles.listItemSubject}>{c.subject}</div>
                    <div style={styles.listItemMeta}>
                      <span style={{ ...styles.roleBadge, background: rs.bg, color: rs.color }}>{c.from_role}</span>
                      <span style={styles.listItemDate}>{new Date(c.created_at).toLocaleDateString('en-PH')}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Detail / Reply */}
        <div style={styles.detailPanel}>
          {!selected ? (
            <div style={styles.noSelection}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>💬</div>
              <div style={{ fontWeight: 700, color: '#111', marginBottom: 6 }}>Select a consultation</div>
              <div style={{ fontSize: 13, color: '#9CA3AF' }}>Click a message from the inbox to read and reply</div>
            </div>
          ) : (
            <div>
              {/* Message header */}
              <div style={styles.detailHeader}>
                {(() => {
                  const rs = roleColors[selected.from_role ?? 'customer'] ?? roleColors.customer;
                  return (
                    <div style={{ ...styles.detailAvatar, background: rs.bg }}>
                      <span style={{ fontSize: 22 }}>{rs.icon}</span>
                    </div>
                  );
                })()}
                <div style={{ flex: 1 }}>
                  <h2 style={styles.detailName}>{selected.from_name ?? 'Anonymous'}</h2>
                  <div style={styles.detailMeta}>
                    <span style={{ ...styles.roleBadge, ...((roleColors[selected.from_role ?? 'customer'] ?? roleColors.customer)) }}>
                      {selected.from_role}
                    </span>
                    <span style={{ fontSize: 12, color: '#9CA3AF' }}>
                      {new Date(selected.created_at).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                </div>
                <span className={`badge badge-${selected.status === 'open' ? 'open' : selected.status === 'resolved' ? 'resolved' : selected.status === 'in_review' ? 'review' : 'closed'}`}>
                  {selected.status.replace('_', ' ')}
                </span>
              </div>

              {/* Subject & message */}
              <div style={styles.messageBox}>
                <div style={styles.messageSubject}>{selected.subject}</div>
                <div style={styles.messageBody}>{selected.message}</div>
              </div>

              {/* Previous reply (if any) */}
              {selected.staff_reply && (
                <div style={styles.prevReplyBox}>
                  <div style={styles.prevReplyHeader}>
                    <span>👷 Staff Reply</span>
                    <span style={{ fontSize: 12, color: '#6B7280' }}>
                      {selected.replied_at ? new Date(selected.replied_at).toLocaleDateString('en-PH') : ''}
                    </span>
                  </div>
                  <div style={styles.prevReplyText}>{selected.staff_reply}</div>
                </div>
              )}

              {/* Reply box */}
              {selected.status !== 'closed' && (
                <div style={styles.replySection}>
                  <div style={styles.sectionTitle}>
                    {selected.staff_reply ? 'Update Reply' : 'Write Reply'}
                  </div>
                  <textarea
                    style={styles.textarea}
                    placeholder="Type your response to this inquiry..."
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    rows={5}
                  />
                  <div style={styles.replyActions}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {selected.status === 'open' && (
                        <button className="btn btn-outline btn-sm"
                          onClick={() => updateStatus(selected.id, 'in_review')}>
                          🔍 Mark In Review
                        </button>
                      )}
                      {selected.status === 'resolved' && (
                        <button className="btn btn-outline btn-sm"
                          onClick={() => updateStatus(selected.id, 'closed')}>
                          🔒 Close
                        </button>
                      )}
                    </div>
                    <button
                      className="btn btn-primary"
                      onClick={sendReply}
                      disabled={sending || !reply.trim()}
                    >
                      {sending ? '⏳ Sending...' : '📤 Send Reply'}
                    </button>
                  </div>
                </div>
              )}

              {selected.status === 'closed' && (
                <div style={styles.closedBanner}>
                  <span>🔒</span>
                  <div>
                    <div style={{ fontWeight: 800 }}>Consultation Closed</div>
                    <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>This consultation has been closed and no further replies are needed.</div>
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

const styles: Record<string, React.CSSProperties> = {
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  pageTitle: { fontSize: 26, fontWeight: 900, color: '#111', marginBottom: 4 },
  pageSub: { fontSize: 14, color: '#6B7280' },
  inboxSummary: { background: '#FEF3E8', borderRadius: 12, padding: '10px 20px', textAlign: 'center', border: '1px solid #FFB26B' },
  inboxCount: { display: 'block', fontSize: 28, fontWeight: 900, color: '#F97316' },
  inboxLabel: { fontSize: 12, color: '#92400E', fontWeight: 700 },
  tabs: { display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
  tab: { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: '1.5px solid #E8EAED', background: 'white', fontSize: 13, fontWeight: 700, color: '#6B7280', cursor: 'pointer', transition: 'all 0.15s' },
  tabActive: { background: '#111', color: 'white', border: '1.5px solid #111' },
  tabBadge: { background: '#F97316', color: 'white', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 900 },
  splitView: { display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'start' },
  listPanel: { background: 'white', borderRadius: 16, border: '1px solid #E8EAED', overflow: 'hidden', maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' },
  listItem: { display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', borderBottom: '1px solid #F3F4F6', cursor: 'pointer', transition: 'background 0.1s' },
  listItemActive: { background: '#FEF3E8', borderLeft: '3px solid #F97316' },
  listItemUnread: { background: '#FAFBFC' },
  listAvatar: { width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  listItemName: { fontSize: 14, fontWeight: 800, color: '#111', marginBottom: 2 },
  listItemSubject: { fontSize: 12, color: '#6B7280', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  listItemMeta: { display: 'flex', alignItems: 'center', gap: 8 },
  listItemDate: { fontSize: 11, color: '#9CA3AF' },
  roleBadge: { display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 800 },
  unreadDot: { width: 8, height: 8, borderRadius: '50%', background: '#F97316', flexShrink: 0, marginTop: 4 },
  empty: { padding: '48px 24px', textAlign: 'center', color: '#9CA3AF', fontSize: 14 },
  detailPanel: { background: 'white', borderRadius: 16, border: '1px solid #E8EAED', padding: '24px', maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' },
  noSelection: { textAlign: 'center', padding: '80px 40px', color: '#9CA3AF' },
  detailHeader: { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid #E5E7EB' },
  detailAvatar: { width: 48, height: 48, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  detailName: { fontSize: 18, fontWeight: 900, color: '#111', marginBottom: 4 },
  detailMeta: { display: 'flex', alignItems: 'center', gap: 10 },
  messageBox: { background: '#F9FAFB', borderRadius: 14, padding: '18px', marginBottom: 16, border: '1px solid #E5E7EB' },
  messageSubject: { fontSize: 16, fontWeight: 800, color: '#111', marginBottom: 10 },
  messageBody: { fontSize: 14, color: '#374151', lineHeight: 1.7 },
  prevReplyBox: { background: '#EFF6FF', borderRadius: 14, padding: '16px', marginBottom: 16, border: '1px solid #BFDBFE' },
  prevReplyHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: 13, fontWeight: 800, color: '#1E40AF' },
  prevReplyText: { fontSize: 14, color: '#1E3A8A', lineHeight: 1.7 },
  replySection: { marginTop: 8 },
  sectionTitle: { fontSize: 11, fontWeight: 800, color: '#6B7280', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 },
  textarea: { width: '100%', borderRadius: 10, border: '1.5px solid #E8EAED', padding: '12px 14px', fontSize: 14, color: '#111', resize: 'vertical', outline: 'none', fontFamily: 'inherit', background: '#F9FAFB', boxSizing: 'border-box', marginBottom: 12 },
  replyActions: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  closedBanner: { display: 'flex', gap: 12, alignItems: 'flex-start', background: '#F3F4F6', borderRadius: 12, padding: '14px 16px', border: '1px solid #E5E7EB', fontSize: 14, color: '#374151', marginTop: 16 },
};