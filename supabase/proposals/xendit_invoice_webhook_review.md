# Xendit invoice webhook repair — local review, not deployed

## Confirmed failure and source difference

The operator confirmed an invoice PAID for PHP 35,000, webhook HTTP 200, and the deployed log `Skipping non-success event: PAID`. The local webhook only accepted SUCCEEDED-style eWallet callbacks and read reference_id. Invoice callbacks use PAID and external_id. Its old booking callback helper records awaiting_payment only; it does not verify a payment as paid.

The operator additionally confirmed the deployed checkout uses POST /v2/invoices, external_id booking_<UUID>_<TIMESTAMP>, and server-generated metadata type/user_id/payment_method/booking_id/customer_id. The local xendit-payment source instead uses /ewallets/charges. That file remains unchanged: do not deploy it over the reviewed invoice checkout. The deployed checkout contract and targeted SQL findings were supplied by the operator; Codex did not access hosted source/logs.

## Local change

- Authenticate the callback token before processing, fail closed on missing configuration, and remove raw payload logging.
- Recognize invoice PAID before the existing eWallet success filter. Fetch the same invoice from GET https://api.xendit.co/v2/invoices/<id> using the server Xendit secret. Compare returned invoice ID and external ID with the callback.
- Strictly parse booking_<UUID>_<TIMESTAMP>; require provider status PAID, currency PHP, exact positive amount and paid_amount matching the booking downpayment, and consistent server-generated booking/customer/user metadata. No client amount, browser return or booking status alone proves payment.
- Refuse conflicting stored invoice references, cancelled/completed/unaccepted/verified bookings and active refunds. An atomic conditional update compares the observed status, owner, amount, receipt/reference, submission time and unverified state. Provider/database failures and changed-row races return 503. Invalid identities/amounts/bindings return 422. Valid duplicates return 200 without a second transition.
- Existing paid-status database trigger remains responsible for participant notifications. No additional invoice notification insert occurs. Existing eWallet callback behavior and subscription branch remain intact.
- Customer/caterer lists and open detail sheets reload on focus, foreground and every 15 seconds while active/focused. Requests are serialized by the refresh hook and outdated owner/filter/request responses are discarded. These are authorized reads, not payment writes or Realtime configuration changes.

## Confirmed verification path

The operator's targeted deployed SQL inspection confirmed protect_booking_payment_fields() is SECURITY INVOKER, permits auth.role()=service_role updates, and rejects ordinary authenticated attempts to mark paid. No separate verification RPC was identified; handle_booking_payment_notification() is a notification trigger. The implementation therefore uses the existing trusted service-role backend update path after callback authentication and independent provider verification. Invoice/booking validation runs before any payment write. All existing database triggers remain enabled. It does not disable/bypass the trigger, create a new RPC, or modify any SQL/database object.

The previous missing-RPC review dependency is resolved by that explicit confirmation. No new RPC is required or invented. Offline tests still mock database writes and provider responses; hosted runtime behavior needs the separately approved validation below.

## Separate-approval deployment plan

1. Review this local change against the confirmed deployed invoice checkout contract. At approved runtime validation, verify the provider GET response retains the required metadata and metadata user_id is the authenticated customer ID. Missing or inconsistent binding fails closed; do not loosen validation or ask the customer to pay again.
2. Obtain separate approval for the webhook deployment. No SQL migration, previous migration rerun, status backfill, payment retry or new checkout is part of this repair.
3. In Supabase dashboard confirm XENDIT_WEBHOOK_TOKEN matches the Test Mode invoice callback token and XENDIT_SECRET_KEY is the existing matching test account key with invoice read permission. Confirm SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY exist. Never print, paste or log values. Do not switch to live mode.
4. From the repository root, the separately approved CLI command is:

   ```powershell
   Set-Location .\caterconnect-mobile
   npx supabase functions deploy xendit-webhook --project-ref <reviewed-project-ref> --no-verify-jwt
   ```

   This deploys only the webhook and its imported helpers. Do not deploy xendit-payment, xendit-check-status, all functions, or any migration. Disabling the gateway JWT check is for the Xendit endpoint only; callback-token authentication remains mandatory inside the handler. Local config also records verify_jwt=false for this function.
