# Phase 5 reports — definitions and installation review

## Scope and evidence

One new read-only `get_caterer_reports(date,date)` RPC plus an Expo reports screen, linked from the caterer dashboard. The RPC derives ownership from auth.uid() and requires profiles.role=caterer; no client-supplied caterer ID is accepted. It returns aggregates only, not customer identities, payment references or private notes. It is STABLE, postgres-owned, has an empty search_path, and grants EXECUTE only to authenticated. Existing tables, grants, RLS, triggers and records are not changed. No ledger, payment writer, quota calculation or subscription feature is introduced.

Reviewed evidence: the four catalog exports; caterer dashboard/navigation; existing booking/customer payment/refund UI; the corrected Xendit webhook and record-booking-callback helper; protection and lifecycle trigger definitions. The corrected callback records a charge reference for subsequent verification rather than treating it as collected cash. The collected payment-field protection is on UPDATE, while customer INSERT policy only ties customer_id to auth.uid(). No complete immutable captured-amount/settlement ledger or full deployed verification/refund RPC evidence is supplied. Therefore booking status, a reference, verification timestamp and configured downpayment amount are insufficient to establish actual collected cash in this report. No payment/security changes are made to compensate.

## Date and counting definitions

- Every available metric uses **booking creation date**, from bookings.created_at in Asia/Manila, inclusive start/end calendar days. SQL uses a lower-inclusive / next-midnight-exclusive timestamp range. Event date, quota_month, payment date and refunded_at do not filter these metrics.
- This Month, Last Month and This Year are complete calendar periods in Manila. Custom ranges support up to 366 inclusive days. Invalid dates/ranges fail explicitly.
- Total includes all eight booking statuses once per booking. Counts display current state, not past transition events. Completed records remain included; no counter updates are performed.
- Trends count all bookings by Manila creation month, including zero months, clipped to the chosen range. These are not monthly quota usage.
- Popular packages: top 10 by all booking records in the creation cohort, including pending/rejected/cancelled. Ties sort by package name then ID. Archived/unpublished packages remain included through historical references, scoped to the same caterer. Names are current stored package names, not invented historical snapshots.
- NULL creation dates cannot be assigned a period and are excluded; their owned-record count is disclosed separately. They are not silently backfilled.

## Exact financial definitions

| Metric | Definition |
|---|---|
| Estimated booking value | Sum of stored total_cost for currently confirmed, awaiting_payment, paid, ongoing and completed bookings **created in the selected range**. Pending/rejected/cancelled excluded. Expected contract value only; not collections, revenue recognized or net income. |
| Actual payments received | **Unavailable**. No reviewed immutable captured/settled amount source is available. No downpayment estimate, total_cost, paid state, reference or duplicate callback event is summed as actual cash. |
| Settled refunds | **Unavailable**. No reviewed settled-refund amount source. Promised/pending/processed flags, dispute state and transfer proof are not substituted for cash returned. |
| Recorded refund obligations | Sum of stored refund_amount for cancelled bookings in the same creation cohort with pending, overdue or awaiting_customer_confirmation refund status. Includes unconfirmed proof submissions; excludes processed/failed/none. Not a settled-refund total. |
| Open/investigating disputes | Distinct bookings in the creation cohort with an open/investigating refund dispute. May overlap obligations; not an additional amount owed. |

Zero records produces zero estimated/obligation sums, while unsupported cash metrics remain Unavailable. NULL, negative or nonfinite amounts in eligible rows make the corresponding estimated sum unavailable, rather than treating them as zero. Amounts are aggregated as PostgreSQL numeric and returned as decimal strings; UI declines values beyond safe display precision.

Payment/refund-date cash flow, complete collections, duplicate-payment reconciliation, partial/additional payments, net revenue and accounting recognition are intentionally not inferred. Snapshot status/refund changes can change reports for an older creation cohort. This is a current-state operational report, not an immutable financial ledger.

## Rollout and mitigation

1. Review the guarded `caterer_reports_proposal.sql` and isolated test results. Do not run it against live Supabase until separately approved. No execution copy is prepared.
2. After approval, prepare/install only this RPC transaction without its intentional proposal stop. Do not rerun previous migrations. Keep all preflight and security assertions.
3. Release the reports helper/screen and dashboard link after RPC installation. Until then the screen reports unavailable setup rather than fabricated statistics.
4. Manually test Android Expo Go date filters, refresh, customer denial and actual PostgREST RPC discovery. Reports are read-only; no test booking/payment is created automatically.

If rollout pauses, hide the reports navigation entry. A separately approved DROP FUNCTION ... RESTRICT can remove only this API; no data needs reversal. Never weaken existing RLS or use CASCADE.

## Local verification — 2026-10-20

- Disposable PostgreSQL 18.3: **70/70** checks passed with `node supabase/tests/test-package-publication-postgres.cjs --internal-notes --reports`: 17 reports checks and 53 existing publication, internal-notes, booking, daily/monthly enforcement and concurrency checks. Reports checks cover owner isolation, customer/anonymous/staff denial, all eight statuses, archived package ranking, Manila date boundaries, empty/invalid periods, refund obligations/disputes, duplicate payment references, invalid amounts and execution in a read-only transaction. The disposable cluster was stopped.
- Reports offline tests: **8/8** passed. Combined focused regressions: **58/59** passed. The existing package-management source-contract test fails because it expects `Unpublish` and `Restore as unpublished` labels absent from the current unrelated package screen. Neither that screen nor its assertion was changed for Phase 5.
- Focused TypeScript passed for the reports screen/helper, caterer dashboard and navigation, including their imports. The new PostgreSQL test script passed syntax checking; targeted tracked-file whitespace checks passed.
- No live SQL, production writes or deployment occurred. Hosted PostgREST discovery and Android/iOS device interactions remain manual checks after approved installation. These fixtures do not verify hosted Auth or Xendit network settlement.
