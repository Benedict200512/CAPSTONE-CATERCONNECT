import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  X,
} from "lucide-react";
import { manilaToday, shiftMonth } from "../../lib/availability";
import "./CustomerAvailabilityCalendar.css";

type Props = {
  selected: string;
  blockedDates: string[];
  loading: boolean;
  error: string;
  onSelect: (date: string) => void;
  onRefresh: () => void;
};

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CustomerAvailabilityCalendar({
  selected,
  blockedDates,
  loading,
  error,
  onSelect,
  onRefresh,
}: Props) {
  const today = manilaToday();
  const thisMonth = today.slice(0, 7);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(thisMonth);
  const unavailable = useMemo(() => new Set(blockedDates), [blockedDates]);

  const calendarDays = useMemo(() => {
    const [year, number] = month.split("-").map(Number);
    const firstDay = new Date(Date.UTC(year, number - 1, 1)).getUTCDay();
    const count = new Date(Date.UTC(year, number, 0)).getUTCDate();
    return [
      ...Array<null>(firstDay).fill(null),
      ...Array.from(
        { length: count },
        (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`,
      ),
    ];
  }, [month]);

  const title = useMemo(() => {
    const [year, number] = month.split("-").map(Number);
    return new Intl.DateTimeFormat("en-PH", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(year, number - 1, 1)));
  }, [month]);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", dismiss);
    return () => document.removeEventListener("keydown", dismiss);
  }, [open]);

  const openCalendar = () => {
    setMonth(selected && selected >= today ? selected.slice(0, 7) : thisMonth);
    setOpen(true);
    onRefresh();
  };

  const selectedUnavailable =
    selected && (selected < today || unavailable.has(selected));

  return (
    <div className="cc-av-field">
      <span className="cc-av-label">Event date *</span>
      <button
        type="button"
        className={`cc-av-open ${selectedUnavailable ? "cc-av-invalid" : ""}`}
        onClick={openCalendar}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <CalendarDays size={18} aria-hidden="true" />
        <span>
          {selected
            ? `${selected}${selectedUnavailable ? " (Unavailable)" : ""}`
            : "Choose event date"}
        </span>
      </button>
      {selectedUnavailable && (
        <p className="cc-av-warning" role="alert">
          This date is blocked, fully booked, or in the past. Choose another
          date.
        </p>
      )}
      {open && (
        <div
          className="cc-av-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            className="cc-av-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Choose event date"
          >
            <div className="cc-av-heading">
              <h3>Choose event date</h3>
              <button
                type="button"
                className="cc-av-icon"
                aria-label="Close calendar"
                onClick={() => setOpen(false)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="cc-av-navigation">
              <button
                type="button"
                className="cc-av-icon"
                aria-label="Previous month"
                disabled={month <= thisMonth}
                onClick={() => setMonth((current) => shiftMonth(current, -1))}
              >
                <ChevronLeft size={20} />
              </button>
              <strong aria-live="polite">{title}</strong>
              <button
                type="button"
                className="cc-av-icon"
                aria-label="Next month"
                disabled={month >= "2100-12"}
                onClick={() => setMonth((current) => shiftMonth(current, 1))}
              >
                <ChevronRight size={20} />
              </button>
            </div>
            <div className="cc-av-grid" role="group" aria-label={title}>
              {days.map((day) => (
                <span key={day} className="cc-av-weekday">
                  {day}
                </span>
              ))}
              {calendarDays.map((date, index) =>
                date === null ? (
                  <span key={`empty-${index}`} aria-hidden="true" />
                ) : (
                  <button
                    type="button"
                    key={date}
                    className={`cc-av-day ${selected === date ? "cc-av-selected" : ""} ${unavailable.has(date) ? "cc-av-blocked" : ""}`}
                    disabled={
                      loading ||
                      !!error ||
                      date < today ||
                      unavailable.has(date)
                    }
                    aria-label={`${date}${unavailable.has(date) ? ", unavailable" : date < today ? ", past date" : ""}`}
                    aria-pressed={selected === date}
                    onClick={() => {
                      onSelect(date);
                      setOpen(false);
                    }}
                  >
                    {Number(date.slice(-2))}
                  </button>
                ),
              )}
            </div>
            <div className="cc-av-legend">
              <span>
                <i className="cc-av-dot cc-av-dot-open" />
                Selectable
              </span>
              <span>
                <i className="cc-av-dot cc-av-dot-blocked" />
                Unavailable
              </span>
              <span>
                <i className="cc-av-dot cc-av-dot-selected" />
                Selected
              </span>
            </div>
            {loading && (
              <p className="cc-av-status" role="status">
                Checking date availability…
              </p>
            )}
            {!!error && (
              <p className="cc-av-warning" role="alert">
                {error}
              </p>
            )}
            <p className="cc-av-note">
              Shaded dates are blocked or fully booked. Availability is checked
              again before submitting.
            </p>
            <button
              type="button"
              className="cc-av-refresh"
              onClick={onRefresh}
              disabled={loading}
            >
              <RefreshCw size={16} aria-hidden="true" /> Refresh availability
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
