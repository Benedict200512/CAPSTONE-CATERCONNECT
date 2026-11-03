# Booking conversation reactions and customer profile — local review

No deployment or live SQL execution is authorized or performed.

## Verified client defects

The existing reaction handler wrote a whole messages.reactions map by message ID, did not request a returned row, hid all database errors behind “Failed to react to message”, and waited for Realtime before displaying changes. A denied zero-row UPDATE could appear successful. Concurrent participants writing stale whole maps can overwrite each other's entries. The underlying deployed database error cannot be determined from that generic alert.

The client now scopes the existing write to booking/message/participant, verifies a returned row, updates immediately, prevents overlapping local taps on the same message, rolls back only the caller's reaction on failure, refreshes after writes and displays safe permission/schema/constraint error classifications. No message text, user IDs or raw database error details are logged. These client improvements **do not solve the server-side whole-map concurrency or authorization problem**; no claim of atomic cross-account reaction safety is made yet.

## Exact remaining dependency for reactions

The four existing exports contain booking/profile definitions but no public.messages catalog metadata. No reaction table, column type, UPDATE policy, privilege or trigger is invented. The read-only query `supabase/metadata/message_reactions_metadata_query.sql` retrieves only messages metadata, its attached functions and policy helpers, and Realtime membership. It returns no message/profile records. Supply that result plus the sanitized reaction error code/message to finish diagnosis and any required narrow, guarded reaction RPC/guard proposal. Do not widen message RLS or grant blanket UPDATE permissions as a workaround.

One reaction per actor is already represented by the existing user-ID-to-emoji map. An eventual server mutation must merge only auth.uid()'s entry atomically, validate actual booking/message participants, and preserve direct-write protection; client toggling alone does not enforce those rules. No reaction installation proposal is represented as reviewed until that catalog dependency is available.

## Customer profile

`booking_conversation_customer_proposal.sql` adds one new read-only RPC. The booking ID is its only argument; it derives the customer and permits only that customer or the currently assigned caterer account. It returns only id/full_name/avatar_url/phone_number/address/email, with fixed empty search_path and postgres ownership. No arbitrary customer ID parameter, profile fallback query, policy change or additional contact record is used.

The existing shared ChatScreen has no View Profile text button in the inspected source. The prepared UI places a Lucide UserRound icon before the customer's avatar. The icon, avatar and name open the same modal only when the loaded booking identifies that peer as the customer. The modal uses authoritative profile fields, Phone/MapPin/Mail icons, missing-value labels, loading/error/retry states, 44-point controls and a scrollable constrained card. Async results are bound to account/booking/customer identity. Sending, attachment uploads, read receipts, booking details and navigation retain their existing paths.

**Existing exposure:** the collected profiles SELECT policy allows all authenticated users to view profiles directly. The new booking-authorized RPC does not weaken or cure that pre-existing broad access. Claiming global contact privacy would require a separate impact review of shared profile grants/policies and callers. This proposal intentionally does not change them.

## Approval and manual checks

1. Resolve the messages metadata dependency and review any reaction SQL before installation. Do not install unreviewed assumptions about messages.
2. Review and separately approve the guarded customer profile RPC; remove only its intentional proposal stop for a later approved execution copy. Nothing is installed and no execution copy is supplied here.
3. Release the modal after its RPC exists. Before installation, it shows setup-required feedback and never falls back to a broad profiles query.
4. In two Expo Go accounts verify reaction add/change/remove, rejected-write rollback, rapid taps, simultaneous different-user reactions, Realtime reconnect, and a foreground refresh. Simultaneous server writes are still unresolved pending catalog review.
5. Verify customer modal from both booking and inbox entry points; test absent contact/avatar values, customer/account switching, another caterer/customer denial of the new RPC, and unchanged message/read-receipt/image workflows.

If rollout pauses, hide the new modal; a separately reviewed DROP FUNCTION ... RESTRICT removes only its API. Never grant broad message/profile access or use CASCADE to make a rollback work.
