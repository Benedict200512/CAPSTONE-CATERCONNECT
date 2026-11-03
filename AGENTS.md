# CaterConnect — Codex Instructions

## Project
CaterConnect is a Cebu catering marketplace using Expo React Native, TypeScript, Supabase Auth/PostgreSQL/RLS/RPC, a staff/admin web dashboard, and Xendit test payments. Inspect the actual repository before assuming paths, schema, or behavior.

## Mandatory workflow
- Read relevant files, imports, callers, database functions, and migrations before editing.
- Make minimal targeted changes. Preserve existing features, UI, and public interfaces.
- Explain affected files and validate with available TypeScript checks/tests.
- Never invent Supabase tables, columns, RPCs, RLS policies, or payment states.
- Never run SQL, deploy, make production writes, trigger payments, or execute destructive commands without explicit approval.
- Never expose or commit credentials, service-role keys, or private user information.
- Distinguish verified facts from assumptions; report exactly what was tested.

## Authentication
- Public registration roles are `customer` and `caterer`; do not permit public self-assignment of `staff` or `admin`.
- Existing mobile code includes `lib/auth.ts`, `screens/auth/RegisterScreen.tsx`, and a `registrationPolicies.ts` module; verify paths.
- Preserve signup, signin, signout, logout, and resend-verification functions.
- Registration passes `acceptedTerms` as the ninth signup argument; signup sends `accepted_terms: true` and `policy_version: POLICY_VERSION` metadata.
- Policy version must match the database. Metadata alone does not provide durable consent history.
- Planned tables: `legal_policy_versions` and `user_policy_acceptances`; confirm migration status.
- Existing `handle_new_user()` trigger creates profiles. Inspect its live SQL and privileged account provisioning before changing it.
- Supabase email confirmation and caterer business verification are separate.
- Do not activate strict consent enforcement before considering older deployed app versions and legal/privacy approval.

## Suspension and monitoring
- User Management currently updates `profiles.status` directly without recording a reason.
- Account Monitoring uses `staff_account_monitoring_list`, `staff_account_monitoring_action` (with a reason), and `account_monitoring_events`.
- Inspect actual RPC SQL and RLS before integration.
- Prefer one reason-required, audited suspension workflow.
- Suspended users should see the truthful active suspension reason via a narrow, authorized lookup, not unrestricted staff audit records.
- Do not invent debts or calculate outstanding balances from processed refunds; do not display unverified GCash payment instructions.
- Resolve whether suspended users retain access to pending refunds and support before enforcing full signout.

## Booking and refunds
Previously inspected backend behavior (reverify before editing):
- `cancel_customer_booking_server` calculates refund of verified downpayment by Asia/Manila calendar days before event: <7 days 0%; 7 days 25%; 8–14 days 50%; 15–29 days 75%; >=30 days 100%.
- Within 24 hours after payment verification and >=7 days before event: 100% refund.
- Refund generally due within 72 hours, subject to implemented extensions.
- Caterer submits transfer evidence; customer confirms receipt. Do not assume staff dispute adjudication is enabled.
- Protect refund-related workflows when changing suspension rules.

## Caterer plans
Configured plans previously observed: Free ₱0 (3 packages, 5 monthly requests); Basic ₱299 (unlimited packages, 20 requests); Standard ₱499 (unlimited packages, 50 requests); Premium ₱999 (unlimited packages and requests). Verify enforcement before asserting ranking, renewal, or billing behavior.

## Payments
Xendit is used in test mode. Do not switch to live mode, trigger payments, or change payment/webhook/refund logic without approval. Payment verification must be server-trusted.

## Database change protocol
Inspect existing functions, tables, constraints, triggers, RLS, grants, and migrations first. Provide reviewable SQL, rollout compatibility notes, verification queries, and rollback/mitigation steps. Never execute migrations without approval.

## Response style
Be direct, precise, and coding-focused. For each task: summarize existing behavior, identify files to edit, make only approved changes, run relevant checks, and report changes plus unresolved risks. Provide complete paste-ready code when requested. Never claim tests or migrations succeeded without verification.
