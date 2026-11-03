import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CalendarCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  UnlockKeyhole,
  Users,
} from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import CatererPageHeader from '../../components/CatererPageHeader';
import CatererSkeleton from '../../components/CatererSkeleton';
import {
  availabilityError,
  loadAvailability,
  manilaToday,
  saveDailyCapacity,
  setDateBlocked,
  shiftMonth,
} from '../../lib/avalability';

import './Availability.css';

type AvailabilityData = Awaited<ReturnType<typeof loadAvailability>>;

function monthLabel(month: string) {
  const [year, number] = month.split('-').map(Number);
  return new Date(Date.UTC(year, number - 1, 1)).toLocaleDateString('en-PH', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default function CatererAvailability() {
  const { session, catererData } = useAuth();
  const userId = session?.user.id;
  const catererId = catererData?.id;
  const today = manilaToday();
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(today);
  const [data, setData] = useState<AvailabilityData | null>(null);
  const [loadedKey, setLoadedKey] = useState('');
  const [capacity, setCapacity] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const requestVersion = useRef(0);
  const requestKey = `${userId ?? ''}/${catererId ?? ''}/${month}`;
  const currentKey = useRef(requestKey);
  currentKey.current = requestKey;

  const refresh = useCallback(async () => {
    const request = ++requestVersion.current;
    const key = requestKey;
    setLoading(true);
    setError('');

    try {
      if (!userId || !catererId) {
        throw new Error('Sign in with your caterer account to manage availability.');
      }

      const result = await loadAvailability(catererId, userId, month);
      if (currentKey.current !== key || request !== requestVersion.current) return;
      setData(result);
      setLoadedKey(key);
      setCapacity(String(result.capacity));
    } catch (failure) {
      if (currentKey.current === key && request === requestVersion.current) {
        setError(availabilityError(failure));
      }
    } finally {
      if (currentKey.current === key && request === requestVersion.current) {
        setLoading(false);
      }
    }
  }, [catererId, month, requestKey, userId]);

  useEffect(() => {
    void refresh();
    return () => { requestVersion.current += 1; };
  }, [refresh]);

  const ready = Boolean(data && loadedKey === requestKey && !loading && !error);
  const selectedCount = data?.counts[selectedDate] ?? 0;
  const isBlocked = data?.blocked.includes(selectedDate) ?? false;
  const isFull = Boolean(data && selectedCount >= data.capacity);
  const selectedIsPast = selectedDate < today;

  const calendarDays = useMemo(() => {
    const [year, number] = month.split('-').map(Number);
    const firstDay = new Date(Date.UTC(year, number - 1, 1));
    const count = new Date(Date.UTC(year, number, 0)).getUTCDate();
    const blanks = Array.from({ length: firstDay.getUTCDay() }, (_, index) => `blank-${index}`);
    const days = Array.from({ length: count }, (_, index) =>
      `${month}-${String(index + 1).padStart(2, '0')}`
    );
    return [...blanks, ...days];
  }, [month]);

  const runMutation = async (operation: () => Promise<void>, successMessage: string) => {
    if (!ready || busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await operation();
      if (currentKey.current !== requestKey) return;
      setMessage(successMessage);
      await refresh();
    } catch (failure) {
      const failureMessage = availabilityError(failure);
      await refresh();
      if (currentKey.current === requestKey) {
        setMessage('');
        setError(failureMessage);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleCapacitySave = () => {
    const trimmed = capacity.trim();
    if (!/^\d+$/.test(trimmed) || Number(trimmed) < 1) {
      setError('Enter a positive whole number for daily capacity.');
      setMessage('');
      return;
    }
    if (!catererId || !userId) return;
    void runMutation(
      () => saveDailyCapacity(catererId, userId, Number(trimmed)),
      'Daily capacity saved.'
    );
  };

  const handleDateToggle = () => {
    if (!ready || busy || !data || selectedIsPast || !catererId || !userId) return;
    const action = isBlocked ? 'Make this date available?' : 'Mark this date unavailable?';
    const details = isBlocked
      ? `${selectedDate} will reopen if daily capacity permits.`
      : `New requests and confirmations for ${selectedDate} will be prevented. Existing bookings will remain unchanged.`;
    if (!window.confirm(`${action}\n\n${details}`)) return;

    void runMutation(
      () => setDateBlocked(catererId, userId, selectedDate, !isBlocked),
      isBlocked ? 'Date is available again, subject to daily capacity.' : 'Date marked unavailable.'
    );
  };

  return (
    <div className="availability-page">
      <CatererPageHeader
        icon={<CalendarCheck size={25} />}
        title="Availability & Daily Capacity"
        description="Manage event dates and the number of bookings you can accommodate each day."
        action={<button
          type="button"
          className="availability-refresh"
          onClick={() => void refresh()}
          disabled={loading || busy}
          aria-label="Refresh availability"
        >
          {loading ? <LoaderCircle size={17} className="availability-spin" /> : <RefreshCw size={17} />}
          <span>Refresh</span>
        </button>}
      />

      <div className="availability-note">
        Dates use Philippine time. Pending requests do not reserve a slot. Blocking a date does not cancel existing bookings. Monthly subscription limits are separate from daily capacity.
      </div>

      {error && (
        <div className="availability-feedback error" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button type="button" onClick={() => void refresh()} disabled={loading || busy}>Try again</button>
        </div>
      )}
      {message && (
        <div className="availability-feedback success" role="status">
          <CheckCircle2 size={18} />
          <span>{message}</span>
        </div>
      )}

      {loading && (
        <CatererSkeleton variant="availability" calendarCellCount={calendarDays.length} label="Loading availability" />
      )}

      {!loading && !error && ready && data && (
        <>
          <section className="availability-capacity-card">
            <div className="availability-section-icon"><Users size={20} /></div>
            <div className="availability-capacity-copy">
              <h2>Daily Booking Limit</h2>
              <p>Maximum committed bookings across all packages for each event date. Current limit: <strong>{data.capacity}</strong>.</p>
              <small>You cannot lower the limit below existing bookings scheduled for today or a future date.</small>
            </div>
            <form className="availability-capacity-form" onSubmit={(event) => { event.preventDefault(); handleCapacitySave(); }}>
              <label htmlFor="daily-capacity">Bookings per day</label>
              <div>
                <input
                  id="daily-capacity"
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  value={capacity}
                  onChange={(event) => setCapacity(event.target.value)}
                  disabled={busy}
                />
                <button type="submit" className="availability-primary-button" disabled={busy || !ready}>
                  {busy ? 'Saving...' : 'Save capacity'}
                </button>
              </div>
            </form>
          </section>

          <div className="availability-layout">
            <section className="availability-calendar-card" aria-label="Monthly availability calendar">
              <div className="availability-calendar-header">
                <h2>{monthLabel(month)}</h2>
                <div>
                  <button
                    type="button"
                    aria-label="Previous month"
                    onClick={() => { const next = shiftMonth(month, -1); setMonth(next); setSelectedDate(`${next}-01`); setMessage(''); }}
                    disabled={busy || month <= today.slice(0, 7)}
                  ><ChevronLeft size={19} /></button>
                  <button
                    type="button"
                    aria-label="Next month"
                    onClick={() => { const next = shiftMonth(month, 1); setMonth(next); setSelectedDate(`${next}-01`); setMessage(''); }}
                    disabled={busy}
                  ><ChevronRight size={19} /></button>
                </div>
              </div>

              <div className="availability-weekdays" aria-hidden="true">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}
              </div>
              <div className="availability-calendar-grid">
                {calendarDays.map((value) => {
                  if (value.startsWith('blank-')) return <span className="availability-calendar-blank" key={value} />;
                  const date = value;
                  const count = data.counts[date] ?? 0;
                  const blocked = data.blocked.includes(date);
                  const full = count >= data.capacity;
                  const past = date < today;
                  const selected = selectedDate === date;
                  const stateLabel = blocked ? 'Blocked' : full ? 'Fully booked' : 'Open';
                  return (
                    <button
                      type="button"
                      key={date}
                      className={`availability-day${blocked || full ? ' unavailable' : ''}${selected ? ' selected' : ''}${past ? ' past' : ''}`}
                      onClick={() => { setSelectedDate(date); setMessage(''); }}
                      disabled={busy || !ready || past}
                      aria-pressed={selected}
                      aria-label={`${date}, ${count} committed bookings, ${stateLabel}${past ? ', past date' : ''}`}
                      title={`${count} committed bookings - ${stateLabel}`}
                    >
                      <span>{Number(date.slice(-2))}</span>
                      <small>{count} booked</small>
                    </button>
                  );
                })}
              </div>
              <div className="availability-legend">
                <span><i className="open" /> Open</span>
                <span><i className="unavailable" /> Blocked or full</span>
                <span><i className="selected" /> Selected</span>
              </div>
              <p className="availability-calendar-hint">Each date shows committed bookings. Pending requests are not included in the count.</p>
            </section>

            <section className="availability-selected-card" aria-label="Selected date details">
              <p className="availability-eyebrow">SELECTED EVENT DATE</p>
              <h2>{selectedDate}</h2>
              <div className="availability-booking-count">
                <strong>{selectedCount}</strong>
                <span>committed bookings out of {data.capacity} daily slots</span>
              </div>
              <div className={`availability-date-status${isBlocked || isFull ? ' unavailable' : ''}`}>
                {isBlocked ? <LockKeyhole size={16} /> : isFull ? <Users size={16} /> : <UnlockKeyhole size={16} />}
                <span>{isBlocked ? 'Unavailable for bookings' : isFull ? 'Fully booked' : 'Open for bookings'}</span>
              </div>
              {selectedCount === 0 && (
                <p className="availability-empty-note">No committed bookings are scheduled for this date.</p>
              )}
              <p className="availability-calendar-hint">Committed bookings include confirmed, awaiting-payment, paid, ongoing, and completed reservations. Blocking a date will not remove existing bookings.</p>
              <button
                type="button"
                className={`availability-primary-button availability-block-button${isBlocked ? ' secondary' : ''}`}
                disabled={busy || selectedIsPast || !ready}
                onClick={handleDateToggle}
              >
                {busy ? 'Saving...' : isBlocked ? 'Make Date Available' : 'Mark as Unavailable'}
              </button>
              {selectedIsPast && <small className="availability-past-note">Past dates cannot be changed.</small>}
              {isFull && !isBlocked && <small className="availability-past-note">This date is full at the current daily limit. Increase capacity or choose another date to reopen booking availability.</small>}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
