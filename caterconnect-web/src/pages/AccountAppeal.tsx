import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  CheckCircle2,
  Clock3,
  RefreshCcw,
  Send,
  ShieldAlert,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { submitAccountAppeal } from "../lib/auth";
import { supabase } from "../lib/supabase";
import "./AccountAppeal.css";

type Appeal = {
  id: string;
  appeal_message: string;
  evidence_url: string | null;
  status: string;
  staff_explanation: string | null;
  admin_decision: string | null;
  admin_decided_at: string | null;
  created_at: string;
};
type AppealNotification = {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
};
const dateText = (value: string | null) =>
  value ? new Date(value).toLocaleString() : "";

export default function AccountAppeal() {
  const navigate = useNavigate();
  const { session, profile, loading: authLoading, reloadAccount } = useAuth();
  const [appeal, setAppeal] = useState<Appeal | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppealNotification[]>([]);
  const [message, setMessage] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const userId = session?.user.id;
  const isEligibleRole =
    profile?.role === "customer" || profile?.role === "caterer";
  const isSuspended =
    String(profile?.status ?? "")
      .trim()
      .toLowerCase() === "suspended";

  const loadAppeal = useCallback(async () => {
    if (!userId || !isEligibleRole || !isSuspended) return;
    setLoading(true);
    setError("");
    try {
      const [appeals, cases, notices] = await Promise.all([
        supabase
          .from("account_appeals")
          .select(
            "id, appeal_message, evidence_url, status, staff_explanation, admin_decision, admin_decided_at, created_at",
          )
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("account_monitoring_cases")
          .select("reason")
          .eq("user_id", userId)
          .eq("suspended", true)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("notifications")
          .select("id, title, message, type, is_read, created_at")
          .eq("user_id", userId)
          .in("type", [
            "account_appeal_approved",
            "account_appeal_rejected",
            "account_appeal_admin_decision",
          ])
          .order("created_at", { ascending: false })
          .limit(10),
      ]);
      if (appeals.error) throw appeals.error;
      const latest = (appeals.data ?? null) as Appeal | null;
      setAppeal(latest);
      setMessage(latest?.appeal_message ?? "");
      setEvidenceUrl(latest?.evidence_url ?? "");
      // Suspension reason and notifications are supplementary; don't block appeals if unavailable.
      if (cases.error)
        console.warn("Suspension reason unavailable:", cases.error.message);
      setReason(cases.error ? null : (cases.data?.reason ?? null));
      if (notices.error)
        console.warn(
          "Appeal notifications unavailable:",
          notices.error.message,
        );
      setNotifications(
        notices.error ? [] : ((notices.data ?? []) as AppealNotification[]),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to load your appeal. Please refresh.",
      );
    } finally {
      setLoading(false);
    }
  }, [userId, isEligibleRole, isSuspended]);

  useEffect(() => {
    void loadAppeal();
  }, [loadAppeal]);
  const status = String(appeal?.status ?? "")
    .trim()
    .toLowerCase();
  const decision = String(appeal?.admin_decision ?? "")
    .trim()
    .toLowerCase();
  const rejected = status === "rejected";
  const waiting =
    status === "pending" ||
    status === "approved" ||
    status === "forwarded_to_admin" ||
    status === "forwarded to admin";
  const restored = status === "account restored" || decision === "unsuspend";
  const keptSuspended = decision === "keep suspended";
  const canSubmit = !appeal || (rejected && !waiting && !restored);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !canSubmit) return;
    if (message.trim().length < 10 || message.trim().length > 5000) {
      setError("Appeal explanation must contain 10 to 5000 characters.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const result = await submitAccountAppeal(message, evidenceUrl);
      if (result.error) throw result.error;
      setSuccess(
        rejected
          ? "Appeal resubmitted successfully. Your account remains suspended."
          : "Appeal submitted successfully. Your account remains suspended pending review.",
      );
      await loadAppeal();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Appeal submission failed.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (authLoading)
    return (
      <main className="cc-appeal-page">
        <p role="status">Checking account status...</p>
      </main>
    );
  if (!session || !profile) return <Navigate to="/login" replace />;
  if (!isEligibleRole) return <Navigate to="/login" replace />;
  if (!isSuspended)
    return (
      <Navigate
        to={profile.role === "customer" ? "/customer" : "/caterer"}
        replace
      />
    );

  return (
    <main className="cc-appeal-page">
      <div className="cc-appeal-shell">
        <nav className="cc-appeal-nav">
          <Link to="/login">
            <ArrowLeft size={17} /> Back to Login
          </Link>
          <button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate("/login", { replace: true });
            }}
          >
            Sign Out
          </button>
        </nav>
        <div className="cc-appeal-heading">
          <span className="cc-appeal-icon">
            <ShieldAlert size={35} />
          </span>
          <h1>Account Appeal</h1>
          <p>Request a review of your suspended CaterConnect account.</p>
        </div>
        <section className="cc-appeal-alert" role="status">
          <strong>
            <AlertCircle size={18} /> Account Suspended
          </strong>
          <p>
            Your dashboard remains inaccessible while your account is suspended,
            even after submitting an appeal.
          </p>
        </section>
        {loading ? (
          <p className="cc-appeal-loading" role="status">
            Loading your appeal...
          </p>
        ) : (
          <>
            {reason && (
              <section className="cc-appeal-panel">
                <h2>Reason for Suspension</h2>
                <p>{reason}</p>
              </section>
            )}
            {appeal && (
              <section className="cc-appeal-panel">
                <h2>
                  <Clock3 size={19} /> Latest Appeal Status
                </h2>
                <p className="cc-appeal-status">{appeal.status}</p>
                {appeal.staff_explanation && (
                  <div className="cc-appeal-explanation">
                    <strong>Staff Explanation</strong>
                    <p>{appeal.staff_explanation}</p>
                  </div>
                )}
                {status === "pending" && (
                  <p>Your appeal is waiting for Platform Staff review.</p>
                )}
                {(status === "approved" ||
                  status === "forwarded_to_admin" ||
                  status === "forwarded to admin") &&
                  !restored &&
                  !keptSuspended && (
                    <p>
                      Staff approved your appeal. An Administrator must make the
                      final decision before account access can be restored.
                    </p>
                  )}
                {restored && (
                  <p>
                    <CheckCircle2 size={16} /> Your appeal indicates account
                    restoration. Refresh your account status to confirm access.
                  </p>
                )}
                {keptSuspended && (
                  <p>
                    The Administrator decided to keep the account suspended.
                  </p>
                )}
                {rejected && (
                  <p>
                    You may revise your explanation and resubmit your appeal.
                  </p>
                )}
                <small>Submitted: {dateText(appeal.created_at)}</small>
                {appeal.admin_decided_at && (
                  <small>
                    Admin decision: {dateText(appeal.admin_decided_at)}
                  </small>
                )}
              </section>
            )}
            {notifications.length > 0 && (
              <section className="cc-appeal-panel">
                <h2>
                  <Bell size={19} /> Appeal Notifications
                </h2>
                {notifications.map((item) => (
                  <article key={item.id} className="cc-appeal-notification">
                    <strong>
                      {item.title}{" "}
                      {!item.is_read && (
                        <span className="cc-appeal-new">NEW</span>
                      )}
                    </strong>
                    <p>{item.message}</p>
                    <small>{dateText(item.created_at)}</small>
                  </article>
                ))}
              </section>
            )}
            {!restored && (
              <section className="cc-appeal-panel">
                <h2>{rejected ? "Edit Your Appeal" : "Appeal Explanation"}</h2>
                <form onSubmit={handleSubmit}>
                  <label htmlFor="cc-appeal-message">
                    Your Appeal Explanation *
                  </label>
                  <textarea
                    id="cc-appeal-message"
                    rows={6}
                    minLength={10}
                    maxLength={5000}
                    placeholder="Explain why you believe your account should be reviewed..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    disabled={!canSubmit || saving}
                    required
                  />
                  <small className="cc-appeal-counter">
                    {message.length}/5000 characters
                  </small>
                  <label htmlFor="cc-appeal-evidence">
                    Evidence Link (Optional)
                  </label>
                  <input
                    id="cc-appeal-evidence"
                    type="url"
                    placeholder="https://..."
                    value={evidenceUrl}
                    onChange={(e) => setEvidenceUrl(e.target.value)}
                    disabled={!canSubmit || saving}
                  />
                  {canSubmit ? (
                    <button
                      className="cc-appeal-primary"
                      type="submit"
                      disabled={saving || message.trim().length < 10}
                    >
                      <Send size={17} />{" "}
                      {saving
                        ? "Submitting..."
                        : rejected
                          ? "Resubmit Appeal"
                          : "Submit Appeal"}
                    </button>
                  ) : (
                    <p className="cc-appeal-wait">
                      <Clock3 size={17} />{" "}
                      {keptSuspended
                        ? "Appeal decision issued"
                        : "Waiting for review — submission unavailable"}
                    </p>
                  )}
                </form>
              </section>
            )}
            {error && (
              <p className="cc-appeal-feedback cc-appeal-error" role="alert">
                {error}
              </p>
            )}
            {success && (
              <p className="cc-appeal-feedback cc-appeal-success" role="status">
                {success}
              </p>
            )}
            <div className="cc-appeal-actions">
              <button type="button" onClick={() => void loadAppeal()}>
                <RefreshCcw size={16} /> Refresh Appeal
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await reloadAccount();
                    await loadAppeal();
                  } catch {
                    setError("Unable to refresh account status.");
                  }
                }}
              >
                <RefreshCcw size={16} /> Check Account Status
              </button>
            </div>
            <p className="cc-appeal-footnote">
              Submitting an appeal does not automatically reactivate an account.
              Staff review and an authorized Admin decision are required.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
