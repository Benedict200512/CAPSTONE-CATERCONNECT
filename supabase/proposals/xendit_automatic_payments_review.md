# Automatic Xendit confirmation — local code review

## Payment-method recording follow-up — 2026-10-20

The operator reports automatic Basic activation is working live. The remaining
local defect was the webhook's hardcoded `p_payment_method: 'online'`. Only the
method argument now changes; the existing activation RPC and all verification,
expiry, quota, booking and manual-receipt behavior remain unchanged.

The normalizer reads only the independently fetched provider object's
`payment_channel`, `channel_code`, `ewallet_type`, `payment_method` and
`bank_code`. It stores `gcash`, `maya`, `card`, or `bank_transfer` for identifiable
supported channels. Other specific provider channel tokens are preserved in
lowercase; `online` is used when the provider identifies no specific method.
GCASH/PH_GCASH and PAYMAYA/MAYA/PH_PAYMAYA aliases are recognized; credit/debit
cards share `card`; bank-transfer/virtual-account/online-banking evidence shares
`bank_transfer`. Available-channel lists and `metadata.payment_method` are
ignored because they describe choices/preferences, not the settled channel.
No new provider request or reliance on callback method fields is introduced.

Field references: Xendit's official [invoice model](https://github.com/xendit/xendit-node/blob/master/docs/invoice/Invoice.md),
[invoice payment fields](https://github.com/xendit/xendit-node/blob/master/docs/invoice/InvoiceCallback.md),
[eWallet API](https://developers.xendit.co/api-reference/) and
[Philippines channel codes](https://docs.xendit.co/docs/available-payment-methods).
Provider responses can omit channel detail depending on method/API; those new
receipts retain the fallback. No live provider response was fetched for this
follow-up. Existing receipts are not backfilled, even on webhook redelivery.

Validation: automatic-payment offline tests 24/24; booking invoice regressions
19/19; focused TypeScript passed for 10 payment/webhook/mobile files. Disposable
PostgreSQL 18.3 passed 61/61 checks with `--subscription-payment`, importing the
original catalog/RPC and exercising the actual updated TypeScript helper.
This includes all five stored values and duplicate receipt/expiry preservation.
The temporary cluster was stopped; no hosted database or historical record was
modified.

For this follow-up only, redeploy **xendit-webhook** from caterconnect-mobile:

```powershell
npx supabase functions deploy xendit-webhook --project-ref YOUR_PROJECT_REF --no-verify-jwt
```

No checkout/status redeployment, SQL migration, secret change or mobile release
is needed for this method-only correction. The broader three-function rollout
below documents the earlier activation work, which the operator has installed.
After approved deployment, inspect the next authorized new test subscription
payment: compare its stored method with the provider's settled channel, confirm
one confirmed receipt and the usual plan/expiry, then confirm redelivery changes
neither receipt nor expiry. Replaying an older `online` receipt will deliberately
not rewrite its method. Missing provider channel detail should still activate
normally with `online`.

**Local RPC integration is complete and original-export PostgreSQL tests passed.
Deployment still requires explicit approval.** The operator supplied the exact existing
RPC signature/parameter names and behavior, including `activated` and
`already_processed` text results. The webhook now calls that existing RPC and
checks committed receipt ownership and entitlement afterward. The former
`SUBSCRIPTION_ACTIVATION_CONTRACT_REQUIRED` code gate has been removed.

The operator subsequently saved the original full export at
`supabase/metadata/xendit_subscription_catalog_export.txt`. It has been read.
The new disposable test module parses its Markdown-wrapped JSON, imports both
original function bodies and exact subscription payment columns/defaults,
constraints, indexes, RLS policies and ACLs, and compares the imported activation
body to the original export. Existing subscription_plans columns/defaults are
also compared to the new export before importing its exact ACL/RLS baseline.
Caller tests retain explicitly labeled mocks, supplemented by execution of the
actual TypeScript helper against PostgreSQL reads and the original RPC. No SQL
migration/proposal was created for this task; the earlier metadata SQL file is
a read-only catalog query only. No live
changes, provider requests, payments or deployments were performed.

## Confirmed diagnosis

The pre-change local webhook only recognized subscription SUCCEEDED charge
events, read reference_id, and skipped subscription invoice PAID/external_id.
It independently handled booking invoices but not subscription invoices.
The old subscription branch issued separate receipt INSERT, caterer UPDATE
and notification INSERT calls, logged errors and still acknowledged HTTP 200.
It had no provider GET, authoritative plan-price/owner binding, transaction or
concurrency protection. Its expiry was now+30 days on each delivery and it sent
a reset-to-zero quota payload. These are source findings; no current deployed
logs/source were fetched. Earlier user evidence confirmed PAID callbacks had
been acknowledged while skipped.

The eWallet booking callback previously recorded awaiting_payment, then asked
the caterer to manually verify. Verified Xendit payments now take the existing
guarded Paid path directly, using provider evidence and database notifications.
Manual receipt verification outside Xendit remains unchanged.

## Local implementation

- xendit-webhook authenticates x-callback-token and fetches the exact invoice
  or eWallet charge using the server API key. Invoice PAID, eWallet SUCCEEDED
  and the existing payment.succeeded notification shape are supported.
  Callback identity/reference must match the retrieved provider object.
  eWallet capture_amount must equal charge_amount. Pending/failed callbacks
  do not write. Provider/database failures return 503; mismatches return 422.
- Booking verification checks PHP, exact amount, booking/customer metadata,
  stored downpayment, expected state, receipt/reference conflicts and refund
  state. The existing service-role CAS updates only payment fields/status.
  Duplicate verified evidence is an acknowledged no-op, concurrent losers
  retry/re-read, and inconsistent already-Paid/unverified rows are rejected.
  No booking total, quote, quota, RLS, refund or paid notification trigger is
  replaced. Raw payloads, customer details, IDs and credentials are not logged.
- Subscription provider checks validate the verified reference, metadata user
  ownership, PHP, exact paid amount, refund state and authoritative plan price
  for new activations. Older server-generated metadata may omit duplicate
  caterer_id/plan_id fields: the provider reference identifies them and user_id
  must still match the authoritative caterer owner. Any conflicting supplied
  metadata IDs are rejected. No callback metadata is trusted independently.
- The webhook calls the existing `activate_paid_subscription` using its five
  supplied named parameters and the normalized, provider-confirmed payment
  method (or `online` when no specific method can be identified).
  Receipt insertion, plan/expiry writes, locking and quota behavior
  remain in that existing transaction. There are no direct REST entitlement
  writes or client/staff activation paths added.
- Before reusing an existing reference, its caterer/plan/amount/status must
  match this verified payment. Both RPC return values require re-reading a
  confirmed receipt and the correct owner's entitlement. The expiry must match
  confirmed_at + 30 days (within one second for timestamp precision). An
  unknown return, missing receipt, inconsistent entitlement or database error
  returns 503; conflicting payment ownership/amount/status returns 422. This
  catches partial records left by the old non-atomic handler instead of falsely
  treating their presence as activation success. Such inconsistent records are
  not repaired by bypassing the RPC.
- Duplicates never invoke activation when a matching confirmed receipt already
  exists. An expired matching period is acknowledged as processed history and
  never renewed. A later confirmed receipt matching the current plan/expiry can
  prove a duplicate was superseded without downgrading that plan. Concurrent
  callers may both enter the RPC; its supplied row lock/unique reference handle
  the winner, and postconditions verify `already_processed` safely. Contract
  mocks test this behavior; the new PostgreSQL module also exercises the original
  function's locking/unique reference with real overlapping sessions.
- The local checkout source was an unauthenticated client-amount eWallet
  implementation, despite earlier operator confirmation that deployed checkout
  creates invoices. The replacement local source explicitly authenticates with
  auth.getUser, reads trusted booking/plan prices and ownership, and creates
  /v2/invoices with server-built metadata. Request/response shape remains
  compatible with the mobile callers. Existing eWallet callbacks remain
  supported when authoritative provider metadata establishes the binding.
  The channel selection is a preference stored in metadata; hosted Xendit
  checkout offers the account's enabled payment methods. No channel is enabled
  or live-mode switch performed. Compare against deployed source before rollout.
- xendit-check-status authenticates and limits reads to the booking customer or
  subscription owner. It handles both provider APIs and returns only status
  and databaseConfirmed, without metadata/customer payloads. It never writes.
  Mobile success requires both provider success and matching committed database
  evidence. A provider-paid event awaiting database confirmation is presented
  as processing, not cancelled or manually awaiting approval. Subscription
  confirmation also checks receipt plan/amount and matching 30-day expiry, so
  an old confirmed row alone cannot claim the current entitlement is active.
- SubscriptionScreen and PaymentScreen use the existing focus/foreground refresh
  hook. Both booking lists already use it. The subscription history/context
  and monthly quota summary refresh read-only. Customer booking confirmation
  text reflects database-confirmed success.

## Subscription catalog evidence and remaining dependency

Operator-supplied effective subscription_payments grants:

| Role | Confirmed privileges |
|---|---|
| anon | REFERENCES, SELECT, TRIGGER, TRUNCATE |
| authenticated | REFERENCES, SELECT, TRIGGER, TRUNCATE |
| postgres | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| service_role | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |

Normal clients cannot INSERT/UPDATE/DELETE subscription payments. Preserve that
model. These grants do not by themselves explain server write failure: the
webhook uses service_role, which has the required table writes.

The supplied existing function is SECURITY DEFINER, postgres-owned, executable
by postgres/service_role only, and accepts:

```text
activate_paid_subscription(
  p_caterer_id uuid, p_plan_id text, p_amount numeric,
  p_payment_reference text, p_payment_method text DEFAULT 'online'
) RETURNS text
```

Operator reports a unique partial index on non-null payment_reference, UUID
payment PK, caterer/plan FKs, pending/confirmed/rejected status CHECK, owner and
staff/admin SELECT policies, enabled RLS and no payment-table triggers. These
are now confirmed against the original export. It also contains a restrictive
authenticated INSERT maintenance policy on subscription_payments; this is
retained verbatim even though normal clients lack INSERT grants. The plans
table has RLS enabled and no policies; normal-client plan reads remain blocked
by RLS while the trusted server reads authoritative prices. No grants/policies
are loosened to support mobile activation.

**Preserved billing semantics/incompatibilities:** the existing RPC sets expiry
to activation time + 30 days; it does not stack onto a future expiry. Early
renewal or plan replacement can therefore replace/shorten remaining time.
Its reset-to-zero quota payload is intercepted by the collected existing
cc_monthly1_guard_cache trigger, which recomputes committed current-month usage.
A real PostgreSQL test confirms that payload does not grant a second monthly
quota. booking_count_reset_at retains the RPC's legacy update. Neither the RPC
nor the quota trigger is modified. An unrecorded delayed historical invoice
still follows the existing RPC's now+30-day policy; ordering rules beyond
reference idempotency are not implemented by the original RPC. This is flagged
as existing behavior rather than adding an unapproved webhook billing policy.
The original body confirms confirmed_at and expiry use the same transaction's
now(), so the webhook's 30-day receipt/entitlement postcondition matches it.
The original RPC does not insert notifications, and no duplicate-prone edge
notification write is added; billing state refresh provides confirmation.

Client TRUNCATE is a separate confirmed permission concern: RLS does not protect
TRUNCATE. It was documented without changing any grants or creating another
hardening proposal. This concern does not block diagnosis of PAID routing.

`supabase/metadata/xendit_subscription_metadata_query.sql` collects only the
two subscription tables' catalog definitions and the existing activation/staff
correction function contracts; it returns no payment/customer records. It was
not executed by Codex. Operator supplied the named RPC contract; it is now used
directly. No replacement function, trigger, role or grant change was prepared.

## Validation

- Focused TypeScript: ten changed Edge/mobile files, installed Supabase and
  Expo types; only Deno.env/serve declarations are supplied in memory. Run
  `node caterconnect-mobile/scripts/check-xendit-payments.cjs`. Not a Deno CLI
  deployment/bundle test.
- Offline invoice/eWallet tests cover success, duplicate/concurrent booking
  delivery, PENDING/failed/partial/mismatched payments, invalid tokens, provider
  failures, database/CAS failures and stale payment records. Additional tests
  cover checkout ownership/authoritative pricing, status endpoint access,
  database-confirmed mobile feedback, all paid plan RPC arguments, duplicate and
  concurrent caller behavior, reference ownership conflicts, failed/missing
  activation commits, expiry, superseded receipts and the real webhook's HTTP
  responses. Subscription RPC execution in these offline tests is mocked, not
  a claim of live activation success. **94/94 focused offline checks passed**:
  invoice/eWallet 19, automatic payments 20, phase-2 12, auth subscription reads
  4, pricing 11, publication 14, monthly quota 7 and internal notes 7.
- Disposable PostgreSQL 18.3: **121/121** existing full-schema checks passed with
  `node supabase/tests/test-package-publication-postgres.cjs --internal-notes --reports --invoice-payment --pricing-math --pricing-full`.
  This replays the actual booking helper's conditional UPDATE against imported
  constraints/triggers and exercises pricing/history/refunds/notifications,
  monthly/daily quotas, publication, notes and reports. Cluster
  cc-package-pg-xJPLQ4 was stopped. The added check applies the supplied RPC's
  activation reset payload to the actual collected caterer quota trigger.
  No subscription_payments schema was fabricated
  to claim activation compatibility.
- Phase-2 tests retain the old helper's unit coverage while replacing obsolete
  assertions that the unsafe subscription branch and manual-review webhook
  must remain unchanged. Monthly SQL hashes remain enforced unchanged.
- Original catalog/RPC tests run with the additional `--subscription-payment`
  harness flag. They cover exact grants and service-only EXECUTE, every paid
  plan, authoritative prices, committed receipt/expiry, quota projection,
  rejection/rollback, the RPC's broad reference shortcut, real concurrency,
  and the actual helper's success, duplicates, foreign/pending references,
  expired receipt, wrong price and injected transaction failure. Final combined
  result: **145/145 PostgreSQL checks passed** (121 existing feature/compatibility
  checks plus 24 original-subscription checks). The complete command is:

  ```text
  node supabase/tests/test-package-publication-postgres.cjs --internal-notes --reports --invoice-payment --pricing-math --pricing-full --subscription-payment
  ```

  PostgreSQL 18.3 cluster `cc-package-pg-DJcmef` was stopped. The imported original
  activation definition SHA256 is
  `073b467da1dc07e0469317e2ab63bca078606997b99cd978a43b4042566b6e75`.
  Its prosrc was compared to the exported body; owner/ACL/SECURITY DEFINER/search
  path were asserted. No copied/replacement activation function is proposed
  for production. The local test import is not a production migration.

## Deployment plan — after tests pass and explicit approval

The main behavioral correction is **xendit-webhook**. This local change also
updates checkout and the status endpoint used by the refreshed app, so deploy
the three matching versions in this order. Status reads go first, then the
verified webhook, then invoice creation so new checkouts have a compatible
consumer. Do not deploy all functions or run any migration.

From the caterconnect-mobile directory, replace YOUR_PROJECT_REF with the
reviewed Supabase project reference:

```powershell
npx supabase functions deploy xendit-check-status --project-ref YOUR_PROJECT_REF
npx supabase functions deploy xendit-webhook --project-ref YOUR_PROJECT_REF --no-verify-jwt
npx supabase functions deploy xendit-payment --project-ref YOUR_PROJECT_REF
```

Checkout/status require a user JWT and explicitly verify auth.getUser. Only
the webhook disables the gateway user-JWT check because Xendit authenticates
with x-callback-token. Confirm the existing test-mode XENDIT_SECRET_KEY,
XENDIT_WEBHOOK_TOKEN, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY match this
project; never paste secret values in chat/logs or put them in EXPO_PUBLIC vars.

After separate deployment approval:

1. In Xendit Test Mode confirm invoice and eWallet callback URLs point to this
   project's /functions/v1/xendit-webhook. Compare deployed source with these
   reviewed versions. Do not point a live-mode callback at this test rollout.
2. After explicit authorization, redeliver an existing successful test event
   through Xendit's dashboard; this writes a test booking/subscription, so it
   is not an automatic read-only check. Never forge a callback or pay again to
   hide a missed callback. Review mismatches/old partial state before redelivery.
3. Confirm provider GET succeeded, handler returned HTTP 200 only after a
   committed update/no-op, and safe result codes identify processed/duplicate
   behavior. A 503 requires retry; a 422 requires binding/amount/state review.
4. Inspect the exact booking row: status paid, expected payment_reference,
   payment_verified_at, unchanged total/deposit/refund state. Confirm one set
   of database payment notifications. Redeliver again and confirm no changes.
5. For subscriptions, verify one confirmed payment and the matching plan,
   expiry = confirmed_at + 30 days and unchanged authoritative monthly usage.
   Successful logs use SUBSCRIPTION_ACTIVATED. Re-delivery must return a verified
   duplicate result without another payment row, expiry extension or quota reset.
   Expected safe duplicate codes include SUBSCRIPTION_ALREADY_PROCESSED,
   SUBSCRIPTION_ALREADY_PROCESSED_EXPIRED and
   SUBSCRIPTION_ALREADY_PROCESSED_SUPERSEDED. A legacy confirmed receipt with
   missing/inconsistent entitlement returns SUBSCRIPTION_ENTITLEMENT_MISMATCH
   (HTTP 503), never false success. The existing RPC does not repair such a
   partial legacy record; any production reconciliation requires separate
   authorization. This is an exceptional data conflict, not a new approval
   stage for normal verified Xendit payments.
6. Open customer/caterer booking screens and Plans & Billing in Expo Go. Verify
   database-confirmed state refreshes without staff approval. Keep manual
   receipt verification tests separate and unchanged.
