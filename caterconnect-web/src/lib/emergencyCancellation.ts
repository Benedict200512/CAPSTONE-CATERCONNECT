// Presentation only. Cancellation eligibility, amounts and deadlines remain server-owned.
export const URGENT_CANCELLATION_WARNING = "Urgent Cancellation: The Customer's event is approaching. Cancelling now may significantly affect their preparations. This cancellation may be reviewed by Platform Staff.";
export const CUSTOMER_EMERGENCY_MESSAGE = "Your Caterer has cancelled this booking due to an emergency. We understand this may affect your event preparations. Your applicable refund will follow the existing refund process. You can explore alternative catering services for your event.";

export function daysUntilEvent(eventDate: string | null | undefined, now = Date.now()): number | null {
  if (!eventDate || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate) || !Number.isFinite(now)) return null;
  const event = Date.parse(`${eventDate}T00:00:00Z`);
  if (!Number.isFinite(event) || new Date(event).toISOString().slice(0, 10) !== eventDate) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(now));
  const part = (type: string) => Number(parts.find(item => item.type === type)?.value);
  return Math.round((event - Date.UTC(part('year'), part('month') - 1, part('day'))) / 86400000);
}

export function isUrgentEvent(eventDate: string | null | undefined, now = Date.now()): boolean {
  const days = daysUntilEvent(eventDate, now);
  return days !== null && days >= 0 && days <= 7;
}

export function eventTimingLabel(eventDate: string | null | undefined, now = Date.now()): string {
  const days = daysUntilEvent(eventDate, now);
  if (days === null) return 'Event date unavailable';
  if (days < 0) return 'Event date has passed';
  if (days === 0) return 'Event is today (Philippine time)';
  return `${days} ${days === 1 ? 'day' : 'days'} remaining (Philippine calendar days)`;
}

type BookingSearchContext = {
  event_date: string | null; event_type: string | null; venue: string | null;
  guest_count: number | null; total_cost: number | null;
};

export function alternativeCatererParams(booking: BookingSearchContext): Record<string, string> {
  return {
    alternative: '1',
    eventDate: booking.event_date ?? '',
    eventType: booking.event_type ?? '',
    venue: booking.venue ?? '',
    guests: Number.isSafeInteger(booking.guest_count) && Number(booking.guest_count) > 0 ? String(booking.guest_count) : '',
    budget: Number.isFinite(booking.total_cost) && Number(booking.total_cost) > 0 ? Number(booking.total_cost).toFixed(2) : '',
  };
}

export type AlternativeSearchContext = {
  eventDate: string; eventType: string; venue: string; guests: string; budget: string;
};

// Navigation data is only a search suggestion, never trusted booking/payment input.
export function readAlternativeSearch(value: unknown): AlternativeSearchContext | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  if (input.alternative !== '1') return null;
  const text = (key: string, limit: number) => typeof input[key] === 'string' ? input[key].slice(0, limit).trim() : '';
  const eventDate = text('eventDate', 10);
  const guests = text('guests', 9);
  const budget = text('budget', 18);
  const eventType = text('eventType', 100);
  return {
    eventDate: daysUntilEvent(eventDate) !== null ? eventDate : '',
    eventType: eventType ? eventType[0].toUpperCase() + eventType.slice(1).toLowerCase() : 'All',
    venue: text('venue', 1000),
    guests: /^\d+$/.test(guests) && Number(guests) > 0 ? guests : '',
    budget: /^\d+(\.\d{1,2})?$/.test(budget) && Number(budget) > 0 ? budget : '',
  };
}
