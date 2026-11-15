import { Link } from 'react-router-dom';
import { alternativeCatererParams, CUSTOMER_EMERGENCY_MESSAGE, eventTimingLabel, isUrgentEvent } from '../lib/emergencyCancellation';

type Booking = {
  status: string; cancelled_by?: string | null; event_date: string | null;
  event_type: string | null; venue: string | null; guest_count: number | null; total_cost: number | null;
};

export default function CustomerEmergencyAssistance({ booking }: { booking: Booking }) {
  if (booking.status !== 'cancelled' || booking.cancelled_by !== 'caterer') return null;
  return <section className="cc-cb-emergency-assistance" aria-label="Caterer cancellation assistance">
    <h3>Cancelled by Caterer.</h3>
    <p>{CUSTOMER_EMERGENCY_MESSAGE}</p>
    <p><strong>Original event date:</strong> {booking.event_date || 'Not recorded'} · {eventTimingLabel(booking.event_date)}</p>
    {isUrgentEvent(booking.event_date) && <p role="status"><strong>Urgent assistance:</strong> Your event is within 7 Philippine calendar days. Explore alternatives promptly and contact caterers directly to check availability.</p>}
    <p>If a refund is due and your destination is missing, provide your refund account using the existing refund controls below.</p>
    <Link className="cc-cb-refund-primary" to="/customer" state={{ alternativeSearch: alternativeCatererParams(booking) }}>Find Alternative Caterers</Link>
    <p className="cc-cb-detail-footnote">Replacement availability is not guaranteed. No new booking is created and your details are not sent to other caterers.</p>
  </section>;
}
