import { supabase } from './supabase';

export type ConversationCustomer = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone_number: string | null;
  address: string | null;
  email: string | null;
};

export function conversationProfileError(error: unknown): string {
  const code = (error as { code?: string })?.code;
  if (code === 'PGRST202' || code === '42883') return 'Customer profile access needs the approved messaging database setup.';
  if (code === '42501') return 'This customer profile is only available to the booking participants.';
  return 'Could not load the customer profile. Please try again.';
}

export async function loadConversationCustomer(bookingId: string, expectedCustomerId: string): Promise<ConversationCustomer> {
  if (!bookingId || !expectedCustomerId) throw new Error('Booking participant unavailable');
  // Server derives the customer from this booking and authorizes auth.uid().
  // Never query a caller-supplied profile ID as a fallback.
  const { data, error } = await supabase.rpc('get_booking_conversation_customer', { p_booking_id: bookingId });
  if (error) throw error;
  const customer = Array.isArray(data) && data.length === 1 ? data[0] : null;
  if (!customer || customer.id !== expectedCustomerId || ['full_name', 'avatar_url', 'phone_number', 'address', 'email']
    .some(field => customer[field] !== null && typeof customer[field] !== 'string')) {
    throw new Error('Customer profile response was not confirmed');
  }
  return customer;
}

export const profileField = (value: string | null | undefined) => value?.trim() || 'Not provided';
