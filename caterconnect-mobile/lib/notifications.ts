import { supabase } from './supabase';

/**
 * Notification content is plain text. UI icons are rendered with Lucide.
 */
export type NotificationType =
  | 'booking_submitted'
  | 'booking_approved'
  | 'booking_rejected'
  | 'payment_submitted'
  | 'payment_verified'
  | 'downpayment_paid'
  | 'booking_completed'
  | 'booking_cancelled'
  | 'package_customized'
  | 'new_booking_request'
  | 'new_message'
  | 'new_review'
  | 'subscription'
  | 'downpayment_deadline'
  | 'refund_transfer_submitted'
  | 'refund_dispute_opened'
  | 'refund_dispute_response'
  | 'refund_confirmed'
  | 'refund_overdue'
  | 'refund_dispute_submitted'
  | 'refund_dispute_responded'
  | 'refund_received';

export type NotificationPayload = {
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  booking_id?: string | null;
};

/**
 * Events owned by Supabase triggers. The app must never insert these directly.
 * Payment and message triggers also own their respective events.
 */
const SERVER_OWNED_TYPES: ReadonlySet<NotificationType> = new Set([
  'booking_approved',
  'booking_rejected',
  'booking_completed',
  'booking_cancelled',
  'new_booking_request',
  'payment_verified',
  'downpayment_paid',
  'new_message',
  'refund_transfer_submitted',
  'refund_dispute_opened',
  'refund_dispute_response',
  'refund_confirmed',
]);

/**
 * Compatibility layer for existing callers.
 * Server-owned events are already inserted by database triggers, so calling
 * this function for one of those events intentionally performs no insert.
 *
 * SECURITY NOTE: This is duplicate prevention, not an authorization boundary.
 * The notifications table still needs authenticated INSERT revoked once all
 * remaining client-side senders are migrated.
 */
export async function sendNotification(payload: NotificationPayload): Promise<void> {
  if (SERVER_OWNED_TYPES.has(payload.type)) {
    return;
  }

  const { error } = await supabase.from('notifications').insert(payload);
  if (error) {
    console.error('Notification insert failed:', {
      code: error.code,
      message: error.message,
      type: payload.type,
      booking_id: payload.booking_id,
    });
    throw new Error(`Notification could not be saved: ${error.message}`);
  }
}

type BookingNotificationType =
  | 'booking_submitted'
  | 'booking_approved'
  | 'booking_rejected'
  | 'payment_submitted'
  | 'payment_verified'
  | 'booking_completed'
  | 'booking_cancelled'
  | 'package_customized'
  | 'new_booking_request';

type MessagePair = {
  customer: { title: string; message: string };
  caterer: { title: string; message: string };
};

export async function sendBookingNotifications(
  type: BookingNotificationType,
  bookingId: string,
  customerId: string,
  catererId: string,
  catererUserId: string,
  extra?: { businessName?: string; customerName?: string; eventDate?: string }
): Promise<void> {
  void catererId;
  const bName = extra?.businessName ?? 'the caterer';
  const cName = extra?.customerName ?? 'A customer';
  const eDate = extra?.eventDate
    ? new Date(extra.eventDate).toLocaleDateString('en-PH', {
        month: 'long', day: 'numeric', year: 'numeric',
      })
    : 'your event';

  const messages: Record<BookingNotificationType, MessagePair> = {
    booking_submitted: {
      customer: { title: 'Booking Request Submitted', message: `Your booking request with ${bName} has been submitted. Please wait for confirmation.` },
      caterer: { title: 'New Booking Request', message: `${cName} sent a booking request for ${eDate}. Review and respond.` },
    },
    booking_approved: {
      customer: { title: 'Booking Approved', message: `${bName} approved your booking for ${eDate}. Please proceed with the downpayment.` },
      caterer: { title: 'Booking Confirmed', message: `You approved the booking for ${eDate}. Waiting for the customer downpayment.` },
    },
    booking_rejected: {
      customer: { title: 'Booking Rejected', message: `${bName} was unable to accept your booking for ${eDate}. You may browse other caterers.` },
      caterer: { title: 'Booking Rejected', message: `You rejected the booking request for ${eDate}.` },
    },
    payment_submitted: {
      customer: { title: 'Payment Submitted', message: `Your payment receipt has been submitted. Please wait for ${bName} to verify.` },
      caterer: { title: 'Payment Receipt Received', message: `${cName} submitted a payment receipt for ${eDate}. Please verify.` },
    },
    payment_verified: {
      customer: { title: 'Payment Verified', message: `${bName} verified your payment for ${eDate}. Your booking is now confirmed and paid.` },
      caterer: { title: 'Payment Verified', message: `The payment for ${eDate} has been verified.` },
    },
    booking_completed: {
      customer: { title: 'Event Completed', message: `Your event with ${bName} has been marked as completed. Please leave a review.` },
      caterer: { title: 'Event Completed', message: `The event for ${eDate} has been marked as completed.` },
    },
    booking_cancelled: {
      customer: { title: 'Booking Cancelled', message: `Your booking with ${bName} for ${eDate} has been cancelled.` },
      caterer: { title: 'Booking Cancelled', message: `The booking for ${eDate} has been cancelled.` },
    },
    package_customized: {
      customer: { title: 'Package Customized', message: `You customized your package for the booking with ${bName}.` },
      caterer: { title: 'Package Customized', message: `${cName} customized their package for the booking on ${eDate}.` },
    },
    new_booking_request: {
      customer: { title: 'Booking Request Sent', message: `Your booking request has been sent to ${bName}.` },
      caterer: { title: 'New Booking Request', message: `${cName} sent a new booking request for ${eDate}.` },
    },
  };

  const msg = messages[type];
  const results = await Promise.allSettled([
    sendNotification({ user_id: customerId, title: msg.customer.title, message: msg.customer.message, type, booking_id: bookingId }),
    sendNotification({ user_id: catererUserId, title: msg.caterer.title, message: msg.caterer.message, type, booking_id: bookingId }),
  ]);
  const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
  if (failed.length) {
    throw new Error(`${failed.length} booking notification(s) could not be saved. Check the console for Supabase errors.`);
  }
}

/** Kept for compatibility; the database trigger handles this event. */
export async function notifyRefundDisputeResponse(
  customerUserId: string,
  bookingId: string
): Promise<void> {
  void customerUserId;
  void bookingId;
}

/** Kept for compatibility; the database trigger handles this event. */
export async function notifyRefundDisputeOpened(
  catererUserId: string,
  bookingId: string
): Promise<void> {
  void catererUserId;
  void bookingId;
}

/** Kept for compatibility; the database trigger handles this event. */
export async function notifyRefundTransferSubmitted(
  customerUserId: string,
  bookingId: string
): Promise<void> {
  void customerUserId;
  void bookingId;
}

/** Kept for compatibility; the database trigger handles this event. */
export async function notifyRefundConfirmed(
  catererUserId: string,
  bookingId: string
): Promise<void> {
  void catererUserId;
  void bookingId;
}
