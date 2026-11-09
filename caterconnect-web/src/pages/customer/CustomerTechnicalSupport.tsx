import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ClipboardList,
  FileText,
  Headphones,
  RefreshCw,
  AlertTriangle,
  Send,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import CustomerHeader from "./CustomerHeader";
import "./CustomerProfile.css";

const TYPES = [
  "Login & Account Issues",
  "Booking System Error",
  "Payment System Issue",
  "Notification Issue",
  "Chat & Messaging Issue",
  "App Performance Issue",
  "Privacy & Security Issue",
  "Other Technical Issue",
];
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
export default function CustomerTechnicalSupport() {
  const { session, profile } = useAuth();
  const userId = session?.user.id;
  const owner =
    !!userId && profile?.id === userId && profile?.role === "customer";
  const [tab, setTab] = useState<"new" | "history">("new");
  const [category, setCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<Complaint[]>([]);
  const [historyOwner, setHistoryOwner] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const version = useRef(0);
  const loadHistory = useCallback(async () => {
    if (!owner || !userId) return;
    const request = ++version.current;
    setHistoryLoading(true);
    setHistoryError("");
    setHistoryOwner(userId);
    try {
      const { data, error: loadError } = await supabase
        .from("complaints")
        .select(
          "id, complaint_type, subject, description, priority, status, resolution_notes, created_at",
        )
        .eq("reporter_id", userId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (loadError) throw loadError;
      if (version.current === request) setHistory((data ?? []) as Complaint[]);
    } catch (cause) {
      if (version.current === request) {
        setHistory([]);
        setHistoryError(
          cause instanceof Error ? cause.message : "Could not load reports.",
        );
      }
    } finally {
      if (version.current === request) setHistoryLoading(false);
    }
  }, [owner, userId]);
  useEffect(() => {
    if (tab === "history") void loadHistory();
    return () => {
      version.current++;
    };
  }, [tab, loadHistory]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!owner || !userId) {
      setError("Please sign in with your customer account.");
      return;
    }
    if (!TYPES.includes(category)) {
      setError("Choose a technical issue type.");
      return;
    }
    if (!description.trim()) {
      setError("Describe the issue before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      const { error: insertError } = await supabase
        .from("complaints")
        .insert({
          reporter_id: userId,
          reporter_role: "customer",
          complaint_type: category,
          subject: subject.trim() || null,
          description: description.trim(),
          priority,
          status: "open",
        });
      if (insertError) throw insertError;
      setCategory("");
      setSubject("");
      setDescription("");
      setPriority("medium");
      setMessage(
        "Your technical report was submitted to Platform Staff for review.",
      );
      setHistoryOwner(null);
      setTab("history");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not submit report.",
      );
    } finally {
      setSubmitting(false);
    }
  };
  const visibleHistory = owner && historyOwner === userId ? history : [];
  return (
    <div className="cc-profile-shell">
      <CustomerHeader activePage="profile" />
      <main className="cc-profile-main cc-profile-narrow">
        <Link className="cc-profile-back" to="/customer/profile">
          <ArrowLeft size={17} /> Back to Profile
        </Link>
        <div className="cc-profile-overline">
          <Headphones size={17} /> CUSTOMER SUPPORT
        </div>
        <h1>Technical Support</h1>
        <p className="cc-profile-subtitle">
          Report technical problems with CaterConnect and check your existing
          reports.
        </p>
        <div className="cc-profile-tabs">
          <button
            className={tab === "new" ? "selected" : ""}
            type="button"
            onClick={() => setTab("new")}
          >
            <FileText size={17} /> New Report
          </button>
          <button
            className={tab === "history" ? "selected" : ""}
            type="button"
            onClick={() => setTab("history")}
          >
            <ClipboardList size={17} /> My Reports
          </button>
        </div>
        {message && (
          <p className="cc-profile-success" role="status">
            {message}
          </p>
        )}
        {tab === "new" && (
          <form className="cc-profile-card cc-profile-form" onSubmit={submit}>
            <label>
              <span>Type of Issue *</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
              >
                <option value="">Select a technical issue</option>
                {TYPES.map((type) => (
                  <option value={type} key={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Subject (optional)</span>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={200}
                placeholder="e.g. I cannot update my profile"
              />
            </label>
            <label>
              <span>Description *</span>
              <textarea
                rows={6}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={5000}
                placeholder="What happened? When? What error did you see? Never include passwords or card details."
                required
              />
            </label>
            <fieldset className="cc-profile-priority">
              <legend>Priority</legend>
              {(["low", "medium", "high"] as const).map((p) => (
                <label key={p} className={priority === p ? "chosen" : ""}>
                  <input
                    type="radio"
                    name="priority"
                    checked={priority === p}
                    onChange={() => setPriority(p)}
                  />
                  {p[0].toUpperCase() + p.slice(1)}
                </label>
              ))}
            </fieldset>
            <div className="cc-profile-note">
              <AlertTriangle size={18} />
              <span>
                For website, account, payment-system, and other technical
                problems only. For catering-service concerns, contact the
                caterer directly.
              </span>
            </div>
            {error && (
              <p className="cc-profile-error" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="cc-profile-primary"
              disabled={!owner || submitting}
            >
              <Send size={17} />
              {submitting ? "Submitting..." : "Submit Technical Report"}
            </button>
          </form>
        )}
        {tab === "history" && (
          <section className="cc-profile-card cc-profile-reports">
            <div className="cc-profile-report-header">
              <h2>My Technical Reports</h2>
              <button
                type="button"
                className="cc-profile-secondary"
                disabled={historyLoading}
                onClick={() => void loadHistory()}
              >
                <RefreshCw size={16} /> Refresh
              </button>
            </div>
            {historyError && (
              <p className="cc-profile-error" role="alert">
                {historyError}
              </p>
            )}
            {historyLoading ? (
              <p>Loading reports...</p>
            ) : visibleHistory.length ? (
              visibleHistory.map((row) => (
                <article className="cc-profile-report" key={row.id}>
                  <div className="cc-profile-report-head">
                    <strong>{row.subject || row.complaint_type}</strong>
                    <span
                      className={`cc-profile-status cc-profile-status-${row.status}`}
                    >
                      {row.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <small>
                    {row.complaint_type} · {row.priority} priority ·{" "}
                    {new Date(row.created_at).toLocaleDateString("en-PH")}
                  </small>
                  <p>{row.description}</p>
                  {row.resolution_notes && (
                    <div className="cc-profile-resolution">
                      <strong>Staff response</strong>
                      <p>{row.resolution_notes}</p>
                    </div>
                  )}
                </article>
              ))
            ) : (
              !historyError && (
                <p className="cc-profile-empty">
                  You haven't submitted a technical report yet.
                </p>
              )
            )}
            {visibleHistory.length === 100 && (
              <small>Showing the 100 most recent reports.</small>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
