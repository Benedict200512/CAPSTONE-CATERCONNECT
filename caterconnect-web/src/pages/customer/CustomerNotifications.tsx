import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bell,
  BellRing,
  CheckCheck,
  CircleCheck,
  CreditCard,
  MessageSquare,
  CalendarDays,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
  Filter,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import CustomerHeader from "./CustomerHeader";
import "./CustomerNotifications.css";

type CustomerNotification = {
  id: string;
  user_id: string;
  title: string | null;
  message: string | null;
  type: string | null;
  booking_id: string | null;
  is_read: boolean;
  created_at: string;
};
type FilterType = "all" | "unread";
const CHANGE_EVENT = "cc:customer-notifications-changed";

function notificationIcon(type: string | null) {
  const label = (type ?? "").toLowerCase();
  if (label.includes("message")) return MessageSquare;
  if (
    label.includes("payment") ||
    label.includes("refund") ||
    label.includes("downpayment")
  )
    return CreditCard;
  if (
    label.includes("booking") ||
    label.includes("package") ||
    label.includes("review")
  )
    return CalendarDays;
  if (
    label.includes("flag") ||
    label.includes("dispute") ||
    label.includes("overdue")
  )
    return AlertCircle;
  return Bell;
}

function when(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}

export default function CustomerNotifications() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? "";
  const navigate = useNavigate();
  const [rows, setRows] = useState<CustomerNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  const load = useCallback(
    async (showLoading = false) => {
      if (!userId) {
        setRows([]);
        setLoading(false);
        return;
      }
      if (showLoading) setRefreshing(true);
      try {
        setError("");
        const { data, error: fetchError } = await supabase
          .from("notifications")
          .select("id,user_id,title,message,type,booking_id,is_read,created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(150);
        if (fetchError) throw fetchError;
        setRows((data ?? []) as CustomerNotification[]);
        window.dispatchEvent(new Event(CHANGE_EVENT));
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to load notifications.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    setLoading(true);
    setRows([]);
    void load();
  }, [load]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`customer-notifications-page:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void load();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, load]);

  const unreadCount = useMemo(
    () => rows.filter((item) => !item.is_read).length,
    [rows],
  );
  const filtered = useMemo(
    () => (filter === "unread" ? rows.filter((item) => !item.is_read) : rows),
    [filter, rows],
  );

  const markRead = async (item: CustomerNotification) => {
    if (!userId || item.is_read || busyId) return true;
    setBusyId(item.id);
    setActionError("");
    try {
      const { error: updateError } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", item.id)
        .eq("user_id", userId);
      if (updateError) throw updateError;
      setRows((current) =>
        current.map((row) =>
          row.id === item.id ? { ...row, is_read: true } : row,
        ),
      );
      window.dispatchEvent(new Event(CHANGE_EVENT));
      return true;
    } catch (caught) {
      setActionError(
        caught instanceof Error
          ? caught.message
          : "Unable to mark notification as read.",
      );
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const markAllRead = async () => {
    if (!userId || markingAll || unreadCount === 0) return;
    setMarkingAll(true);
    setActionError("");
    try {
      // Only update rows currently loaded; never alter another user's notifications.
      const ids = rows.filter((item) => !item.is_read).map((item) => item.id);
      const { error: updateError } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", userId)
        .in("id", ids);
      if (updateError) throw updateError;
      setRows((current) =>
        current.map((item) =>
          ids.includes(item.id) ? { ...item, is_read: true } : item,
        ),
      );
      window.dispatchEvent(new Event(CHANGE_EVENT));
    } catch (caught) {
      setActionError(
        caught instanceof Error
          ? caught.message
          : "Unable to mark notifications as read.",
      );
    } finally {
      setMarkingAll(false);
    }
  };

  const openNotification = async (item: CustomerNotification) => {
    const ok = await markRead(item);
    if (!ok) return;
    // Only navigate to an authorized customer booking by ID; the Bookings page
    // verifies ownership before opening its details modal.
    if (!item.booking_id) return;
    const isMessage = (item.type ?? "").toLowerCase().includes("message");
    navigate(isMessage
      ? `/customer/messages?bookingId=${encodeURIComponent(item.booking_id)}`
      : `/customer/bookings?bookingId=${encodeURIComponent(item.booking_id)}`);

  };

  return (
    <div className="cc-cn-page">
      <CustomerHeader />
      <main className="cc-cn-main">
        <Link to="/customer" className="cc-cn-back">
          <ArrowLeft size={17} /> Back to Marketplace
        </Link>
        <div className="cc-cn-top">
          <div>
            <span className="cc-cn-eyebrow">
              <BellRing size={17} /> CUSTOMER UPDATES
            </span>
            <h1>Notifications</h1>
            <p>
              Stay informed about your catering requests, payments, refunds, and
              messages.
            </p>
          </div>
          <div className="cc-cn-actions">
            <button
              type="button"
              className="cc-cn-refresh"
              onClick={() => void load(true)}
              disabled={loading || refreshing}
              aria-label="Refresh notifications"
              title="Refresh notifications"
            >
              <RefreshCw
                size={18}
                className={refreshing ? "cc-cn-spinning" : ""}
              />
            </button>
            <button
              type="button"
              className="cc-cn-mark-all"
              disabled={markingAll || unreadCount === 0 || loading}
              onClick={() => void markAllRead()}
            >
              <CheckCheck size={18} />{" "}
              {markingAll ? "Updating..." : "Mark all as read"}
            </button>
          </div>
        </div>
        <div className="cc-cn-summary">
          <Bell size={19} />
          <strong>{unreadCount}</strong> unread{" "}
          {unreadCount === 1 ? "notification" : "notifications"}
        </div>
        <div
          className="cc-cn-tabs"
          role="group"
          aria-label="Filter notifications"
        >
          <button
            type="button"
            className={filter === "all" ? "active" : ""}
            onClick={() => setFilter("all")}
          >
            <Filter size={16} /> All <span>{rows.length}</span>
          </button>
          <button
            type="button"
            className={filter === "unread" ? "active" : ""}
            onClick={() => setFilter("unread")}
          >
            Unread <span>{unreadCount}</span>
          </button>
        </div>
        {error && (
          <div className="cc-cn-error" role="alert">
            {error}{" "}
            <button type="button" onClick={() => void load(true)}>
              Retry
            </button>
          </div>
        )}
        {actionError && (
          <div className="cc-cn-error" role="alert">
            {actionError}
          </div>
        )}
        <section className="cc-cn-list" aria-label="Customer notifications">
          {loading ? (
            <div className="cc-cn-empty">Loading notifications...</div>
          ) : filtered.length === 0 ? (
            <div className="cc-cn-empty">
              <CircleCheck size={38} />
              <h2>
                {filter === "unread"
                  ? "You are all caught up!"
                  : "No notifications yet"}
              </h2>
              <p>
                {filter === "unread"
                  ? "You have no unread notifications."
                  : "Your customer account updates will appear here."}
              </p>
            </div>
          ) : (
            filtered.map((item) => {
              const Icon = notificationIcon(item.type);
              const canNavigate = Boolean(item.booking_id);
              const isMessage = (item.type ?? "").toLowerCase().includes("message");
              return (
                <article
                  className={`cc-cn-item${item.is_read ? "" : " unread"}`}
                  key={item.id}
                >
                  <div className="cc-cn-item-icon">
                    <Icon size={20} />
                  </div>
                  <div className="cc-cn-item-body">
                    <div className="cc-cn-item-heading">
                      <h2>{item.title || "CaterConnect Update"}</h2>
                      {!item.is_read && (
                        <span className="cc-cn-dot" title="Unread" />
                      )}
                    </div>
                    <p>{item.message || "You have a new notification."}</p>
                    <time dateTime={item.created_at}>
                      {when(item.created_at)}
                    </time>
                    {item.booking_id && !isMessage && (
                      <span className="cc-cn-booking-note">
                        Booking update · Select View booking details to open it
                      </span>
                    )}
                    <div className="cc-cn-item-actions">
                      {canNavigate && (
                        <button
                          type="button"
                          onClick={() => void openNotification(item)}
                          disabled={busyId === item.id}
                        >
                          {isMessage ? <MessageSquare size={15} /> : <CalendarDays size={15} />}
                          {isMessage ? "View conversation" : "View booking details"}
                        </button>
                      )}
                      {!item.is_read && (
                        <button
                          type="button"
                          onClick={() => void markRead(item)}
                          disabled={busyId === item.id}
                        >
                          <CheckCheck size={15} />{" "}
                          {busyId === item.id ? "Updating..." : "Mark as read"}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </section>
      </main>
    </div>
  );
}
