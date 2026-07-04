import { supabase } from './supabase';

type NotificationType =
  | 'booking_submitted'
  | 'booking_approved'
  | 'booking_rejected'
  | 'payment_submitted'
  | 'payment_verified'
  | 'booking_completed'
  | 'booking_cancelled'
  | 'package_customized'
  | 'new_booking_request';

type NotificationPayload = {
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  booking_id?: string;
};

export async function sendNotification(payload: NotificationPayload) {
  const { error } = await supabase.from('notifications').insert(payload);
  if (error) console.error('Notification error:', error.message);
}

export async function sendBookingNotifications(
  type: NotificationType,
  bookingId: string,
  customerId: string,
  catererId: string,
  catererUserId: string,
  extra?: { businessName?: string; customerName?: string; eventDate?: string }
) {
  const bName = extra?.businessName ?? 'the caterer';
  const cName = extra?.customerName ?? 'A customer';
  const eDate = extra?.eventDate
    ? new Date(extra.eventDate).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'your event';

  const messages: Record<NotificationType, { customer: { title: string; message: string }; caterer: { title: string; message: string } }> = {
    booking_submitted: {
      customer: { title: 'Booking Request Submitted', message: `Your booking request with ${bName} has been submitted. Please wait for their confirmation.` },
      caterer:  { title: '🔔 New Booking Request', message: `${cName} sent a booking request for ${eDate}. Review and respond.` },
    },
    booking_approved: {
      customer: { title: '✅ Booking Approved!', message: `${bName} approved your booking for ${eDate}. Please proceed with the downpayment.` },
      caterer:  { title: 'Booking Confirmed', message: `You approved the booking for ${eDate}. Waiting for customer downpayment.` },
    },
    booking_rejected: {
      customer: { title: '❌ Booking Rejected', message: `${bName} was unable to accept your booking for ${eDate}. You may browse other caterers.` },
      caterer:  { title: 'Booking Rejected', message: `You rejected the booking request for ${eDate}.` },
    },
    payment_submitted: {
      customer: { title: '💳 Payment Submitted', message: `Your payment receipt has been submitted. Please wait for ${bName} to verify.` },
      caterer:  { title: '💳 Payment Receipt Received', message: `${cName} submitted a payment receipt for ${eDate}. Please verify.` },
    },
    payment_verified: {
      customer: { title: '✅ Payment Verified!', message: `${bName} verified your payment for ${eDate}. Your booking is now confirmed and paid.` },
      caterer:  { title: 'Payment Verified', message: `You verified the payment for ${eDate}. Booking is now paid.` },
    },
    booking_completed: {
      customer: { title: '🎉 Event Completed!', message: `Your event with ${bName} has been marked as completed. Please leave a review!` },
      caterer:  { title: '🎉 Event Completed', message: `The event for ${eDate} has been marked as completed.` },
    },
    booking_cancelled: {
      customer: { title: '❌ Booking Cancelled', message: `Your booking with ${bName} for ${eDate} has been cancelled.` },
      caterer:  { title: '❌ Booking Cancelled', message: `The booking for ${eDate} has been cancelled.` },
    },
    package_customized: {
      customer: { title: 'Package Customized', message: `You have customized your package for the booking with ${bName}.` },
      caterer:  { title: '🍽️ Package Customized', message: `${cName} customized their package for the booking on ${eDate}.` },
    },
    new_booking_request: {
      customer: { title: 'Booking Request Sent', message: `Your booking request has been sent to ${bName}.` },
      caterer:  { title: '🔔 New Booking Request', message: `${cName} has sent a new booking request for ${eDate}.` },
    },
  };

  const msg = messages[type];
  await Promise.all([
    sendNotification({ user_id: customerId,    title: msg.customer.title, message: msg.customer.message, type, booking_id: bookingId }),
    sendNotification({ user_id: catererUserId, title: msg.caterer.title,  message: msg.caterer.message,  type, booking_id: bookingId }),
  ]);
}