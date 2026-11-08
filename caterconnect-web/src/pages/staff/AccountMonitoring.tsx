import './StaffUnified.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  AlertTriangle, Ban, CheckCircle2, Flag, RefreshCw, Search,
  ShieldAlert, Users, Layers, AlertCircle, Calendar, X,
  FileText, ExternalLink, Check, XCircle
} from 'lucide-react';

type Account = {
  id: string;
  full_name: string;
  email: string;
  role: 'customer' | 'caterer';
  status: string | null;
  caterer_id: string | null;
  business_name: string | null;
  account_standing: string | null;
  flagged: boolean;
  suspended: boolean;
  reason: string | null;
  updated_at: string | null;
  total_bookings: number;
  total_cancellations: number;
  cancellations_90d: number;
  bookings_90d: number;
  refund_disputes: number;
};

type Action = 'flag' | 'unflag' | 'suspend';
type AppealDecision = 'Approved' | 'Rejected';

type Appeal = {
  id: string;
  user_id: string;
  appeal_message: string;
  evidence_url: string | null;
  status: string;
  staff_explanation: string | null;
  created_at: string;
  previous_appeal_id: string | null;
  email: string;
  full_name: string;
  role: string;
};

const fmt = (n: number) => Number(n || 0).toLocaleString('en-PH');

const getStatusIcon = (status: string, isActive = false) => {
  const colors: Record<string, string> = {
    all: '#2563EB',
    customer: '#0284C7',
    caterer: '#7C3AED',
    warning: '#D97706',
    flagged: '#D97706',
    suspended: '#DC2626'
  };

  const color = isActive
    ? '#FFFFFF'
    : colors[status.toLowerCase()] || '#6B7280';

  switch (status.toLowerCase()) {
    case 'customer':
    case 'caterer':
      return <Users size={14} color={color} />;
    case 'warning':
      return <AlertCircle size={14} color={color} />;
    case 'flagged':
      return <Flag size={14} color={color} />;
    case 'suspended':
      return <Ban size={14} color={color} />;
    default:
      return <Layers size={14} color={color} />;
  }
};

const buttonStyle: React.CSSProperties = {
  border: '1px solid #E5E7EB',
  borderRadius: 10,
  padding: '10px 14px',
  cursor: 'pointer',
  fontWeight: 800,
  fontSize: 13,
  background: '#FFF',
  color: '#374151'
};

