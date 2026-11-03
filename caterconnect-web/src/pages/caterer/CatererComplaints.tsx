
import { useEffect, useState } from 'react';
import {
  FileText,
  ClipboardList,
  Inbox,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  ChevronDown,
  Send,
  RefreshCw,
} from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import CatererPageHeader from '../../components/CatererPageHeader';
import CatererSkeleton from '../../components/CatererSkeleton';
import './CatererComplaints.css';

const COMPLAINT_TYPES = [
  'Login & Account Issues',
  'Booking System Error',
  'Payment System Issue',
  'Notification Issue',
  'Chat & Messaging Issue',
  'App Performance Issue',
  'Privacy & Security Issue',
  'Other Technical Issue',
];

type Priority = 'low' | 'medium' | 'high';
type Tab = 'new' | 'history';

type Complaint = {
  id: string;
  complaint_type: string;
  subject: string | null;
  description: string;
  priority: string;
  status: string;
  resolution_notes: string | null;
  created_at: string;
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_review: 'In Review',
  resolved: 'Resolved',
  closed: 'Closed',
};

function getStatusIcon(status: string) {
  switch (status) {
    case 'resolved':
    case 'closed':
      return <CheckCircle2 size={16} />;
    case 'in_review':
      return <Clock size={16} />;
    default:
      return <AlertTriangle size={16} />;
  }
}

