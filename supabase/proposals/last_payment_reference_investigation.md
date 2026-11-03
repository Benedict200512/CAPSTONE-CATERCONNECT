# last_payment_reference investigation — 2026-10-20

**Status: CLOSED — operator accepted KEEP on 2026-10-20.** Preserve
public.caterers.last_payment_reference unchanged. Do not delete, rename or
modify it, and do not prepare a removal migration. Its historical purpose
remains uncertain. Reopening requires a future explicit request. This closure
changes documentation only; Xendit payments, subscriptions, refunds and the
database schema remain unchanged.

**Recommendation: KEEP. Classification for removal decisions: LEGACY, because
reported historical annotations have not been cleared for disposal. No active
explicit dependency was identified in source or the operator-reported live
catalog check. It is not confirmed UNUSED.** No removal
migration is prepared. No column, financial record, grant, function, trigger,
policy, application behavior or Xendit implementation was changed.

## What is verified

The workspace search covered mobile/web source, Edge Functions, SQL/proposals,
tests and collected catalog exports, including hidden/ignored project files.
Dependency/vendor directories, generated bundles and .git were excluded.
Before adding this investigation, the only literal `last_payment_reference`
match was the column definition in
`supabase/metadata/caterer_booking_schema_metadata.json:3473`. No literal
`STAFF MANUAL CLEARANCE` appeared in project source or the collected exports.
No originating ADD COLUMN migration, named reader/writer, or creation rationale
was found. This is not evidence that no deployed or former writer exists.

That collected catalog describes nullable JSONB with no default, no generated
expression, and no column-specific constraint in the exported caterers
constraints. Its 22 exported function definitions contain no literal reference
to the column. This is a scoped earlier export, not a complete current catalog.

| Area | Evidence | Relationship to this column |
|---|---|---|
| Mobile account loading | `caterconnect-mobile/context/AuthContext.tsx:51-62`: fetchProfile selects the caterer row with `select('*')`, then stores it in catererData | Implicitly retrieves the column when authorized; no named consumer or writer was found. Whole-row reads must not be described as no reads. |
| Xendit subscriptions | `verify-subscription-payment.ts`: verifySubscriptionPayment uses subscription_payments.payment_reference and calls activate_paid_subscription | No access to caterers.last_payment_reference. The original activation body in xendit_subscription_catalog_export.txt inserts a confirmed subscription receipt and updates plan, expiry and quota fields, not this column. |
| Staff subscription correction | `caterconnect-web/src/pages/staff/SubscriptionManager.tsx:135`: correctPlan calls staff_correct_subscription_plan | Original exported RPC validates a confirmed subscription_payments receipt, updates plan/expiry and inserts system_audit_logs. It does not use this column. |
| Booking payment evidence | `xendit-webhook/verify-booking-invoice.ts:34-61`: verifyBookingInvoice | Uses bookings.payment_reference, payment_receipt_url and payment timestamps. These are separate from the JSONB field on caterers. |
| Refund evidence | Caterer bookings submit refund_transfer_submissions; customer bookings call confirm-customer-refund; Staff RefundManagement loads bookings refund fields, submissions and disputes | No named use of the column. The deployed confirm-customer-refund source is not present locally, so its behavior cannot be exhaustively inferred from this caller. |
| Refund JSON rendering | `caterconnect-web/src/pages/staff/RefundManagement.tsx:55`: destination parses method/payment_method/refund_method and account details | This renders bookings.refund_account_details, not caterers.last_payment_reference. Similar JSON keys do not establish a dependency. |
| Account standing | Collected protect_refund_account_standing() and account_monitoring_protect_suspension() triggers | These protect account_standing. Neither exported body refers to last_payment_reference. Current caterer booking notices use account_standing for refund compliance. |
| Reports | Existing reports use booking/payment/refund records; Admin Revenue displays subscription payment references | No explicit use found. This is a source search finding, not a complete live view/RPC audit. |

Paths for the webhook helpers above are under
`caterconnect-mobile/supabase/functions/xendit-webhook/`.

## Purpose and historical significance

The operator reports non-NULL values such as
`{"method":"STAFF MANUAL CLEARANCE..."}`. That text suggests a previous manual
clearance annotation. The exact producing function/person, date, link to refunds
or account reinstatement, and whether another audit record preserves it are
**not established** by the repository. It must not be asserted to be an actual
refund transfer, a verified Xendit payment, a subscription receipt or proof of
money collected. No historical rows were read in this investigation.

The values may be historical operational/audit information. Until the operator
reviews their provenance and applicable retention requirements, deleting them
would discard potentially relevant evidence. NULL alone means there is no
stored value; it does not establish payment/refund/subscription state.

Current inspected payment paths do not need this column explicitly. Combined
with the operator's live catalog result below, there is no identified active
explicit code/database dependency. That does not establish that the stored
annotations have no historical reconciliation or audit purpose. Catalog checks
also do not inventory external scripts or every dynamic/whole-row use. CASCADE
must not be used to bypass any dependency discovered during a later review.

## Operator-reported live dependency result

The operator subsequently reports that a live Supabase catalog dependency check
returned exactly one row: category COLUMN, object
public.caterers.last_payment_reference, type jsonb, nullable true. No
FUNCTION_REFERENCE, VIEW_REFERENCE, TRIGGER_REFERENCE or DEPENDENCY rows were
returned. This supports the finding that no active explicit database dependency
was identified. It is operator-supplied evidence, not SQL executed by Codex.

No original result file or executed query was supplied in the workspace. The
reported category/row format differs from the JSON object produced by the local
last_payment_reference_metadata_query.sql, so it is not represented as that
query's complete output. In particular, no aggregate historical inventory,
annotation provenance, durable audit-copy confirmation or retention approval
was supplied. There is no need to repeat the reported dependency check merely
to resolve the outstanding historical-data question.

## Remaining removal condition

Review the non-NULL records privately to determine whether they are the only
record of a staff clearance or payment reconciliation, whether an adequate
durable audit copy exists, and whether retaining or disposing of them is
authorized. No current historical reconciliation consumer was found; historical
purpose cannot be ruled out from a dependency search. Do not paste full
financial/customer payloads. The operator has not yet stated that this review
is complete or that the history is no longer required.

Only after that history review can classification become UNUSED. If active use
is later discovered it becomes REQUIRED; retained historical information remains
LEGACY. Even if UNUSED is
established later, a separate reviewed removal transaction must stop on any
unexpected dependency, preserve approved historical evidence, use RESTRICT,
include staging regression/whole-row API compatibility tests, and require
explicit installation approval. No DROP or archival write is included here.

## Validation

This change consists only of this investigation document and a read-only
metadata query. No application TypeScript was edited; no schema was changed.
Codex has not run the query against live Supabase; the operator-reported live
result is recorded above. No historical counts are claimed. Focused offline automatic-payment tests passed 24/24 and
booking invoice tests passed 19/19 (43/43 total). These exercise existing
verification/activation and duplicate/failure behavior; they do not certify
safety of dropping the column or substitute for deployed refund/catalog tests.
This follow-up updates only the investigation document; those previously passed
tests were not rerun for a documentation-only update.
