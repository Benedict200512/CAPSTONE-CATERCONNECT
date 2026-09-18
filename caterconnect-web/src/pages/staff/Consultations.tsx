import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  MessageSquare, User, Utensils, Send, ShieldCheck, Lock, Loader2, HelpCircle,
  Clock, AlertCircle, CheckCircle2 
} from 'lucide-react';

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

  const roleConfig: Record<string, { bg: string; color: string; border: string; Icon: any }> = {
    customer: { bg: '#DBEAFE', color: '#1E40AF', border: '#BFDBFE', Icon: User },
    catereer:  { bg: '#FEF3C7', color: '#92400E', border: '#FDE68A', Icon: Utensils },
  };

  const unreadCount = consultations.filter((c) => c.status === 'open').length;

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#111', marginBottom: 6, letterSpacing: '-0.5px' }}>Consultations & Support</h1>
          <p style={{ fontSize: 15, color: '#6B7280', margin: 0 }}>Respond to customer inquiries and vendor assistance requests.</p>
        </div>
        <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 999, padding: '8px 20px', fontSize: 13, color: '#111', display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#DC2626' }} />
          {unreadCount} UNREAD INQUIRIES
        </div>
      </div>

      {/* Consistent Segmented Filter Tabs with Icons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, background: '#F3F4F6', padding: 6, borderRadius: 14, border: '1px solid #E5E7EB', width: 'fit-content', flexWrap: 'wrap' }}>
        {[
          { key: 'all', icon: MessageSquare, label: 'All Tickets', color: '#2563EB' },
          { key: 'open', icon: AlertCircle, label: 'Open', color: '#DC2626' },          // Red
          { key: 'in_review', icon: Clock, label: 'In Review', color: '#D97706' },   // Orange
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
              {tab.key === 'open' && unreadCount > 0 && (
                <span style={{ marginLeft: 4, background: '#DC2626', color: '#FFF', borderRadius: 8, padding: '2px 6px', fontSize: 11, fontWeight: 800 }}>
                  {unreadCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Split Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 24, alignItems: 'start' }}>
        
        {/* LEFT LIST PANEL */}
        <div style={{ background: '#FFFFFF', borderRadius: 20, border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', overflow: 'hidden', maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 60, textAlign: 'center', color: '#9CA3AF', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <Loader2 size={28} className="animate-spin" color="#DC2626" />
              <span style={{ fontSize: 14, fontWeight: 600 }}>Loading inbox...</span>
            </div>
          ) : consultations.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: '#9CA3AF', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <HelpCircle size={36} color="#D1D5DB" />
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#111', marginBottom: 4 }}>No {filter} consultations</div>
                <div style={{ fontSize: 13 }}>All caught up with this queue!</div>
              </div>
            </div>
          ) : (
            <div>
              {consultations.map((c) => {
                const rc = roleConfig[c.from_role ?? 'customer'] ?? roleConfig.customer;
                const RoleIcon = rc.Icon;
                const isUnread = c.status === 'open';
                const isSelected = selected?.id === c.id;

                return (
                  <div
                    key={c.id}
                    onClick={() => { setSelected(c); setReply(c.staff_reply ?? ''); }}
                    style={{ 
                      display: 'flex', alignItems: 'flex-start', gap: 14, padding: '16px 20px', borderBottom: '1px solid #F3F4F6', cursor: 'pointer', transition: 'background 0.15s',
                      background: isSelected ? '#FEF2F2' : isUnread ? '#FAFAFA' : 'transparent',
                      borderLeft: isSelected ? '4px solid #DC2626' : '4px solid transparent'
                    }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#F9FAFB'; }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = isUnread ? '#FAFAFA' : 'transparent'; }}
                  >
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: rc.bg, border: `1px solid ${rc.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <RoleIcon size={18} color={rc.color} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.from_name ?? 'Anonymous'}</div>
                        {isUnread && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#DC2626', flexShrink: 0, marginTop: 4 }} />}
                      </div>
                      <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.subject}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 8, background: rc.bg, color: rc.color, textTransform: 'uppercase' }}>
                          {c.from_role ?? 'user'}
                        </span>
                        <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 500 }}>
                          {new Date(c.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT DETAIL / REPLY PANEL */}
        <div style={{ background: '#FFFFFF', borderRadius: 20, border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', padding: 32, maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' }}>
          {!selected ? (
            <div style={{ textAlign: 'center', padding: '120px 40px', color: '#9CA3AF' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#F9FAFB', border: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <MessageSquare size={32} color="#D1D5DB" />
              </div>
              <div style={{ fontWeight: 800, color: '#111', fontSize: 18, marginBottom: 6 }}>Select an inquiry</div>
              <div style={{ fontSize: 14 }}>Choose a ticket from the left inbox panel to review message content and reply.</div>
            </div>
          ) : (
            <div>
              {/* Message Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid #E5E7EB', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  {(() => {
                    const rc = roleConfig[selected.from_role ?? 'customer'] ?? roleConfig.customer;
                    const RoleIcon = rc.Icon;
                    return (
                      <div style={{ width: 48, height: 48, borderRadius: 14, background: rc.bg, border: `1px solid ${rc.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <RoleIcon size={22} color={rc.color} />
                      </div>
                    );
                  })()}
                  <div>
                    <h2 style={{ fontSize: 20, fontWeight: 900, color: '#111', margin: '0 0 4px 0', letterSpacing: '-0.3px' }}>{selected.from_name ?? 'Anonymous'}</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 8, background: roleConfig[selected.from_role ?? 'customer']?.bg, color: roleConfig[selected.from_role ?? 'customer']?.color, textTransform: 'uppercase' }}>
                        {selected.from_role}
                      </span>
                      <span style={{ fontSize: 12, color: '#9CA3AF' }}>
                        {new Date(selected.created_at).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                </div>

                <span style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, background: selected.status === 'open' ? '#FEF2F2' : selected.status === 'resolved' ? '#DCFCE7' : '#F3F4F6', color: selected.status === 'open' ? '#991B1B' : selected.status === 'resolved' ? '#166534' : '#4B5563', border: `1px solid ${selected.status === 'open' ? '#FECACA' : selected.status === 'resolved' ? '#BBF7D0' : '#E5E7EB'}` }}>
                  {selected.status.replace('_', ' ')}
                </span>
              </div>

              {/* Subject & Body */}
              <div style={{ background: '#F9FAFB', borderRadius: 16, padding: 20, border: '1px solid #E5E7EB', marginBottom: 24 }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#111', marginBottom: 10 }}>{selected.subject}</div>
                <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{selected.message}</div>
              </div>

              {/* Previous Staff Reply */}
              {selected.staff_reply && (
                <div style={{ background: '#F0FDF4', borderRadius: 16, padding: 20, border: '1px solid #BBF7D0', marginBottom: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: 13, fontWeight: 800, color: '#166534' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><ShieldCheck size={16} /> Staff Response Log</span>
                    <span style={{ fontSize: 11, color: '#15803D', fontWeight: 600 }}>
                      {selected.replied_at ? new Date(selected.replied_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) : ''}
                    </span>
                  </div>
                  <div style={{ fontSize: 14, color: '#14532D', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{selected.staff_reply}</div>
                </div>
              )}

              {/* Reply Form */}
              {selected.status !== 'closed' && (
                <div>
                  <h4 style={{ fontSize: 12, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                    {selected.staff_reply ? 'Update Official Response' : 'Write Official Response'}
                  </h4>
                  <textarea
                    style={{ width: '100%', borderRadius: 14, border: '1px solid #E5E7EB', padding: 14, fontSize: 14, color: '#111', outline: 'none', background: '#F9FAFB', fontFamily: 'inherit', resize: 'vertical', marginBottom: 16 }}
                    placeholder="Type clear, actionable instructions or resolution details..."
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    rows={4}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {selected.status === 'open' && (
                        <button style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', color: '#111', padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                          onClick={() => updateStatus(selected.id, 'in_review')}>
                          Mark In Review
                        </button>
                      )}
                      {selected.status === 'resolved' && (
                        <button style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', color: '#111', padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                          onClick={() => updateStatus(selected.id, 'closed')}>
                          <Lock size={14} /> Close Ticket
                        </button>
                      )}
                    </div>

                    <button
                      style={{ background: '#111', color: '#FFF', border: 'none', padding: '12px 24px', borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: (sending || !reply.trim()) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: reply.trim() ? 1 : 0.6 }}
                      onClick={sendReply}
                      disabled={sending || !reply.trim()}
                    >
                      {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} 
                      {sending ? 'Sending...' : 'Send Response'}
                    </button>
                  </div>
                </div>
              )}

              {selected.status === 'closed' && (
                <div style={{ background: '#F3F4F6', border: '1px solid #E5E7EB', borderRadius: 16, padding: 20, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <Lock size={20} color="#4B5563" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontWeight: 900, color: '#111', fontSize: 15, marginBottom: 2 }}>Consultation Closed</div>
                    <div style={{ fontSize: 13, color: '#4B5563' }}>This thread has been securely archived and marked closed.</div>
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