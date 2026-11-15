import { useEffect, useRef, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { supabase } from "../../lib/supabase";
import {
  CANCELLATIONS_PAGE_SIZE,
  cancellationTiming,
  daysBeforeEventAtCancellation,
  filterCatererCancellations,
  loadCatererCancellationPage,
  recordedCancellationDate,
  recordedRefundAmount,
  recordedRefundStatus,
  type CancellationFilter,
  type CatererCancellation,
} from "../../lib/staffCatererCancellations";
import "./CatererCancellationMonitoring.css";

const FILTERS: { value: CancellationFilter; label: string }[] = [
  { value: "all", label: "All Caterer Cancellations" },
  { value: "urgent", label: "Urgent Cancellations" },
  { value: "other", label: "Other Caterer Cancellations" },
];

type CustomerNames = Record<string, string>;

export function CancellationRecords({
  bookings,
  customerNames = {},
  loadingNames = false,
}: {
  bookings: CatererCancellation[];
  customerNames?: CustomerNames;
  loadingNames?: boolean;
}) {
  return (
    <div
      className="staff-cancellation-table-scroll"
      tabIndex={0}
      role="region"
      aria-label="Caterer cancellation records"
    >
      <table className="booking-table staff-cancellation-table">
        <thead>
          <tr>
            <th>Booking reference</th>
            <th>Caterer</th>
            <th>Customer name</th>
            <th>Original event date</th>
            <th>Cancellation date (Philippine time)</th>
            <th>Cancellation reason</th>
            <th>Days before event at cancellation</th>
            <th>Recorded refund amount</th>
            <th>Refund status</th>
            <th>Refund deadline (Philippine time)</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((booking) => {
            const timing = cancellationTiming(booking);
            const days = daysBeforeEventAtCancellation(booking);
            const caterer = Array.isArray(booking.caterers)
              ? booking.caterers[0]
              : booking.caterers;
            return (
              <tr
                key={booking.id}
                className={
                  timing === "urgent" ? "staff-cancellation-urgent" : ""
                }
              >
                <td>
                  <code>{booking.id}</code>
                  <span className={`staff-cancellation-timing ${timing}`}>
                    {timing === "urgent"
                      ? "Urgent — Last-Minute Cancellation"
                      : timing === "unknown"
                        ? "Timing unavailable"
                        : "Outside 0–7 day window"}
                  </span>
                </td>
                <td>
                  {caterer?.business_name || "Name unavailable"}
                  <small>Caterer reference: {booking.caterer_id}</small>
                </td>
                <td className="staff-cancellation-customer-name">
                  {customerNames[booking.customer_id] ||
                    (loadingNames
                      ? "Loading customer name…"
                      : "Name unavailable")}
                </td>
                <td>{booking.event_date || "Not recorded"}</td>
                <td>{recordedCancellationDate(booking.cancelled_at)}</td>
                <td className="staff-cancellation-reason">
                  {booking.cancellation_reason || "Not recorded"}
                </td>
                <td>
                  {days === null
                    ? "Unknown — missing or invalid date"
                    : days < 0
                      ? `${Math.abs(days)} days after event date`
                      : `${days} days`}
                </td>
                <td>{recordedRefundAmount(booking.refund_amount)}</td>
                <td>{recordedRefundStatus(booking.refund_status)}</td>
                <td>
                  {booking.refund_due_at
                    ? recordedCancellationDate(booking.refund_due_at)
                    : "Not recorded"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function CatererCancellationMonitoring() {
  const [bookings, setBookings] = useState<CatererCancellation[]>([]);
  const [customerNames, setCustomerNames] = useState<CustomerNames>({});
  const [customerNamesNotice, setCustomerNamesNotice] = useState("");
  const [filter, setFilter] = useState<CancellationFilter>("all");
  const [offset, setOffset] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const loadingRef = useRef(true);

  useEffect(() => {
    let active = true;
    loadingRef.current = true;
    setLoading(true);
    setError("");
    setCustomerNamesNotice("");
    const load = async () => {
      try {
        const rows = await loadCatererCancellationPage(offset);
        if (!active) return;
        setBookings((current) =>
          offset === 0
            ? rows
            : [
                ...new Map(
                  [...current, ...rows].map((row) => [row.id, row]),
                ).values(),
              ],
        );
        setHasMore(rows.length === CANCELLATIONS_PAGE_SIZE);

        // Resolve names through existing authenticated profiles access. No new API,
        // table, RPC, or permission is required. Never expose customer UUIDs as names.
        const customerIds = [
          ...new Set(
            rows
              .map((row) => row.customer_id)
              .filter(
                (id): id is string => typeof id === "string" && id.length > 0,
              ),
          ),
        ];
        if (customerIds.length > 0) {
          const { data: profiles, error: profileError } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", customerIds);
          if (!active) return;
          if (profileError) {
            setCustomerNamesNotice(
              "Some customer names could not be loaded with your existing Staff permissions.",
            );
          } else {
            setCustomerNames((current) => {
              const updated =
                offset === 0 ? ({} as CustomerNames) : { ...current };
              for (const profile of profiles ?? []) {
                const name =
                  typeof profile.full_name === "string"
                    ? profile.full_name.trim()
                    : "";
                updated[profile.id] = name || "Name not provided";
              }
              return updated;
            });
          }
        } else if (offset === 0) {
          setCustomerNames({});
        }
      } catch (cause) {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load caterer cancellations.",
          );
      } finally {
        if (active) {
          loadingRef.current = false;
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [offset, refreshKey]);

  const filtered = filterCatererCancellations(bookings, filter);
  const unknown = filterCatererCancellations(bookings, "all").filter(
    (row) => cancellationTiming(row) === "unknown",
  ).length;

  return (
    <section
      className="staff-cancellation-monitoring"
      aria-labelledby="staff-cancellations-title"
      aria-busy={loading}
    >
      <div className="staff-cancellation-heading">
        <div>
          <h2 id="staff-cancellations-title">
            <AlertTriangle size={20} /> Emergency Caterer Cancellations
          </h2>
          <p>
            Read-only monitoring of Caterer-initiated cancellations. Urgency
            uses the saved cancellation timestamp and Philippine calendar dates,
            not today's date.
          </p>
        </div>
        <button
          type="button"
          className="staff-cancellation-button"
          disabled={loading}
          onClick={() => {
            if (loadingRef.current) return;
            loadingRef.current = true;
            setBookings([]);
            setCustomerNames({});
            setHasMore(false);
            setOffset(0);
            setRefreshKey((value) => value + 1);
          }}
        >
          <RefreshCw size={15} /> Refresh cancellations
        </button>
      </div>
      <div
        className="staff-cancellation-filters"
        role="group"
        aria-label="Caterer cancellation filters"
      >
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            aria-pressed={filter === item.value}
            className={`staff-cancellation-button ${filter === item.value ? "active" : ""}`}
            onClick={() => setFilter(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <p>
        {bookings.length} records loaded; {filtered.length} match this filter.
        Filters apply to loaded records.{" "}
        {hasMore ? "Load more to include older cancellations." : ""}
      </p>
      {unknown > 0 && (
        <p>
          {unknown} loaded records have unavailable timing and appear only under
          All Caterer Cancellations.
        </p>
      )}
      {customerNamesNotice && (
        <p className="staff-cancellation-name-notice">{customerNamesNotice}</p>
      )}
      {error && (
        <p role="alert" className="staff-cancellation-error">
          {error}{" "}
          <button
            type="button"
            className="staff-cancellation-button"
            disabled={loading}
            onClick={() => setRefreshKey((value) => value + 1)}
          >
            Retry
          </button>
        </p>
      )}
      {filtered.length > 0 && (
        <CancellationRecords
          bookings={filtered}
          customerNames={customerNames}
          loadingNames={loading}
        />
      )}
      {loading && <p role="status">Loading caterer cancellations…</p>}
      {!loading && !error && filtered.length === 0 && (
        <p>
          No matching cancellations in the loaded records. Only records visible
          under your existing permissions can be shown.
        </p>
      )}
      {hasMore && !error && (
        <button
          type="button"
          className="staff-cancellation-button"
          disabled={loading}
          onClick={() => {
            if (loadingRef.current) return;
            loadingRef.current = true;
            setOffset((value) => value + CANCELLATIONS_PAGE_SIZE);
          }}
        >
          Load more cancellations
        </button>
      )}
      <p>
        Missing refund information is not estimated. An urgent cancellation is
        not a finding of misconduct.
      </p>
      <p>
        Use the account search and filters above to investigate the displayed
        caterer. Existing investigation, flagging, suspension and appeal rules
        apply; this section does not change any account.
      </p>
    </section>
  );
}