5. Confirm the existing Xendit Test Mode **invoice** callback URL targets that project's /functions/v1/xendit-webhook. Leave eWallet/subscription callback configuration unchanged.
6. Separately approve redelivery of the existing successful test invoice webhook from Xendit; do not ask the customer to pay again. This action can update a booking and must not happen automatically. Expect a verified update or an explicit diagnostic denial, never a silent skipped PAID. Redeliver the same event once more only as an approved idempotency check; expect no second transition/notification. If the booking has since changed/cancelled or its invoice references conflict, stop for review rather than resetting anything.
7. Read the resulting booking through normal authorized customer/caterer screens. Confirm paid/verification/reference fields and existing notifications, including an open details sheet. Release/test mobile changes separately after backend verification. Reports continue to show actual collections as Unavailable; no new monetary ledger is claimed.

If a delivery returns 503, inspect only the safe code and provider HTTP status in webhook logs. BOOKING_WRITE_<SQLSTATE> indicates database rejection; do not disable protections to make it pass. A 422 indicates reference, metadata, currency, amount or stored-invoice conflict requiring targeted review. Share only sanitized codes/timestamps and field names, never whole payloads, keys, JWTs or customer details.

No hosted logs were queried by Codex. The failure evidence above was supplied by the operator. No live SQL, Edge deployment, Xendit request, callback redelivery or production write was performed.

## Local validation — 2026-10-20

- Invoice/payment/refresh tests: **15/15 passed** (`node caterconnect-mobile/scripts/test-xendit-invoice.cjs`), including malformed callbacks, no privileged client access before provider identity verification, and conflicting invoice identity on an already-paid booking. Provider requests and database writes are mocked; no actual invoice is paid or booking updated.
- Existing eWallet, subscription-preservation and payment/database source contracts: **12/12** passed (`node caterconnect-mobile/scripts/test-phase2-dependencies.cjs`). The existing subscription branch and monthly SQL hash checks still pass.
- Final focused run also passed reports **8/8** and internal notes **7/7**, for **42/42** current focused checks. Focused TypeScript was rerun successfully after the final handler/helper changes.
- Combined existing focused regressions in the preceding repair run: **58/59** passed across payment dependencies, internal notes, reports, monthly quotas, publication, Auth/subscription and completed-history protection. The single previously recorded failure is the unrelated package-management UI assertion expecting Unpublish / Restore as unpublished labels. Its screen/test were left unchanged.
- Focused TypeScript passed for both booking screens, the refresh hook, webhook, invoice verifier and legacy callback helper, including their imports. The check supplied ambient Deno/serve declarations and used the installed real Supabase types; it is not a Deno deployment/bundling or hosted runtime test.
- Finalization: **75/75 isolated PostgreSQL 18.3 checks passed** with `node supabase/tests/test-package-publication-postgres.cjs --internal-notes --reports --invoice-payment`. Five new checks capture the actual invoice helper's generated patch/predicates and execute that guarded UPDATE against the four-export schema with its existing triggers and constraints enabled. They verify confirmed-to-paid with archived package history, duplicate zero-row updates and exactly one paid notification pair, awaiting-payment timestamps, ordinary customer/caterer denial, and stale cancellation protection. The remaining 70 checks cover existing booking, daily/monthly capacity, publication, notes, reports, refunds/history and concurrent enforcement. Each new check rolls back; the disposable loopback cluster was stopped. No hosted test was run.
- The 15 invoice/payment/refresh and 12 payment/eWallet dependency checks were rerun successfully after finalization. No runtime application, webhook, SQL or policy change was needed in this finalization; only the isolated test module, runner hook and this review were updated.