function formatDate(date: string) {
  return new Date(date).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function CatererComplaints() {
  const { session } = useAuth();

  const [tab, setTab] = useState<Tab>('new');
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [complaintType, setComplaintType] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [showIssueTypes, setShowIssueTypes] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function loadHistory() {
    if (!session?.user?.id) return;

    setLoadingHistory(true);
    setError('');

    const { data, error: queryError } = await supabase
      .from('complaints')
      .select(
        'id, complaint_type, subject, description, priority, status, resolution_notes, created_at'
      )
      .eq('reporter_id', session.user.id)
      .order('created_at', { ascending: false });

    if (queryError) {
      console.error('Error loading complaints:', queryError);
      setError('Unable to load your technical reports. Please try again.');
      setComplaints([]);
    } else {
      setComplaints((data || []) as Complaint[]);
    }

    setLoadingHistory(false);
  }

  useEffect(() => {
    if (tab === 'history') {
      loadHistory();
    }
  }, [tab, session?.user?.id]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session?.user?.id) {
      setError('Your session has expired. Please log in again.');
      return;
    }

    if (!complaintType) {
      setError('Please select a technical issue type.');
      return;
    }

    if (!description.trim()) {
      setError('Please describe the technical issue.');
      return;
    }

    if (description.trim().length < 10) {
      setError('Please provide at least 10 characters in your description.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    const { error: insertError } = await supabase
      .from('complaints')
      .insert({
        reporter_id: session.user.id,
        reporter_role: 'caterer',
        complaint_type: complaintType,
        subject: subject.trim() || null,
        description: description.trim(),
        priority,
        status: 'open',
      });

    if (insertError) {
      console.error('Error submitting technical report:', insertError);
      setError(insertError.message || 'Unable to submit your technical report.');
      setSubmitting(false);
      return;
    }

    setSuccess('Your technical report has been submitted to Platform Staff for review.');

    setComplaintType('');
    setSubject('');
    setDescription('');
    setPriority('medium');
    setShowIssueTypes(false);

    setSubmitting(false);

    await loadHistory();
    setTab('history');
  }

  return (
    <div className="caterer-support-page">
      <CatererPageHeader
        icon={<ShieldAlert size={25} />}
        title="Technical Support"
        description="Report technical problems and track the progress of your reports."
      />

      <div className="caterer-support-tabs">
        <button
          type="button"
          className={tab === 'new' ? 'active' : ''}
          onClick={() => {
            setTab('new');
            setError('');
            setSuccess('');
          }}
        >
          <FileText size={17} />
          New Complaint
        </button>

        <button
          type="button"
          className={tab === 'history' ? 'active' : ''}
          onClick={() => {
            setTab('history');
            setError('');
            setSuccess('');
          }}
        >
          <ClipboardList size={17} />
          My Complaints
        </button>
      </div>

      {error && (
        <div className="support-alert support-alert-error" role="alert">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="support-alert support-alert-success" role="status">
          <CheckCircle2 size={18} />
          <span>{success}</span>
        </div>
      )}

      {tab === 'new' ? (
        <div className="support-form-card">
          <div className="support-card-heading">
            <h2>Submit a Technical Report</h2>
            <p>
              Tell us about the technical problem you encountered. Our Platform
              Staff will review your report.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="support-form-group">
              <label>
                Issue Type <span>*</span>
              </label>

              <div className="support-select-wrapper">
                <button
                  type="button"
                  className="support-select"
                  onClick={() => setShowIssueTypes(!showIssueTypes)}
                  aria-expanded={showIssueTypes}
                >
                  <span className={complaintType ? '' : 'placeholder'}>
                    {complaintType || 'Select the type of issue'}
                  </span>
                  <ChevronDown size={18} />
                </button>

                {showIssueTypes && (
                  <div className="support-select-options">
                    {COMPLAINT_TYPES.map((type) => (
                      <button
                        type="button"
                        key={type}
                        className={complaintType === type ? 'selected' : ''}
                        onClick={() => {
                          setComplaintType(type);
                          setShowIssueTypes(false);
                          setError('');
                        }}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="support-form-group">
              <label htmlFor="support-subject">
                Subject <small>(Optional)</small>
              </label>
              <input
                id="support-subject"
                type="text"
                placeholder="Brief title of your issue"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                maxLength={120}
              />
            </div>

            <div className="support-form-group">
              <label htmlFor="support-description">
                Description <span>*</span>
              </label>
              <textarea
                id="support-description"
                placeholder="Explain what happened, what you were trying to do, and any error message you encountered..."
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={6}
                maxLength={3000}
              />
              <div className="support-character-count">
                {description.length}/3000
              </div>
            </div>

            <div className="support-form-group">
              <label>
                Priority Level <span>*</span>
              </label>

              <div className="support-priority-options">
                {(['low', 'medium', 'high'] as Priority[]).map((level) => (
                  <button
                    type="button"
                    key={level}
                    className={`support-priority support-priority-${level} ${
                      priority === level ? 'selected' : ''
                    }`}
                    onClick={() => setPriority(level)}
                  >
                    <span className="support-priority-dot" />
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="support-info-box">
              <AlertTriangle size={19} />
              <p>
                Use this form only for technical problems involving your
                account, bookings, payments, notifications, chat, or other
                CaterConnect system features.
              </p>
            </div>

            <div className="support-form-actions">
              <button
                type="submit"
                className="support-submit-button"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <span className="support-spinner" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send size={17} />
                    Submit Technical Report
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="support-history-card">
          <div className="support-history-heading">
            <div>
              <h2>My Technical Reports</h2>
              <p>View the status and updates of your submitted reports.</p>
            </div>

            <button
              type="button"
              className="support-refresh-button"
              onClick={loadHistory}
              disabled={loadingHistory}
              aria-label="Refresh complaints"
            >
              <RefreshCw
                size={17}
                className={loadingHistory ? 'support-refreshing' : ''}
              />
              Refresh
            </button>
          </div>

          {loadingHistory ? (
            <CatererSkeleton variant="complaints" label="Loading technical reports" />
          ) : complaints.length === 0 ? (
            <div className="support-empty-state">
              <div className="support-empty-icon">
                <Inbox size={34} />
              </div>
              <h3>No Technical Reports Yet</h3>
              <p>
                You have not submitted any technical reports. If you encounter
                a problem, you can submit one using the New Complaint tab.
              </p>
              <button type="button" onClick={() => setTab('new')}>
                Submit a Report
              </button>
            </div>
          ) : (
            <div className="support-complaint-list">
              {complaints.map((complaint) => (
                <article className="support-complaint-item" key={complaint.id}>
                  <div className="support-complaint-top">
                    <div className="support-complaint-title">
                      <h3>{complaint.subject || complaint.complaint_type}</h3>
                      {complaint.subject && (
                        <span>{complaint.complaint_type}</span>
                      )}
                    </div>

                    <div
                      className={`support-status support-status-${complaint.status}`}
                    >
                      {getStatusIcon(complaint.status)}
                      {STATUS_LABELS[complaint.status] || complaint.status}
                    </div>
                  </div>

                  <p className="support-complaint-description">
                    {complaint.description}
                  </p>

                  <div className="support-complaint-meta">
                    <span>
                      <Clock size={14} />
                      {formatDate(complaint.created_at)}
                    </span>

                    <span
                      className={`support-priority-label support-priority-label-${complaint.priority}`}
                    >
                      {complaint.priority.charAt(0).toUpperCase() +
                        complaint.priority.slice(1)}{' '}
                      Priority
                    </span>
                  </div>

                  {complaint.resolution_notes && (
                    <div className="support-resolution">
                      <div className="support-resolution-heading">
                        <CheckCircle2 size={17} />
                        <strong>Staff Resolution</strong>
                      </div>
                      <p>{complaint.resolution_notes}</p>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
