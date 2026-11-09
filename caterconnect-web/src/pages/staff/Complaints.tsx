import './StaffUnified.css';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  FileText,
  Layers,
  Clock,
  Lock,
  RefreshCcw,
  User,
  Calendar,
  Tag,
  AlignLeft,
  Play,
} from 'lucide-react';

type Complaint = {
  id: string;
  reporter_id: string | null;
  reporter_role: string | null;
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

const PRIORITY_STYLE: Record<
  string,
  { bg: string; color: string; border: string }
> = {
  high: { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' },
  medium: { bg: '#FEF3C7', color: '#D97706', border: '#FDE68A' },
  low: { bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0' },
};

const STATUS_BADGE: Record<
  string,
  { bg: string; color: string; border: string }
> = {
  open: { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' },
  in_review: { bg: '#FEF3C7', color: '#D97706', border: '#FDE68A' },
  resolved: { bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0' },
  closed: { bg: '#F3F4F6', color: '#4B5563', border: '#E5E7EB' },
};

const TABS = [
  { key: 'all', icon: Layers, label: 'All Tickets', color: '#2563EB' },
  { key: 'open', icon: AlertTriangle, label: 'Open', color: '#DC2626' },
  { key: 'in_review', icon: Clock, label: 'In Review', color: '#D97706' },
  { key: 'resolved', icon: CheckCircle2, label: 'Resolved', color: '#16A34A' },
  { key: 'closed', icon: Lock, label: 'Closed', color: '#4B5563' },
];

export default function Complaints() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('open');
  const [selected, setSelected] = useState<Complaint | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [updating, setUpdating] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [errorMessage, setErrorMessage] = useState('');

  const load = async () => {
    setLoading(true);

    try {
      const statuses = ['open', 'in_review', 'resolved', 'closed'];

      const countRes = await Promise.all(
        statuses.map((s) =>
          supabase
            .from('complaints')
            .select('id', { count: 'exact', head: true })
            .eq('status', s)
        )
      );

      const countError = countRes.find((result) => result.error)?.error;
      if (countError) throw countError;

      const c: Record<string, number> = {};

      statuses.forEach((status, i) => {
        c[status] = countRes[i].count ?? 0;
      });

      setCounts(c);

      let query = supabase
        .from('complaints')
        .select(
          `*, profiles:profiles!complaints_reporter_id_fkey(full_name, email)`
        )
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) throw error;

      setComplaints((data ?? []) as Complaint[]);
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to load support tickets.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [filter]);

  const updateStatus = async (id: string, status: string) => {
    if (updating) return;

    setUpdating(true);
    setErrorMessage('');

    try {
      const { data, error } = await supabase
        .from('complaints')
        .update({
          status,
          resolution_notes: resolutionNotes.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('status', selected?.status ?? '')
        .select('id');

      if (error) throw error;

      if (data?.length !== 1) {
        throw new Error(
          'The ticket was changed or you do not have permission. Refresh and try again.'
        );
      }

      setSelected(null);
      setResolutionNotes('');
      await load();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to update ticket status.'
      );
    } finally {
      setUpdating(false);
    }
  };

  const updatePriority = async (id: string, priority: string) => {
    if (updating) return;

    setUpdating(true);
    setErrorMessage('');

    try {
      const { data, error } = await supabase
        .from('complaints')
        .update({
          priority,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('priority', selected?.priority ?? '')
        .select('id');

      if (error) throw error;

      if (data?.length !== 1) {
        throw new Error(
          'The ticket was changed or you do not have permission. Refresh and try again.'
        );
      }

      setSelected((previous) =>
        previous?.id === id ? { ...previous, priority } : previous
      );

      await load();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to update priority.'
      );
    } finally {
      setUpdating(false);
    }
  };

  const totalOpen = counts.open ?? 0;

  return (
    <div className="complaints-page cc-staff-unified">
      <style>{`
        .complaints-page {
          width: 100%;
          min-width: 0;
          padding-bottom: 40px;
          color: #111827;
          /* Let the Staff dashboard's main content handle page scrolling.
             Avoid a second scrollbar inside the Complaints page. */
          height: auto;
          min-height: 0;
          overflow: visible;
        }

        .complaints-page *,
        .complaints-page *::before,
        .complaints-page *::after {
          box-sizing: border-box;
        }

        .complaints-error {
          margin-bottom: 20px;
          padding: 12px 16px;
          border-radius: 12px;
          background: #FEF2F2;
          border: 1px solid #FECACA;
          color: #B91C1C;
          font-size: 13px;
          font-weight: 600;
          overflow-wrap: anywhere;
        }

        .complaints-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 16px;
          margin-bottom: 28px;
        }

        .complaints-header h1 {
          margin: 0 0 6px;
          font-size: 28px;
          line-height: 1.2;
          font-weight: 900;
          color: #111;
          letter-spacing: -0.5px;
        }

        .complaints-header p {
          margin: 0;
          color: #6B7280;
          font-size: 15px;
          line-height: 1.5;
        }

        .complaints-header-actions {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
        }

        .complaints-refresh {
          width: 42px;
          height: 42px;
          min-width: 42px;
          border-radius: 50%;
          border: 1px solid #E5E7EB;
          background: #FFFFFF;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.02);
        }

        .complaints-refresh:disabled {
          cursor: default;
          opacity: 0.7;
        }

        .complaints-open-count {
          background: #FFFFFF;
          border: 1px solid #E5E7EB;
          border-radius: 999px;
          padding: 10px 18px;
          font-size: 12px;
          color: #111;
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 800;
          white-space: nowrap;
          box-shadow: 0 2px 4px rgba(0,0,0,0.02);
        }

        .complaints-open-dot {
          width: 8px;
          height: 8px;
          flex-shrink: 0;
          border-radius: 50%;
          background: #DC2626;
        }

        .complaints-tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 24px;
          background: #F3F4F6;
          padding: 6px;
          border-radius: 14px;
          border: 1px solid #E5E7EB;
          width: fit-content;
          max-width: 100%;
        }

        .complaints-tab {
          min-height: 42px;
          padding: 10px 16px;
          border-radius: 10px;
          border: none;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: background 0.2s, color 0.2s;
          white-space: nowrap;
          background: transparent;
          color: #6B7280;
        }

        .complaints-tab.active {
          background: #FFFFFF;
          color: #111;
          box-shadow: 0 2px 4px rgba(0,0,0,0.04);
        }

        .complaints-tab-count {
          margin-left: 2px;
          border-radius: 10px;
          padding: 2px 8px;
          font-size: 11px;
          font-weight: 800;
          background: #E5E7EB;
          color: #4B5563;
        }

        .complaints-tab.active .complaints-tab-count {
          background: #111;
          color: #FFF;
        }

        .complaints-workspace {
          display: grid;
          grid-template-columns: minmax(300px, 380px) minmax(0, 1fr);
          gap: 20px;
          align-items: start;
          min-width: 0;
        }

        .complaints-list-panel,
        .complaints-detail-panel {
          background: #FFFFFF;
          border-radius: 20px;
          border: 1px solid #E5E7EB;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);
          min-width: 0;
          overflow: hidden;
        }

        .complaints-list-panel {
          /* Content contributes to the page height; no trapped nested scrollbar. */
          overflow: visible;
        }

        .complaints-detail-panel {
          padding: 28px;
          overflow: visible;
        }

        .complaints-loading,
        .complaints-empty-list {
          padding: 60px 24px;
          text-align: center;
          color: #9CA3AF;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        .complaints-empty-list {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 240px;
          width: 100%;
          gap: 8px;
        }

        .complaints-empty-list svg {
          display: block;
          flex-shrink: 0;
          margin: 0 auto 8px;
        }

        .complaint-list-item {
          padding: 16px 18px;
          border-bottom: 1px solid #F3F4F6;
          border-left: 4px solid transparent;
          cursor: pointer;
          transition: background 0.15s;
          min-width: 0;
        }

        .complaint-list-item:hover {
          background: #F9FAFB;
        }

        .complaint-list-item.active {
          background: #FFF7ED;
          border-left-color: #F97316;
        }

        .complaint-list-badges {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 8px;
        }

        .complaint-priority-badge,
        .complaint-status-badge {
          display: inline-flex;
          align-items: center;
          padding: 3px 8px;
          border-radius: 10px;
          font-size: 10px;
          line-height: 1.4;
          font-weight: 800;
          text-transform: uppercase;
        }

        .complaint-list-type {
          font-size: 15px;
          line-height: 1.4;
          font-weight: 800;
          color: #111;
          margin-bottom: 2px;
          overflow-wrap: anywhere;
        }

        .complaint-list-subject {
          font-size: 13px;
          color: #6B7280;
          margin-bottom: 8px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .complaint-list-meta {
          font-size: 12px;
          color: #9CA3AF;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
        }

        .complaint-list-meta span {
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .complaints-no-selection {
          text-align: center;
          padding: 100px 32px;
          color: #9CA3AF;
        }

        .complaints-no-selection-icon {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: #F9FAFB;
          border: 1px solid #E5E7EB;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
        }

        .complaints-no-selection h3 {
          font-size: 18px;
          font-weight: 800;
          color: #111;
          margin: 0 0 6px;
        }

        .complaints-no-selection p {
          font-size: 14px;
          line-height: 1.6;
          margin: 0;
        }

        .complaints-detail-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 24px;
          padding-bottom: 20px;
          border-bottom: 1px solid #E5E7EB;
        }

        .complaints-detail-heading {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 8px;
        }

        .complaints-detail-heading h2 {
          font-size: 22px;
          line-height: 1.3;
          font-weight: 900;
          color: #111;
          margin: 0;
          overflow-wrap: anywhere;
        }

        .complaints-detail-status {
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 800;
          text-transform: capitalize;
          white-space: nowrap;
        }

        .complaints-detail-subject {
          font-size: 14px;
          color: #4B5563;
          margin-bottom: 6px;
          font-weight: 600;
          overflow-wrap: anywhere;
        }

        .complaints-filed-date {
          font-size: 12px;
          color: #9CA3AF;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .complaints-section {
          margin-bottom: 24px;
          min-width: 0;
        }

        .complaints-section-title {
          font-size: 12px;
          font-weight: 800;
          color: #9CA3AF;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin: 0 0 12px;
        }

        .complaints-metadata-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          background: #F9FAFB;
          border-radius: 16px;
          padding: 16px;
          border: 1px solid #E5E7EB;
        }

        .complaints-metadata-label {
          font-size: 11px;
          color: #9CA3AF;
          font-weight: 700;
          text-transform: uppercase;
          display: flex;
          align-items: center;
          gap: 4px;
          margin-bottom: 5px;
        }

        .complaints-metadata-value {
          font-size: 14px;
          font-weight: 700;
          color: #111;
          overflow-wrap: anywhere;
        }

        .complaints-description-card {
          margin-top: 12px;
          background: #FFFFFF;
          border-radius: 14px;
          padding: 16px;
          border: 1px solid #E5E7EB;
        }

        .complaints-description-text {
          font-size: 14px;
          color: #4B5563;
          line-height: 1.7;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }

        .complaints-priority-options {
          display: flex;
          gap: 10px;
        }

        .complaints-priority-button {
          flex: 1;
          min-height: 42px;
          padding: 10px;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 800;
          font-size: 13px;
          text-transform: capitalize;
          box-shadow: 0 1px 2px rgba(0,0,0,0.02);
        }

        .complaints-priority-button:disabled,
        .complaints-action-button:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }

        .complaints-notes {
          width: 100%;
          min-height: 110px;
          border-radius: 14px;
          border: 1px solid #E5E7EB;
          padding: 14px;
          font-size: 14px;
          line-height: 1.6;
          color: #111;
          outline: none;
          background: #F9FAFB;
          font-family: inherit;
          resize: vertical;
        }

        .complaints-notes:focus {
          border-color: #F97316;
          box-shadow: 0 0 0 3px rgba(249,115,22,0.1);
        }

        .complaints-notes:disabled {
          cursor: not-allowed;
          opacity: 0.7;
        }

        .complaints-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .complaints-action-button {
          flex: 1;
          min-width: 180px;
          min-height: 48px;
          padding: 13px 16px;
          color: #FFF;
          border: none;
          border-radius: 14px;
          font-weight: 800;
          font-size: 13px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .complaints-closed-card {
          background: #F3F4F6;
          border: 1px solid #E5E7EB;
          border-radius: 16px;
          padding: 20px;
          display: flex;
          align-items: flex-start;
          gap: 14px;
        }

        .complaints-closed-card svg {
          flex-shrink: 0;
          margin-top: 2px;
        }

        .complaints-closed-title {
          font-weight: 900;
          color: #111;
          font-size: 15px;
          margin-bottom: 4px;
        }

        .complaints-closed-notes {
          font-size: 13px;
          color: #4B5563;
          line-height: 1.6;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }

        @media (max-width: 1100px) {
          .complaints-workspace {
            grid-template-columns: minmax(0, 1fr);
          }

          .complaints-list-panel,
          .complaints-detail-panel {
            max-height: none;
          }
        }

        @media (max-width: 768px) {
          .complaints-page {
            padding-bottom: 24px;
          }

          .complaints-header {
            align-items: flex-start;
            flex-direction: column;
            margin-bottom: 22px;
          }

          .complaints-header h1 {
            font-size: 24px;
          }

          .complaints-header p {
            font-size: 14px;
          }

          .complaints-header-actions {
            width: 100%;
            justify-content: space-between;
          }

          .complaints-tabs {
            width: 100%;
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 6px;
            margin-bottom: 18px;
          }

          .complaints-tab {
            width: 100%;
            padding: 10px 8px;
            font-size: 12px;
            justify-content: flex-start;
          }

          .complaints-workspace {
            gap: 16px;
          }

          .complaints-list-panel {
            border-radius: 16px;
          }

          .complaints-detail-panel {
            padding: 20px;
            border-radius: 16px;
          }

          .complaints-no-selection {
            padding: 60px 20px;
          }

          .complaints-detail-heading h2 {
            font-size: 20px;
          }
        }

        @media (max-width: 480px) {
          .complaints-header h1 {
            font-size: 21px;
          }

          .complaints-open-count {
            padding: 9px 12px;
            font-size: 11px;
          }

          .complaints-tabs {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .complaints-tab {
            gap: 6px;
            font-size: 11px;
          }

          .complaints-tab svg {
            width: 14px;
            height: 14px;
            flex-shrink: 0;
          }

          .complaint-list-item {
            padding: 14px 12px;
          }

          .complaint-list-type {
            font-size: 14px;
          }

          .complaint-list-meta {
            font-size: 11px;
          }

          .complaints-detail-panel {
            padding: 16px;
          }

          .complaints-detail-header {
            margin-bottom: 20px;
            padding-bottom: 16px;
          }

          .complaints-detail-heading h2 {
            font-size: 18px;
          }

          .complaints-metadata-grid {
            grid-template-columns: minmax(0, 1fr);
            gap: 14px;
            padding: 14px;
          }

          .complaints-description-card {
            padding: 14px;
          }

          .complaints-priority-options {
            gap: 6px;
          }

          .complaints-priority-button {
            padding: 9px 6px;
            font-size: 12px;
          }

          .complaints-actions {
            flex-direction: column;
          }

          .complaints-action-button {
            width: 100%;
            min-width: 0;
          }

          .complaints-closed-card {
            padding: 16px;
          }
        }
      `}</style>

      {errorMessage && (
        <div className="complaints-error" role="alert">
          {errorMessage}
        </div>
      )}

      {/* Header */}
      <div className="complaints-header">
        <div>
          <h1>Technical Support & Complaints</h1>
          <p>
            Review and resolve system issues reported by customers and caterers.
          </p>
        </div>

        <div className="complaints-header-actions">
          <button
            className="complaints-refresh"
            onClick={() => {
              setSelected(null);
              load();
            }}
            disabled={loading}
            title="Refresh tickets"
            aria-label="Refresh tickets"
          >
            <RefreshCcw
              size={18}
              color="#111"
              className={loading ? 'animate-spin' : ''}
            />
          </button>

          <div className="complaints-open-count">
            <span className="complaints-open-dot" />
            {totalOpen} OPEN SUPPORT TICKETS
          </div>
        </div>
      </div>

      {/* Status Filters */}
      <div className="complaints-tabs">
        {TABS.map((tab) => {
          const TabIcon = tab.icon;
          const isActive = filter === tab.key;

          return (
            <button
              key={tab.key}
              className={`complaints-tab ${isActive ? 'active' : ''}`}
              onClick={() => {
                setFilter(tab.key);
                setSelected(null);
              }}
            >
              <TabIcon size={16} color={tab.color} />

              {tab.label}

              {counts[tab.key] !== undefined && counts[tab.key] > 0 && (
                <span className="complaints-tab-count">
                  {counts[tab.key]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Complaint List and Detail */}
      <div className="complaints-workspace">
        {/* LEFT: Complaint List */}
        <div className="complaints-list-panel">
          {loading ? (
            <div className="complaints-loading">
              <Loader2
                size={28}
                className="animate-spin"
                color="#F97316"
              />
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                Loading tickets...
              </span>
            </div>
          ) : complaints.length === 0 ? (
            <div className="complaints-empty-list">
              <CheckCircle2
                size={36}
                color="#16A34A"
                style={{ marginBottom: 12 }}
              />
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: '#111',
                  marginBottom: 4,
                }}
              >
                All clear!
              </div>
              <div style={{ fontSize: 13 }}>
                No complaints match this filter.
              </div>
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
                    className={`complaint-list-item ${
                      isActive ? 'active' : ''
                    }`}
                    onClick={() => {
                      setSelected(c);
                      setResolutionNotes(c.resolution_notes ?? '');
                    }}
                  >
                    <div className="complaint-list-badges">
                      <span
                        className="complaint-priority-badge"
                        style={{
                          background: ps.bg,
                          color: ps.color,
                          border: `1px solid ${ps.border}`,
                        }}
                      >
                        {c.priority}
                      </span>

                      <span
                        className="complaint-status-badge"
                        style={{
                          background: bs.bg,
                          color: bs.color,
                          border: `1px solid ${bs.border}`,
                        }}
                      >
                        {c.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="complaint-list-type">
                      {c.complaint_type}
                    </div>

                    {c.subject && (
                      <div className="complaint-list-subject">
                        {c.subject}
                      </div>
                    )}

                    <div className="complaint-list-meta">
                      <span>
                        <User size={12} color="#9CA3AF" />
                        {c.reporter_role === 'caterer'
                          ? 'Caterer'
                          : c.reporter_role === 'customer'
                            ? 'Customer'
                            : 'User'}
                      </span>

                      <span>
                        <Calendar size={12} color="#9CA3AF" />
                        {new Date(c.created_at).toLocaleDateString('en-PH', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT: Complaint Details */}
        <div className="complaints-detail-panel">
          {!selected ? (
            <div className="complaints-no-selection">
              <div className="complaints-no-selection-icon">
                <AlertTriangle size={32} color="#D1D5DB" />
              </div>

              <h3>Select a complaint ticket</h3>

              <p>
                Choose a technical support ticket to review the reported issue
                and add resolution notes.
              </p>
            </div>
          ) : (
            <div>
              {/* Complaint Header */}
              <div className="complaints-detail-header">
                <div>
                  <div className="complaints-detail-heading">
                    <h2>{selected.complaint_type}</h2>

                    <span
                      className="complaints-detail-status"
                      style={{
                        background:
                          STATUS_BADGE[selected.status]?.bg ?? '#F3F4F6',
                        color:
                          STATUS_BADGE[selected.status]?.color ?? '#4B5563',
                        border: `1px solid ${
                          STATUS_BADGE[selected.status]?.border ?? '#E5E7EB'
                        }`,
                      }}
                    >
                      {selected.status.replace('_', ' ')}
                    </span>
                  </div>

                  {selected.subject && (
                    <div className="complaints-detail-subject">
                      {selected.subject}
                    </div>
                  )}

                  <div className="complaints-filed-date">
                    <Calendar size={14} />
                    Filed on{' '}
                    {new Date(selected.created_at).toLocaleDateString(
                      'en-PH',
                      {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      }
                    )}
                  </div>
                </div>
              </div>

              {/* Case Metadata */}
              <div className="complaints-section">
                <h4 className="complaints-section-title">Case Metadata</h4>

                <div className="complaints-metadata-grid">
                  <div>
                    <div className="complaints-metadata-label">
                      <User size={12} />
                      Reporter
                    </div>

                    <div className="complaints-metadata-value">
                      {(selected.profiles as any)?.full_name ??
                        selected.reporter_role ??
                        '—'}
                    </div>
                  </div>

                  <div>
                    <div className="complaints-metadata-label">
                      <Tag size={12} />
                      Issue Category
                    </div>

                    <div className="complaints-metadata-value">
                      {selected.complaint_type}
                    </div>
                  </div>
                </div>

                {/* Issue Description */}
                <div className="complaints-description-card">
                  <div className="complaints-metadata-label">
                    <AlignLeft size={12} />
                    Issue Description
                  </div>

                  <div className="complaints-description-text">
                    {selected.description}
                  </div>
                </div>
              </div>

              {/* Priority Control */}
              {selected.status !== 'closed' && (
                <div className="complaints-section">
                  <h4 className="complaints-section-title">
                    Adjust Priority Level
                  </h4>

                  <div className="complaints-priority-options">
                    {['low', 'medium', 'high'].map((p) => {
                      const ps = PRIORITY_STYLE[p];

                      return (
                        <button
                          key={p}
                          onClick={() => updatePriority(selected.id, p)}
                          disabled={updating}
                          className="complaints-priority-button"
                          style={{
                            border: `1px solid ${
                              selected.priority === p ? ps.color : '#E5E7EB'
                            }`,
                            background:
                              selected.priority === p ? ps.bg : '#FFF',
                            color: ps.color,
                          }}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Resolution Notes */}
              <div className="complaints-section">
                <h4 className="complaints-section-title">
                  Technical Investigation & Resolution Notes
                </h4>

                <textarea
                  className="complaints-notes"
                  placeholder="Document investigation steps, communications, and final outcome..."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  rows={4}
                  disabled={selected.status === 'closed'}
                />
              </div>

              {/* Action Buttons */}
              {selected.status !== 'closed' && (
                <div className="complaints-actions">
                  {selected.status === 'open' && (
                    <button
                      className="complaints-action-button"
                      style={{ background: '#2563EB' }}
                      onClick={() =>
                        updateStatus(selected.id, 'in_review')
                      }
                      disabled={updating}
                    >
                      <Play size={18} />
                      Mark In Review
                    </button>
                  )}

                  {(selected.status === 'open' ||
                    selected.status === 'in_review') && (
                    <button
                      className="complaints-action-button"
                      style={{ background: '#16A34A' }}
                      onClick={() => updateStatus(selected.id, 'resolved')}
                      disabled={updating}
                    >
                      <CheckCircle2 size={18} />
                      Mark Resolved
                    </button>
                  )}

                  {selected.status === 'resolved' && (
                    <button
                      className="complaints-action-button"
                      style={{ background: '#111' }}
                      onClick={() => updateStatus(selected.id, 'closed')}
                      disabled={updating}
                    >
                      <Lock size={18} />
                      Close Ticket
                    </button>
                  )}
                </div>
              )}

              {/* Closed Ticket Information */}
              {selected.status === 'closed' && (
                <div className="complaints-closed-card">
                  <FileText size={24} color="#4B5563" />

                  <div>
                    <div className="complaints-closed-title">
                      Ticket Closed
                    </div>

                    {selected.resolution_notes && (
                      <div className="complaints-closed-notes">
                        {selected.resolution_notes}
                      </div>
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