export default function AccountMonitoring() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<'all' | 'customer' | 'caterer'>('all');
  const [filter, setFilter] = useState<
    'all' | 'warning' | 'flagged' | 'suspended'
  >('all');

  const [chosen, setChosen] = useState<{
    account: Account;
    action: Action;
  } | null>(null);

  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const [historyId, setHistoryId] = useState<string | null>(null);
  const [history, setHistory] = useState<
    { id: string; action: string; reason: string; created_at: string }[]
  >([]);

  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [appealsLoading, setAppealsLoading] = useState(false);
  const [appealsError, setAppealsError] = useState('');

  const [selectedAppeal, setSelectedAppeal] = useState<Appeal | null>(null);
  const [appealDecision, setAppealDecision] =
    useState<AppealDecision | null>(null);
  const [appealExplanation, setAppealExplanation] = useState('');
  const [appealSaving, setAppealSaving] = useState(false);

  // LOAD ACCOUNTS
  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const { data, error: e } = await supabase.rpc(
        'staff_account_monitoring_list'
      );

      if (e) throw e;

      if (!Array.isArray(data)) {
        throw new Error('Unexpected account monitoring response.');
      }

      setAccounts(data as Account[]);
    } catch (e: any) {
      setError(e?.message || 'Unable to load accounts.');
    } finally {
      setLoading(false);
    }
  }, []);

  // LOAD APPEALS
  const loadAppeals = useCallback(async () => {
    setAppealsLoading(true);
    setAppealsError('');

    try {
      const { data, error: appealError } = await supabase
        .from('account_appeals')
        .select(`
          id,
          user_id,
          appeal_message,
          evidence_url,
          status,
          staff_explanation,
          created_at,
          previous_appeal_id
        `)
        .order('created_at', { ascending: false });

      if (appealError) throw appealError;

      const appealRows = data || [];
      const userIds = [
        ...new Set(appealRows.map((appeal: any) => appeal.user_id))
      ];

      let profiles: any[] = [];

      if (userIds.length > 0) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, email, full_name, role')
          .in('id', userIds);

        if (profileError) throw profileError;

        profiles = profileData || [];
      }

      const combinedAppeals: Appeal[] = appealRows.map((appeal: any) => {
        const profile = profiles.find(p => p.id === appeal.user_id);

        return {
          ...appeal,
          email: profile?.email || 'Unknown email',
          full_name: profile?.full_name || 'Unknown user',
          role: profile?.role || 'Unknown role'
        };
      });

      setAppeals(combinedAppeals);
    } catch (e: any) {
      setAppealsError(e?.message || 'Unable to load account appeals.');
    } finally {
      setAppealsLoading(false);
    }
  }, []);

  // REFRESH BOTH
  const refreshAll = useCallback(async () => {
    await Promise.all([load(), loadAppeals()]);
  }, [load, loadAppeals]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  // REALTIME APPEAL NOTIFICATION
  useEffect(() => {
    const channel = supabase
      .channel('staff-account-appeals')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'account_appeals'
        },
        (payload) => {
          const newAppeal = payload.new as { id: string };

          window.alert(
            'New Account Appeal Submitted!\n\nA customer or caterer has submitted an account appeal. Please review it in Account Monitoring.'
          );

          void loadAppeals();
          console.log('New appeal submitted:', newAppeal.id);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadAppeals]);

  // ACCOUNT FILTERING
  const filtered = useMemo(() => {
    return accounts.filter(a => {
      const query = search.trim().toLowerCase();
      const warning = a.cancellations_90d >= 5;

      return (
        (role === 'all' || a.role === role) &&
        (
          filter === 'all' ||
          (filter === 'warning' && warning) ||
          (filter === 'flagged' && a.flagged) ||
          (filter === 'suspended' && a.suspended)
        ) &&
        (
          !query ||
          [a.full_name, a.email, a.business_name, a.id]
            .some(x => (x || '').toLowerCase().includes(query))
        )
      );
    });
  }, [accounts, role, filter, search]);

  const count = (f: 'warning' | 'flagged' | 'suspended') =>
    accounts.filter(a =>
      f === 'warning'
        ? a.cancellations_90d >= 5
        : f === 'flagged'
          ? a.flagged
          : a.suspended
    ).length;

  // ACCOUNT ACTION
  const act = async () => {
    if (!chosen || reason.trim().length < 10 || saving) return;
    // Staff cannot restore access. A suspended account must go through the appeal flow.
    if (chosen.action === 'suspend' && chosen.account.suspended) return;

    setSaving(true);
    setError('');

    try {
      const { error: e } = await supabase.rpc(
        'staff_account_monitoring_action',
        {
          p_user_id: chosen.account.id,
          p_action: chosen.action,
          p_reason: reason.trim()
        }
      );

      if (e) throw e;

      setChosen(null);
      setReason('');

      await load();

      setHistoryId(null);
      setHistory([]);
    } catch (e: any) {
      setError(e?.message || 'Unable to apply action.');
    } finally {
      setSaving(false);
    }
  };

  // STAFF AUDIT HISTORY
  const showHistory = async (id: string) => {
    if (historyId === id) {
      setHistoryId(null);
      setHistory([]);
      return;
    }

    setHistoryId(id);
    setHistory([]);

    const { data, error: e } = await supabase
      .from('account_monitoring_events')
      .select('id,action,reason,created_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(30);

    if (e) {
      setError(e.message);
    } else {
      setHistory(data || []);
    }
  };

  const start = (account: Account, action: Action) => {
    if (action === 'suspend' && account.suspended) return;
    setChosen({ account, action });
    setReason('');
  };

  // REVIEW APPEAL
  const reviewAppeal = async () => {
    if (!selectedAppeal || !appealDecision || appealSaving) return;

    if (
      appealDecision === 'Rejected' &&
      appealExplanation.trim().length < 10
    ) {
      setAppealsError(
        'A rejection explanation must contain at least 10 characters.'
      );
      return;
    }

    setAppealSaving(true);
    setAppealsError('');

    try {
      const { error: reviewError } = await supabase.rpc(
        'staff_review_account_appeal',
        {
          p_appeal_id: selectedAppeal.id,
          p_decision: appealDecision,
          p_explanation: appealExplanation.trim() || null
        }
      );

      if (reviewError) throw reviewError;

      const completedDecision = appealDecision;

      setSelectedAppeal(null);
      setAppealDecision(null);
      setAppealExplanation('');

      await loadAppeals();

      window.alert(
        completedDecision === 'Approved'
          ? 'Appeal approved and forwarded for Admin review. The account remains suspended until Admin makes the final decision.'
          : 'Appeal rejected. The explanation has been submitted for the account owner to review.'
      );
    } catch (e: any) {
      setAppealsError(e?.message || 'Unable to review account appeal.');
    } finally {
      setAppealSaving(false);
    }
  };

  // FIND PENDING APPEAL
  const getPendingAppeal = (userId: string) => {
    return appeals.find(
      appeal =>
        appeal.user_id === userId &&
        appeal.status?.toLowerCase() === 'pending'
    );
  };

  const pendingAppeals = appeals
    .filter(appeal => appeal.status?.toLowerCase() === 'pending')
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
    );

  return (
    <div className="am-page cc-staff-unified">

      <style>{`
        .am-page {
          width: 100%;
          min-width: 0;
          padding-bottom: 40px;
          color: #111827;
          font-family: 'Inter', system-ui, sans-serif;
        }

        .am-page * {
          box-sizing: border-box;
        }

        .am-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          flex-wrap: wrap;
          gap: 16px;
          margin-bottom: 26px;
        }

        .am-title {
          font-size: 28px;
          font-weight: 900;
          color: #111;
          margin: 0 0 6px;
          letter-spacing: -0.5px;
        }

        .am-subtitle {
          margin: 0;
          color: #6B7280;
          font-size: 14px;
          line-height: 1.6;
        }

        .am-refresh {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          white-space: nowrap;
        }

        .am-panel {
          background: #FFF;
          border: 1px solid #E5E7EB;
          border-radius: 18px;
          padding: 22px;
          margin-bottom: 24px;
          min-width: 0;
        }

        .am-appeals-panel {
          border-color: #FED7AA;
        }

        .am-panel-heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 18px;
        }

        .am-panel-title {
          font-size: 19px;
          font-weight: 900;
          color: #111827;
          margin: 0 0 5px;
        }

        .am-pending-count {
          background: #FFF7ED;
          color: #C2410C;
          border: 1px solid #FED7AA;
          border-radius: 20px;
          padding: 7px 13px;
          font-size: 13px;
          font-weight: 900;
          white-space: nowrap;
        }

        .am-appeal-list {
          display: grid;
          gap: 12px;
        }

        .am-appeal-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
          padding: 16px;
          border: 1px solid #E5E7EB;
          border-left: 4px solid #F97316;
          border-radius: 12px;
          background: #FFFEFC;
          min-width: 0;
        }

        .am-appeal-content {
          flex: 1;
          min-width: 0;
        }

        .am-appeal-meta {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 5px;
        }

        .am-primary-button {
          background: #F97316;
          color: #FFF;
          border: 1px solid #EA580C;
          border-radius: 10px;
          padding: 11px 16px;
          cursor: pointer;
          font-weight: 900;
          font-size: 13px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
        }

        .am-stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }

        .am-stat-card {
          background: #FFF;
          border: 1px solid #E5E7EB;
          border-radius: 18px;
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 14px;
          min-width: 0;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);
        }

        .am-stat-icon {
          width: 46px;
          height: 46px;
          border-radius: 13px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .am-stat-label {
          font-size: 11px;
          color: #6B7280;
          font-weight: 800;
          text-transform: uppercase;
          display: block;
          margin-bottom: 3px;
          letter-spacing: 0.4px;
          line-height: 1.4;
        }

        .am-stat-number {
          font-size: 24px;
          font-weight: 900;
          color: #111;
        }

        .am-filter-panel {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .am-filter-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
        }

        .am-filter-buttons {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .am-search {
          position: relative;
          width: 100%;
          max-width: 360px;
        }

        .am-search input {
          width: 100%;
          padding: 12px 16px 12px 44px;
          border: 1px solid #E5E7EB;
          border-radius: 12px;
          font-size: 14px;
          background: #FFF;
          outline: none;
          color: #111;
        }

        .am-search input:focus,
        .am-page textarea:focus {
          border-color: #F97316;
          box-shadow: 0 0 0 3px rgba(249,115,22,0.1);
        }

        .am-status-filters {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          padding-top: 12px;
          border-top: 1px solid #F3F4F6;
        }

        .am-account-list {
          display: grid;
          gap: 16px;
        }

        .am-account-card {
          background: #FFF;
          border: 1px solid #E5E7EB;
          border-radius: 18px;
          padding: 22px;
          min-width: 0;
        }

        .am-account-layout {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          min-width: 0;
        }

        .am-account-info {
          min-width: 0;
          flex: 1;
        }

        .am-account-heading {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 5px;
        }

        .am-account-name {
          font-size: 17px;
          font-weight: 900;
          color: #111;
          margin: 0;
          overflow-wrap: anywhere;
        }

        .am-email {
          color: #4B5563;
          font-size: 13px;
          margin-bottom: 12px;
          overflow-wrap: anywhere;
          word-break: break-word;
        }

        .am-badges {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 16px;
        }

        .am-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 9px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 800;
          line-height: 1.4;
        }

        .am-metrics {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          background: #F9FAFB;
          padding: 13px;
          border-radius: 12px;
          border: 1px solid #E5E7EB;
        }

        .am-metric-label {
          font-size: 10px;
          color: #6B7280;
          font-weight: 700;
          text-transform: uppercase;
          display: block;
          line-height: 1.5;
        }

        .am-metric-value {
          font-size: 16px;
          font-weight: 900;
          color: #111;
        }

        .am-actions {
          display: flex;
          flex-direction: column;
          gap: 8px;
          width: 170px;
          flex-shrink: 0;
        }

        .am-action-button {
          width: 100%;
          min-height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 10px 12px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
        }

        .am-history {
          margin-top: 20px;
          border-top: 1px solid #E5E7EB;
          padding: 16px;
          background: #F9FAFB;
          border-radius: 12px;
        }

        .am-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(17,24,39,0.65);
          backdrop-filter: blur(4px);
          z-index: 1100;
          display: grid;
          place-items: center;
          padding: 20px;
        }

        .am-modal {
          background: #FFF;
          border-radius: 20px;
          padding: 28px;
          width: 100%;
          max-width: 560px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
          min-width: 0;
        }

        .am-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
          border-bottom: 1px solid #E5E7EB;
          padding-bottom: 16px;
        }

        .am-modal-footer {
          display: flex;
          gap: 10px;
          margin-top: 22px;
          border-top: 1px solid #E5E7EB;
          padding-top: 18px;
        }

        .am-modal-footer button {
          flex: 1;
          min-height: 44px;
        }

        .am-decision-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 20px;
        }

        .am-page textarea {
          width: 100%;
          box-sizing: border-box;
          padding: 12px;
          border: 1px solid #D1D5DB;
          border-radius: 12px;
          resize: vertical;
          font-family: inherit;
          font-size: 14px;
          outline: none;
          color: #111;
          background: #FFF;
        }

        @media (max-width: 1100px) {
          .am-stats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .am-account-layout {
            flex-wrap: wrap;
          }

          .am-actions {
            width: 100%;
            flex-direction: row;
            flex-wrap: wrap;
          }

          .am-action-button {
            flex: 1 1 140px;
          }
        }

        @media (max-width: 768px) {
          .am-page {
            padding-bottom: 24px;
          }

          .am-header {
            align-items: stretch;
            margin-bottom: 20px;
          }

          .am-title {
            font-size: 23px;
          }

          .am-subtitle {
            font-size: 13px;
          }

          .am-refresh {
            width: 100%;
          }

          .am-panel {
            padding: 16px;
            border-radius: 15px;
            margin-bottom: 18px;
          }

          .am-panel-title {
            font-size: 17px;
          }

          .am-appeal-card {
            align-items: stretch;
            padding: 14px;
          }

          .am-appeal-card .am-primary-button {
            width: 100%;
          }

          .am-stats {
            gap: 10px;
          }

          .am-stat-card {
            padding: 14px;
            gap: 10px;
            border-radius: 14px;
          }

          .am-stat-icon {
            width: 38px;
            height: 38px;
          }

          .am-stat-number {
            font-size: 21px;
          }

          .am-filter-top {
            align-items: stretch;
          }

          .am-search {
            max-width: none;
          }

          .am-account-card {
            padding: 16px;
            border-radius: 15px;
          }

          .am-account-layout {
            flex-direction: column;
          }

          .am-account-info {
            width: 100%;
          }

          .am-actions {
            width: 100%;
          }

          .am-metrics {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .am-modal-overlay {
            padding: 12px;
          }

          .am-modal {
            padding: 20px;
            max-height: 94vh;
            border-radius: 16px;
          }
        }

        @media (max-width: 480px) {
          .am-title {
            font-size: 21px;
          }

          .am-panel {
            padding: 13px;
          }

          .am-panel-heading {
            align-items: flex-start;
          }

          .am-stats {
            grid-template-columns: 1fr;
          }

          .am-stat-card {
            padding: 14px;
          }

          .am-filter-buttons {
            display: grid;
            grid-template-columns: 1fr;
            width: 100%;
          }

          .am-filter-buttons button {
            justify-content: center;
          }

          .am-status-filters button {
            flex: 1 1 100%;
            justify-content: center;
          }

          .am-metrics {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px 8px;
          }

          .am-account-heading {
            gap: 7px;
          }

          .am-account-name {
            font-size: 16px;
          }

          .am-actions {
            flex-direction: column;
          }

          .am-action-button {
            width: 100%;
            flex: 1 1 auto;
          }

          .am-modal {
            padding: 16px;
          }

          .am-decision-grid {
            grid-template-columns: 1fr;
          }

          .am-modal-footer {
            flex-direction: column-reverse;
          }

          .am-modal-footer button {
            width: 100%;
          }
        }
      `}</style>

      {/* PAGE HEADER */}
      <div className="am-header">
        <div>
          <h1 className="am-title">Account Monitoring</h1>
          <p className="am-subtitle">
            Monitor accounts, review appeals, and manage platform suspensions securely.
          </p>
        </div>

        <button
          style={buttonStyle}
          className="am-refresh"
          disabled={loading || appealsLoading}
          onClick={() => void refreshAll()}
        >
          <RefreshCw
            size={16}
            style={{
              marginRight: 8,
              animation: loading || appealsLoading
                ? 'spin 1s linear infinite'
                : 'none'
            }}
          />
          {loading || appealsLoading ? 'Refreshing...' : 'Refresh accounts'}
        </button>
      </div>

      {/* NEW ACCOUNT APPEALS */}
      <div className="am-panel am-appeals-panel">
        <div className="am-panel-heading">
          <div>
            <h2 className="am-panel-title">New Account Appeals</h2>
            <p className="am-subtitle">
              Review customer and caterer appeals awaiting Staff decision.
            </p>
          </div>

          <span className="am-pending-count">
            {pendingAppeals.length} Pending
          </span>
        </div>

        {appealsLoading ? (
          <p className="am-subtitle">Loading appeals...</p>
        ) : appealsError ? (
          <p style={{ color: '#DC2626', fontSize: 13 }}>{appealsError}</p>
        ) : pendingAppeals.length === 0 ? (
          <div style={{
            background: '#F9FAFB',
            border: '1px dashed #D1D5DB',
            borderRadius: 12,
            padding: 25,
            textAlign: 'center',
            color: '#6B7280',
            fontSize: 13
          }}>
            No new account appeals awaiting review.
          </div>
        ) : (
          <div className="am-appeal-list">
            {pendingAppeals.map(appeal => (
              <div key={appeal.id} className="am-appeal-card">
                <div className="am-appeal-content">
                  <div className="am-appeal-meta">
                    <strong style={{ fontSize: 15, color: '#111827' }}>
                      {appeal.full_name}
                    </strong>

                    <span className="am-badge" style={{
                      background: '#FFF7ED',
                      color: '#C2410C'
                    }}>
                      {appeal.role}
                    </span>

                    <span className="am-badge" style={{
                      background: '#FEF3C7',
                      color: '#92400E'
                    }}>
                      PENDING REVIEW
                    </span>
                  </div>

                  <div style={{
                    fontSize: 12,
                    color: '#6B7280',
                    marginBottom: 9,
                    overflowWrap: 'anywhere'
                  }}>
                    {appeal.email}
                  </div>

                  <p style={{
                    fontSize: 13,
                    color: '#374151',
                    margin: '0 0 8px',
                    lineHeight: 1.5,
                    overflowWrap: 'anywhere'
                  }}>
                    {appeal.appeal_message.length > 180
                      ? `${appeal.appeal_message.slice(0, 180)}...`
                      : appeal.appeal_message}
                  </p>

                  <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                    Submitted: {new Date(appeal.created_at).toLocaleString('en-PH')}
                  </span>
                </div>

                <button
                  className="am-primary-button"
                  onClick={() => {
                    setSelectedAppeal(appeal);
                    setAppealDecision(null);
                    setAppealExplanation('');
                    setAppealsError('');
                  }}
                >
                  <FileText size={15} />
                  Review Appeal
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* GENERAL ERROR */}
      {error && (
        <div style={{
          background: '#FEF2F2',
          border: '1px solid #FECACA',
          color: '#991B1B',
          padding: 16,
          borderRadius: 14,
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 14,
          fontWeight: 600
        }}>
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      {/* STATISTICS */}
      <div className="am-stats">
        {[
          {
            label: 'Total Accounts',
            n: accounts.length,
            icon: Users,
            color: '#2563EB',
            bg: '#EFF6FF',
            border: '#BFDBFE'
          },
          {
            label: 'Cancellation Warnings',
            n: count('warning'),
            icon: AlertTriangle,
            color: '#D97706',
            bg: '#FEF3C7',
            border: '#FDE68A'
          },
          {
            label: 'Flagged Accounts',
            n: count('flagged'),
            icon: Flag,
            color: '#D97706',
            bg: '#FEF3C7',
            border: '#FDE68A'
          },
          {
            label: 'Suspended Accounts',
            n: count('suspended'),
            icon: Ban,
            color: '#DC2626',
            bg: '#FEE2E2',
            border: '#FECACA'
          }
        ].map(({ label, n, icon: Icon, color, bg, border }) => (
          <div
            key={label}
            className="am-stat-card"
            style={{ borderColor: border }}
          >
            <div
              className="am-stat-icon"
              style={{ background: bg, color }}
            >
              <Icon size={23} />
            </div>

            <div style={{ minWidth: 0 }}>
              <span className="am-stat-label">{label}</span>
              <span className="am-stat-number">{fmt(n)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* FILTERS AND SEARCH */}
      <div className="am-panel am-filter-panel">
        <div className="am-filter-top">
          <div className="am-filter-buttons">
            {(['all', 'customer', 'caterer'] as const).map(r => {
              const active = role === r;

              return (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: 10,
                    border: `1px solid ${active ? '#111' : '#E5E7EB'}`,
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: 'pointer',
                    background: active ? '#111' : '#FFF',
                    color: active ? '#FFF' : '#374151',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7
                  }}
                >
                  {getStatusIcon(r, active)}
                  {r === 'all'
                    ? 'All Roles'
                    : r === 'customer'
                      ? 'Customers'
                      : 'Caterers'}
                </button>
              );
            })}
          </div>

          <div className="am-search">
            <Search
              size={18}
              style={{
                position: 'absolute',
                left: 15,
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#9CA3AF'
              }}
            />

            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, business, email..."
            />
          </div>
        </div>

        <div className="am-status-filters">
          <span style={{
            fontSize: 13,
            fontWeight: 800,
            color: '#6B7280',
            display: 'flex',
            alignItems: 'center',
            marginRight: 4
          }}>
            Status Filter:
          </span>

          {(['all', 'warning', 'flagged', 'suspended'] as const).map(f => {
            const active = filter === f;

            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '7px 12px',
                  borderRadius: 9,
                  border: `1px solid ${active ? '#F97316' : '#E5E7EB'}`,
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                  background: active ? '#FFF7ED' : '#FFF',
                  color: active ? '#C2410C' : '#4B5563',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                {f !== 'all' && getStatusIcon(f)}
                {f === 'all'
                  ? 'All Statuses'
                  : f === 'warning'
                    ? '5+ Cancellations / 90d'
                    : f[0].toUpperCase() + f.slice(1)}
              </button>
            );
          })}
        </div>
      </div>

      <p style={{
        color: '#6B7280',
        fontSize: 12,
        marginBottom: 18,
        fontWeight: 500,
        lineHeight: 1.6
      }}>
        <AlertCircle size={14} style={{
          display: 'inline',
          verticalAlign: 'middle',
          marginRight: 5
        }} />
        Warnings are advisory only. Staff must review account context before taking action.
      </p>

      {/* ACCOUNT CARDS */}
      <div className="am-account-list">
        {!loading && filtered.length === 0 && (
          <div className="am-panel" style={{
            textAlign: 'center',
            padding: 40,
            color: '#6B7280'
          }}>
            <div style={{
              fontSize: 18,
              fontWeight: 900,
              color: '#111',
              marginBottom: 6
            }}>
              No matching accounts found
            </div>

            <p style={{ margin: 0, fontSize: 14 }}>
              Try clearing search terms or changing your filters.
            </p>
          </div>
        )}

        {filtered.map(a => {
          const isCaterer = a.role === 'caterer';
          const primaryName = isCaterer
            ? a.business_name || a.full_name
            : a.full_name;

          const isWarning = a.cancellations_90d >= 5;
          const pendingAppeal = getPendingAppeal(a.id);

          return (
            <div
              key={a.id}
              className="am-account-card"
              style={{
                borderLeft: a.suspended
                  ? '5px solid #DC2626'
                  : a.flagged || isWarning
                    ? '5px solid #D97706'
                    : '5px solid #16A34A'
              }}
            >
              <div className="am-account-layout">
                <div className="am-account-info">
                  <div className="am-account-heading">
                    <h3 className="am-account-name">{primaryName}</h3>

                    <span className="am-badge" style={{
                      background: isCaterer ? '#F5F3FF' : '#EFF6FF',
                      color: isCaterer ? '#7C3AED' : '#2563EB',
                      border: `1px solid ${isCaterer ? '#DDD6FE' : '#BFDBFE'}`
                    }}>
                      {a.role}
                    </span>

                    {isCaterer && a.business_name && (
                      <span style={{
                        fontSize: 12,
                        color: '#6B7280',
                        fontWeight: 600
                      }}>
                        Owner: {a.full_name}
                      </span>
                    )}
                  </div>

                  <div className="am-email">{a.email}</div>

                  {/* STATUS BADGES */}
                  <div className="am-badges">
                    {a.cancellations_90d >= 10 && (
                      <span className="am-badge" style={{
                        background: '#FEE2E2',
                        color: '#991B1B'
                      }}>
                        <AlertTriangle size={12} /> High Cancellation Warning
                      </span>
                    )}

                    {a.cancellations_90d >= 5 &&
                      a.cancellations_90d < 10 && (
                        <span className="am-badge" style={{
                          background: '#FEF3C7',
                          color: '#92400E'
                        }}>
                          <AlertTriangle size={12} /> Cancellation Warning
                        </span>
                      )}

                    {a.flagged && (
                      <span className="am-badge" style={{
                        background: '#FEF3C7',
                        color: '#92400E'
                      }}>
                        <Flag size={12} /> Flagged Account
                      </span>
                    )}

                    {a.suspended && (
                      <span className="am-badge" style={{
                        background: '#FEE2E2',
                        color: '#DC2626'
                      }}>
                        <Ban size={12} /> Suspended
                      </span>
                    )}

                    {!a.flagged && !a.suspended && (
                      <span className="am-badge" style={{
                        background: '#DCFCE7',
                        color: '#166534'
                      }}>
                        <CheckCircle2 size={12} /> Account in Good Standing
                      </span>
                    )}

                    {pendingAppeal && (
                      <span className="am-badge" style={{
                        background: '#FEF3C7',
                        color: '#92400E'
                      }}>
                        <FileText size={12} /> New Appeal Submitted
                      </span>
                    )}
                  </div>

                  {/* ACCOUNT METRICS */}
                  <div className="am-metrics">
                    <div>
                      <span className="am-metric-label">Cancellations (90d)</span>
                      <span className="am-metric-value" style={{
                        color: a.cancellations_90d >= 5 ? '#DC2626' : '#111'
                      }}>
                        {fmt(a.cancellations_90d)}
                      </span>
                    </div>

                    <div>
                      <span className="am-metric-label">Lifetime Cancels</span>
                      <span className="am-metric-value">
                        {fmt(a.total_cancellations)}
                      </span>
                    </div>

                    <div>
                      <span className="am-metric-label">Total Bookings</span>
                      <span className="am-metric-value" style={{ color: '#2563EB' }}>
                        {fmt(a.total_bookings)}
                      </span>
                    </div>

                    <div>
                      <span className="am-metric-label">Refund Disputes</span>
                      <span className="am-metric-value" style={{
                        color: a.refund_disputes > 0 ? '#D97706' : '#111'
                      }}>
                        {fmt(a.refund_disputes)}
                      </span>
                    </div>
                  </div>

                  {a.reason && (
                    <div style={{
                      marginTop: 12,
                      fontSize: 13,
                      color: '#4B5563',
                      background: '#FFFBEB',
                      border: '1px solid #FEF3C7',
                      padding: '10px 12px',
                      borderRadius: 10,
                      overflowWrap: 'anywhere'
                    }}>
                      <strong style={{ color: '#92400E' }}>
                        Last Staff Reason:
                      </strong>{' '}
                      {a.reason}
                    </div>
                  )}
                </div>

                {/* ACCOUNT ACTIONS */}
                <div className="am-actions">
                  <button
                    className="am-action-button"
                    style={buttonStyle}
                    onClick={() => void showHistory(a.id)}
                  >
                    <ShieldAlert size={15} />
                    {historyId === a.id ? 'Hide History' : 'View History'}
                  </button>

                  <button
                    className="am-action-button"
                    style={{
                      ...buttonStyle,
                      color: a.flagged ? '#D97706' : '#4B5563'
                    }}
                    onClick={() =>
                      start(a, a.flagged ? 'unflag' : 'flag')
                    }
                  >
                    <Flag size={15} />
                    {a.flagged ? 'Remove Flag' : 'Flag Account'}
                  </button>

                  {!a.suspended ? (
                    <button
                      className="am-action-button"
                      style={{
                        background: '#FEF2F2',
                        border: '1px solid #FECACA',
                        color: '#DC2626'
                      }}
                      onClick={() => start(a, 'suspend')}
                    >
                      <Ban size={15} />
                      Suspend Account
                    </button>
                  ) : (
                    <div style={{
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: '1px solid #FED7AA',
                      background: '#FFF7ED',
                      color: '#9A3412',
                      fontSize: 12,
                      lineHeight: 1.5,
                      fontWeight: 700
                    }}>
                      Suspended — only Admin can restore access after appeal review.
                    </div>
                  )}

                  {pendingAppeal && (
                    <button
                      className="am-primary-button"
                      style={{ width: '100%' }}
                      onClick={() => {
                        setSelectedAppeal(pendingAppeal);
                        setAppealDecision(null);
                        setAppealExplanation('');
                        setAppealsError('');
                      }}
                    >
                      <FileText size={15} />
                      Review Appeal
                    </button>
                  )}
                </div>
              </div>

              {/* AUDIT HISTORY */}
              {historyId === a.id && (
                <div className="am-history">
                  <div style={{
                    fontSize: 13,
                    fontWeight: 900,
                    color: '#111',
                    marginBottom: 10,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                    <Calendar size={15} color="#F97316" />
                    Recent Staff Audit History
                  </div>

                  {history.length === 0 && (
                    <p style={{
                      color: '#6B7280',
                      fontSize: 13,
                      margin: 0
                    }}>
                      No audit actions recorded for this account.
                    </p>
                  )}

                  <div style={{ display: 'grid', gap: 8 }}>
                    {history.map(h => (
                      <div key={h.id} style={{
                        background: '#FFF',
                        border: '1px solid #E5E7EB',
                        borderRadius: 10,
                        padding: 12,
                        fontSize: 13
                      }}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          marginBottom: 4,
                          gap: 10
                        }}>
                          <span style={{
                            fontWeight: 800,
                            color: h.action === 'suspend'
                              ? '#DC2626'
                              : h.action === 'flag'
                                ? '#D97706'
                                : '#16A34A',
                            textTransform: 'uppercase'
                          }}>
                            {h.action}
                          </span>

                          <span style={{
                            color: '#9CA3AF',
                            fontSize: 12
                          }}>
                            {new Date(h.created_at).toLocaleString('en-PH')}
                          </span>
                        </div>

                        <div style={{
                          color: '#4B5563',
                          whiteSpace: 'pre-wrap',
                          overflowWrap: 'anywhere'
                        }}>
                          {h.reason}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ACCOUNT ACTION MODAL */}
      {chosen && (
        <div
          className="am-modal-overlay"
          role="presentation"
          onMouseDown={e => {
            if (e.target === e.currentTarget) setChosen(null);
          }}
        >
          <div
            className="am-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Confirm account action"
            style={{ maxWidth: 480 }}
          >
            <div className="am-modal-header">
              <h2 style={{
                fontSize: 20,
                fontWeight: 900,
                margin: 0,
                color: '#111',
                textTransform: 'capitalize'
              }}>
                Confirm {chosen.action}
              </h2>

              <button
                style={{
                  background: 'transparent',
                  border: '1px solid #E5E7EB',
                  borderRadius: '50%',
                  width: 36,
                  height: 36,
                  display: 'grid',
                  placeItems: 'center',
                  cursor: 'pointer',
                  color: '#4B5563',
                  flexShrink: 0
                }}
                onClick={() => setChosen(null)}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{
              color: '#4B5563',
              fontSize: 14,
              margin: '0 0 16px',
              lineHeight: 1.6
            }}>
              Account:{' '}
              <strong style={{ color: '#111' }}>
                {chosen.account.full_name}
              </strong>{' '}
              ({chosen.account.role}).{' '}
              {chosen.action === 'suspend'
                ? 'Suspension prevents the account holder from accessing the platform. To request restoration, they must submit an account appeal. Staff may review the appeal, but only the System Administrator can restore access.'
                : 'This action will be recorded in the Staff audit history.'}
            </p>

            <div style={{ marginBottom: 20 }}>
              <label style={{
                fontSize: 13,
                fontWeight: 800,
                display: 'block',
                marginBottom: 6,
                color: '#374151'
              }}>
                Reason for action (at least 10 characters)
              </label>

              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                maxLength={2000}
                rows={4}
                placeholder="Explain the evidence or reason for this action..."
              />
            </div>

            <div className="am-modal-footer">
              <button
                style={{
                  padding: '12px 16px',
                  background: '#F3F4F6',
                  color: '#374151',
                  border: '1px solid #E5E7EB',
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
                disabled={saving}
                onClick={() => setChosen(null)}
              >
                Cancel
              </button>

              <button
                style={{
                  padding: '12px 16px',
                  background: chosen.action === 'suspend' ? '#DC2626' : '#111',
                  color: '#FFF',
                  border: 'none',
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  opacity: saving || reason.trim().length < 10 ? 0.7 : 1
                }}
                disabled={saving || reason.trim().length < 10}
                onClick={() => void act()}
              >
                <CheckCircle2 size={16} />
                {saving ? 'Saving...' : 'Confirm Action'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* APPEAL REVIEW MODAL */}
      {selectedAppeal && (
        <div
          className="am-modal-overlay"
          role="presentation"
          onMouseDown={e => {
            if (e.target === e.currentTarget && !appealSaving) {
              setSelectedAppeal(null);
            }
          }}
        >
          <div
            className="am-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Review account appeal"
          >
            <div className="am-modal-header">
              <div>
                <h2 style={{
                  fontSize: 20,
                  fontWeight: 900,
                  margin: '0 0 5px',
                  color: '#111'
                }}>
                  Review Account Appeal
                </h2>

                <p className="am-subtitle" style={{ fontSize: 12 }}>
                  Review the submitted information before making a decision.
                </p>
              </div>

              <button
                onClick={() => {
                  if (appealSaving) return;
                  setSelectedAppeal(null);
                }}
                disabled={appealSaving}
                style={{
                  background: '#FFF',
                  border: '1px solid #E5E7EB',
                  borderRadius: '50%',
                  width: 36,
                  height: 36,
                  display: 'grid',
                  placeItems: 'center',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* APPLICANT DETAILS */}
            <div style={{
              background: '#F9FAFB',
              padding: 15,
              borderRadius: 12,
              marginBottom: 16,
              overflowWrap: 'anywhere'
            }}>
              <div style={{
                fontSize: 15,
                fontWeight: 900,
                color: '#111'
              }}>
                {selectedAppeal.full_name}
              </div>

              <div style={{
                fontSize: 13,
                color: '#6B7280',
                marginTop: 4
              }}>
                {selectedAppeal.email}
              </div>

              <div style={{
                fontSize: 12,
                color: '#6B7280',
                marginTop: 5,
                textTransform: 'capitalize'
              }}>
                Account type: {selectedAppeal.role}
              </div>
            </div>

            {/* SUBMITTED APPEAL */}
            <div style={{ marginBottom: 18 }}>
              <label style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 900,
                color: '#6B7280',
                textTransform: 'uppercase',
                marginBottom: 8
              }}>
                Submitted Appeal
              </label>

              <div style={{
                padding: 15,
                background: '#FFF',
                border: '1px solid #E5E7EB',
                borderRadius: 12,
                fontSize: 14,
                color: '#374151',
                lineHeight: 1.7,
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere'
              }}>
                {selectedAppeal.appeal_message}
              </div>
            </div>

            {/* EVIDENCE */}
            {selectedAppeal.evidence_url && (
              <div style={{ marginBottom: 18 }}>
                <a
                  href={selectedAppeal.evidence_url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    color: '#2563EB',
                    fontSize: 13,
                    fontWeight: 800,
                    overflowWrap: 'anywhere'
                  }}
                >
                  <ExternalLink size={16} />
                  Open Supporting Evidence
                </a>
              </div>
            )}

            {/* STAFF DECISION */}
            <label style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 900,
              color: '#374151',
              marginBottom: 9
            }}>
              Staff Review Decision
            </label>

            <div className="am-decision-grid">
              <button
                onClick={() => {
                  setAppealDecision('Approved');
                  setAppealsError('');
                }}
                style={{
                  padding: 13,
                  borderRadius: 10,
                  border: `1px solid ${appealDecision === 'Approved' ? '#16A34A' : '#D1D5DB'}`,
                  background: appealDecision === 'Approved' ? '#16A34A' : '#FFF',
                  color: appealDecision === 'Approved' ? '#FFF' : '#166534',
                  fontWeight: 900,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 7
                }}
              >
                <Check size={16} />
                Approve
              </button>

              <button
                onClick={() => {
                  setAppealDecision('Rejected');
                  setAppealsError('');
                }}
                style={{
                  padding: 13,
                  borderRadius: 10,
                  border: `1px solid ${appealDecision === 'Rejected' ? '#DC2626' : '#D1D5DB'}`,
                  background: appealDecision === 'Rejected' ? '#DC2626' : '#FFF',
                  color: appealDecision === 'Rejected' ? '#FFF' : '#991B1B',
                  fontWeight: 900,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 7
                }}
              >
                <XCircle size={16} />
                Reject
              </button>
            </div>

            {/* STAFF EXPLANATION */}
            <label style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 900,
              color: '#374151',
              marginBottom: 8
            }}>
              Staff Explanation{' '}
              {appealDecision === 'Rejected' ? '(Required)' : '(Optional)'}
            </label>

            <textarea
              value={appealExplanation}
              onChange={e => setAppealExplanation(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder={
                appealDecision === 'Rejected'
                  ? 'Explain why this appeal is rejected...'
                  : 'Enter optional review notes...'
              }
            />

            {appealDecision === 'Approved' && (
              <div style={{
                marginTop: 12,
                background: '#EFF6FF',
                color: '#1D4ED8',
                padding: 12,
                borderRadius: 10,
                fontSize: 12,
                lineHeight: 1.6
              }}>
                <strong>Approval notice:</strong> This appeal will be forwarded
                for Admin's final decision. The account remains suspended
                until Admin decides whether to unsuspend it.
              </div>
            )}

            {appealDecision === 'Rejected' && (
              <div style={{
                marginTop: 12,
                background: '#FEF2F2',
                color: '#991B1B',
                padding: 12,
                borderRadius: 10,
                fontSize: 12,
                lineHeight: 1.6
              }}>
                <strong>Rejection notice:</strong> The explanation will be
                available to the account owner. They can revise their appeal
                and submit it again. A rejected appeal will not be forwarded
                to Admin.
              </div>
            )}

            {appealsError && (
              <div style={{
                marginTop: 12,
                color: '#991B1B',
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                padding: 10,
                borderRadius: 9,
                fontSize: 12
              }}>
                {appealsError}
              </div>
            )}

            {/* MODAL BUTTONS */}
            <div className="am-modal-footer">
              <button
                onClick={() => {
                  setSelectedAppeal(null);
                  setAppealDecision(null);
                  setAppealExplanation('');
                  setAppealsError('');
                }}
                disabled={appealSaving}
                style={{
                  padding: 12,
                  borderRadius: 10,
                  border: '1px solid #E5E7EB',
                  background: '#F9FAFB',
                  color: '#374151',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>

              <button
                onClick={() => void reviewAppeal()}
                disabled={
                  appealSaving ||
                  !appealDecision ||
                  (
                    appealDecision === 'Rejected' &&
                    appealExplanation.trim().length < 10
                  )
                }
                style={{
                  padding: 12,
                  borderRadius: 10,
                  border: 'none',
                  background: '#F97316',
                  color: '#FFF',
                  fontWeight: 900,
                  cursor: 'pointer',
                  opacity:
                    appealSaving ||
                    !appealDecision ||
                    (
                      appealDecision === 'Rejected' &&
                      appealExplanation.trim().length < 10
                    )
                      ? 0.5
                      : 1
                }}
              >
                {appealSaving ? 'Submitting...' : 'Submit Review'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
