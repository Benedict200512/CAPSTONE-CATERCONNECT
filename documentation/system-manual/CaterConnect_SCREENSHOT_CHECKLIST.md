# CaterConnect — Actual Screenshot and Acceptance Checklist

Review date: 20 October 2026 (Asia/Manila). 26 numbered figure placements; some placements combine two related views and may need panels (a)/(b). Capture from the real authorized build, never an invented mockup.

## Capture protocol

1. Record the app/web build, device/browser, date and role privately.
2. Use synthetic or consented accounts. Remove real names, addresses, phone numbers, email addresses, document numbers, bank/wallet destinations and transaction IDs. Never capture credentials, tokens, OTPs or secret dashboards.
3. Open the actual route and perform only authorized operations. Do not initiate a payment, create Staff or change maintenance in production solely for a screenshot.
4. Include the real action labels and state needed to support the procedure. If a feature is unavailable, capture the actual error and keep its CONDITIONAL label.
5. Use portrait mobile images and legible desktop portal images. Retain the original redacted capture for provenance; do not alter interface labels.
6. Replace the corresponding manual placeholder and keep the figure number/caption. For multipanel captures use (a)/(b) under the same number. Provide accessible alternative text.
7. Update all Word fields/contents/page numbers and repaginate after insertion. Recheck table wrapping and captions.

## Figure checklist

| Done | Figure | Caption | Role / route | Required evidence |
| --- | --- | --- | --- | --- |
| [ ] | 2.1 | Customer registration and policy agreement | Customer / /(auth)/register | Show all required fields and the agreement without real credentials. |
| [ ] | 2.2 | Home search and Smart Budget Matcher | Customer / /(tabs) | Show a controlled budget/guest example and matching base total. |
| [ ] | 2.3 | Booking wizard Review and Cost Breakdown | Customer / Booking wizard → Review | Use the worked pricing example; show fixed price, extras, add-ons and deposit. |
| [ ] | 2.4 | Database-confirmed booking payment | Customer / Bookings | Capture a permitted test booking after verified update, with references redacted. |
| [ ] | 2.5 | Refund evidence and customer confirmation | Customer / Booking details | Use synthetic evidence and redact destination details. |
| [ ] | 2.6 | Booking chat and customer review form | Customer / Messages; completed booking | Use consented test messages and a completed synthetic event. |
| [ ] | 3.1 | Caterer Dashboard and quick actions | Caterer / /(caterer) | Show verification state, usage and action cards with test data. |
| [ ] | 3.2 | Business verification documents | Caterer / Business Profile editor | Show all five document types using redacted demonstration documents. |
| [ ] | 3.3 | Package pricing and publication controls | Caterer / Packages | Show minimum/included/maximum fields, automatic rate and published/unpublished/archived states. |
| [ ] | 3.4 | Menu item editor and serving description | Caterer / Menu → Add Item | Show per-guest price separately from serving units. |
| [ ] | 3.5 | Availability and daily capacity | Caterer / /(caterer)/availability | Show blocked/full/open dates and committed counts. |
| [ ] | 3.6 | Booking management and private notes | Caterer / Booking Summary | Use a test event; show actions and private-note save/clear controls. |
| [ ] | 3.7 | Caterer refund proof and investigation response | Caterer / Bookings → refund/dispute details | Redact account numbers and show the customer-confirmation requirement. |
| [ ] | 3.8 | Plans & Billing and payment history | Caterer / Business → Subscription Plan | Show tier limits, expiry and a verified synthetic receipt; redact references. |
| [ ] | 3.9 | Reports & Analytics metric definitions | Caterer / /(caterer)/reports | Capture the current financial caveats and date bases, not an invented revenue chart. |
| [ ] | 3.10 | Customer profile in a booking conversation | Caterer / Booking chat → avatar/name | Use a consented test profile and missing-field example. |
| [ ] | 4.1 | Staff portal login and Dashboard | Platform Staff / /login; /staff | Hide credentials; show the actual operational queues. |
| [ ] | 4.2 | Application audit and verification decision | Platform Staff / /staff/verification | Redact document numbers and show rejection rationale or approval control. |
| [ ] | 4.3 | Complaint investigation and resolution controls | Platform Staff / /staff/complaints | Use an approved synthetic ticket and show all four status filters. |
| [ ] | 4.4 | Read-only booking and refund monitoring | Platform Staff / /staff/bookings; /staff/refunds | Show that viewing evidence is not a refund or payment approval. |
| [ ] | 4.5 | Subscription correction and account monitoring | Platform Staff / /staff/subscriptions; /staff/account-monitoring | Use synthetic references; include reason fields and audit history. |
| [ ] | 5.1 | Administrator Dashboard and User Directory | Administrator / /admin; /admin/users | Use test accounts and redact real identifiers. |
| [ ] | 5.2 | New Staff provisioning form | Administrator / /admin/settings | Show field labels, password rules and no existing-account conversion. Never show a password. |
| [ ] | 5.3 | Revenue and loaded CSV report snapshot | Administrator / /admin/revenue; /admin/reports | Show subscription-only metrics and state the 200-record report limit in the caption. |
| [ ] | 5.4 | Activity filters and read-only event details | Administrator / /admin/activity | Redact actor/target IDs and show loaded-record filter labels. |
| [ ] | 5.5 | Maintenance settings, health and audit history | Administrator / /admin/maintenance-security | Capture a demonstration notice; do not enable production maintenance merely for a screenshot. |

## Additional state evidence for acceptance

- [ ] Customer: empty search, invalid guest bounds, blocked/full date, add-on quantity, fractional-rate total and saved quote match.
- [ ] Payment: authenticated provider-confirmed success AND correct committed record; pending/failure has no false paid state; duplicate has no new receipt/term. Only run authorized test payments.
- [ ] Subscription: active Basic/Standard/Premium example, expiry from receipt + 30 days, effective quota on expiry, history/channel fallback and no manual normal approval.
- [ ] Refund: pending, overdue if safely reproducible, proof-awaiting-customer, missing destination, dispute response and processed only after actual test receipt.
- [ ] Chat: send/reload, photo, emoji draft, reaction toggle/removal/failure, simultaneous-account synchronization and RLS denial; do not certify unresolved whole-map races.
- [ ] Profile: authorized booking access, Not provided fields and another account’s denial; privacy depends on actual deployed RLS.
- [ ] Notes: assigned caterer save/edit/clear/reload and stale revision; customer/other-caterer denial.
- [ ] Staff: actual document previews, complaint state persists, refund screen has no disbursement controls; audit/reason actions only if installed.
- [ ] Admin: create only a new Staff identity, reject existing-email conversion and non-admin caller, preserve role safeguards; no production account creation for evidence without authorization.
- [ ] Reports: Admin CSV at most 200 recent rows, rolling revenue windows, date-base definitions and no settlement claim.
- [ ] Maintenance and signout: approved test notice, gate recovery, accessible support outside a blocked app and session cleared.
- [ ] Verify all visible labels against the final demonstration build; update source-based caveats only after evidence review.

## Acceptance worksheet

| Feature/figure | Tester/role | Build and date | Test environment | Observed result | Redaction complete | Follow-up |
| --- | --- | --- | --- | --- | --- | --- |
| [Complete during authorized testing] | | | | | | |

No device screenshots or live acceptance results were produced during documentation generation.
