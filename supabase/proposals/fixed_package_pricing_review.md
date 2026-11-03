# Fixed-package pricing — local implementation and database review

No SQL was run against live Supabase. No app/function deployment, production write or payment was performed. The pricing proposal and separate TRUNCATE-hardening proposal require installation approval.

## Exact calculation

- Required positive whole guests: coalesce(min_guests,1) <= guests <= max_guests. Package configuration requires minimum <= included guest_capacity <= maximum. Missing max_guests fails closed in the updated client; it is not guessed.
- Within included capacity the full package price applies, including below capacity. No package multiplication remains.
- Extra guests = max(guests - guest_capacity,0). Extra subtotal = round(package.price * extra guests / guest_capacity,2). **Do not round the per-guest rate before multiplication.** Displayed automatic rate is rounded to two places and labeled approximate/display-rounded.
- Menu additions = sum(authoritative menu price_per_guest * all guests * positive integer quantity). Additions remain separate from the extra-guest subtotal. Final booking total is fixed price + extra subtotal + menu additions. Downpayment = round(final total * current authoritative caterer downpayment_percent / 100,2).
- TypeScript uses BigInt centavo arithmetic with positive half-up rounding. SQL uses exact NUMERIC arithmetic and round(...,2). Money/percent inputs may have at most two decimals; invalid/nonfinite/negative/unsafe values are rejected. Both sides cap transport/display precision at 90,071,992,547,409 centavos.
- Example: price 50,000, included 100, minimum 50, maximum 150 yields 80/100 = 50,000; 101 = 50,500; 120 = 60,000; 150 = 75,000. Guest counts 49 and 151 fail. Price 100 / capacity 3, with 5 guests, yields an extra subtotal of 66.67 and total of 166.67, even though the displayed rate is 33.33.

## Changes

- New shared `lib/packagePricing.ts`; `lib/catererSearch.ts` calls it for Budget Matcher totals/eligibility.
- Package form keeps Price, Minimum Guests and Included Guest Capacity and adds only Maximum Guests, plus a read-only automatic-rate preview. It validates bounds before writes and continues creating unpublished packages. Existing archived toggle erroneously attempted archived -> published; it now restores to unpublished with explicit accessible labels, retaining the icon layout.
- Wizard uses the shared calculator, blocks minimum/maximum violations, shows fixed price and extra-guest subtotal separately, and computes add-ons/downpayment from the final total. Existing publication/date checks and booking INSERT/customization workflow remain.
- Marketplace, package details, saved packages and comparison fetch/display max_guests. Existing publication filters remain. Marketplace/matcher explanations now describe fixed pricing and extra guests instead of package multiplication.
- The original shared orange #F97316 remains unchanged. Historical booking summaries/payments continue reading stored totals; they do not reprice historical records from today's package prices.

## Database proposal and preserved history

`fixed_package_pricing_proposal.sql` adds only max_guests to packages. It backfills existing packages' maximum to included capacity, without changing price/minimum/capacity. New legacy-client package inserts that omit maximum receive included capacity as the default via a narrow trigger. Owners must explicitly raise maximum when they support extra guests. Existing invalid package values cause a review stop rather than a silent correction.

For new bookings, an actor-bound BEFORE INSERT guard locks the caterer then published package, reads authoritative same-caterer menu prices, validates quantities and duplicate menu IDs, recomputes the total/deposit, rejects stale/manipulated submitted amounts, and normalizes the existing customized_items JSON to authoritative names/prices. Clients cannot insert Paid/payment evidence/refund evidence through this path. A private quote registry and narrow trigger freeze quote inputs/amounts **only for newly inserted bookings**, leaving existing historical records untouched. Lifecycle/payment/refund timestamp/status changes can continue without recalculating quotes. No existing RLS policy, quantity/daily/monthly implementation, payment/refund function or existing trigger is rewritten.

The new detail trigger preserves the existing wizard's separate booking_customizations INSERT. For registered new quotes it accepts only menu IDs, quantities, saved authoritative prices and is_added=true that match the booking JSON. A parent-booking row lock prevents concurrent duplicate details without adding a uniqueness constraint to historical data. Directly changing/removing a protected detail is rejected; an identical update remains possible for the customer. Historical details retain their existing RLS-authorized workflow. Permitted parent booking deletion and authorized menu deletion retain their existing FK cascades. Removing a menu may remove its mirror rows, but the immutable booking JSON retains the quoted name/quantity/price and stored financial totals. Repository callers were checked: the wizard's detail INSERT is the only application write to this table.

The private registry is intentional: it distinguishes new protected quotes from historical rows without adding booking columns or rewriting old amounts. It cascades on otherwise-permitted booking deletion. Like the existing private notes FK, it can make service-role TRUNCATE CASCADE fail on private-table permissions; do not grant access to bypass protection. Keep the registry on mitigation; do not discard quote integrity/history.

No extra_guest_fee implementation or earlier migration was found in the repository. The targeted catalog query also checks deployed legacy-field/function references. The proposal stops if either max_guests or extra_guest_fee already exists. It never drops legacy fields/data or replaces unreviewed fee triggers/functions. If a deployed legacy fee exists, its exact dependencies must be reviewed to retire its use without dropping unrelated data.

## Confirmed supporting catalog and permission exposure

The user-supplied results confirm package guest_capacity INTEGER NOT NULL, min_guests INTEGER NULL and price NUMERIC NOT NULL. The subsequent column inventory confirms the two supporting tables below. These are operator-supplied definitions, not a new live inspection by Codex.

| Table | Confirmed column compatibility |
|---|---|
| public.menu_items | id/caterer_id are non-null UUIDs; name/category are non-null text; price_per_guest is non-null NUMERIC with default 0. These match the proposal's lookup, ownership filter, normalized name and authoritative price arithmetic. Nullable description/image_url/created_at/serving_size/serving_unit do not enter financial calculations. |
| public.booking_customizations | booking_id/menu_item_id are non-null UUIDs, quantity is non-null INTEGER with default 1, price_per_guest is non-null NUMERIC, and is_added is non-null BOOLEAN with default true. These match every field in the existing wizard's detail insert. Generated UUID id and nullable created_at are omitted by that insert. |

Zero-priced menu items are supported: both the calculator and proposed guard accept zero add-on prices, while retaining a positive fixed package price. Serving size/unit do not become guest-price multipliers. The supplied column definitions demonstrate no column/type defect requiring a pricing SQL change.

The operator subsequently supplied the remaining definitions. Each table has only its UUID primary-key index. menu_items.caterer_id references caterers(id) ON DELETE CASCADE; category is restricted to main_course/dessert/drink/appetizer. booking_customizations.booking_id references bookings(id) and menu_item_id references menu_items(id), both ON DELETE CASCADE. No non-internal triggers were returned. Both tables have RLS enabled and FORCE RLS disabled.

All six exact operator-supplied policy USING expressions are captured in `supabase/tests/fixtures/fixed-pricing-menu-catalog.sql`, including scalar ownership subqueries, staff/admin ANY role check, PUBLIC roles and NULL WITH CHECK. The fixture omits explicit WITH CHECK, so PostgreSQL applies the ALL policy's USING expression as its write check. Policies are not rewritten by pricing. Confirmed effective SELECT/INSERT/UPDATE/DELETE/TRUNCATE privileges for anon, authenticated, postgres and service_role are reproduced and asserted. Unqueried REFERENCES/TRIGGER/MAINTAIN privileges, original constraint names and exact ACL grantor/option provenance are not inferred. The other security dependencies come from the four collected exports and installed support DDL.

**Confirmed security issue:** the existing anon/authenticated TRUNCATE permissions bypass RLS and row triggers. A disposable anonymous SQL session successfully truncated customization rows even with the pricing row guard installed. Stored booking totals/JSON were unaffected, but detail history was erased inside the rolled-back test transaction. This demonstrates a database privilege exposure, not an assertion that Supabase PostgREST exposes a public TRUNCATE endpoint.

`pricing_detail_truncate_hardening_proposal.sql` is a separate, intentionally stopped proposal revoking only TRUNCATE from PUBLIC/anon/authenticated on these two tables. It preserves CRUD, RLS, service_role permissions and all existing triggers. Its verification stops if inherited client TRUNCATE remains. Review and approve it independently; do not release detail immutability as complete while leaving this bypass. Tests check normal wizard inserts/customer reads and caterer menu management before and after hardening.

The supplied no-trigger baseline confirms detail mutations do not recalculate booking totals. Authoritative financial values remain the normalized booking JSON and immutable stored total/deposit, never mutable customization mirrors. No historical rows are registered or repriced. The pricing preflight now rejects unexpected menu/customization triggers and already-deployed max_guests/extra_guest_fee objects instead of replacing unreviewed definitions. The targeted metadata query remains available for deployment drift checks.

## Validation — 2026-10-20

- Offline pricing checks: **11/11 passed**, covering boundaries, fractional rates, independent add-ons, final-total downpayment, invalid configuration/inputs, matcher consistency, ignored client totals/manual-fee properties, detail mirrors, separate hardening and SQL/source integrity contracts.
- Focused TypeScript passed for the pricing helpers, package form, wizard, marketplace, caterer detail, comparison and saved-package screens and their imports.
- The follow-up changed SQL/tests/docs only. The focused pricing-helper TypeScript check was rerun successfully with `node node_modules/typescript/bin/tsc --noEmit --target ES2020 --module commonjs --skipLibCheck lib/packagePricing.ts` from caterconnect-mobile; no mobile runtime code changed in this follow-up.
- Disposable PostgreSQL 18.3: **120/120 passed** with `node supabase/tests/test-package-publication-postgres.cjs --internal-notes --reports --invoice-payment --pricing-math --pricing-full`. This includes the prior 75 schema/trigger/security/payment/concurrency regressions, seven extracted arithmetic checks, and 38 full-pricing/catalog/hardening checks. The final run installs the complete pricing proposal with only its intentional stop removed, using the supplied exact six policies and confirmed effective privileges. It preserves all pre-existing public policy/ACL/RLS/function/trigger definitions and compares every historical booking field before/after installation.
- Full-pricing cases cover canonical detail inserts, all supplied boundaries, fractional rates, zero-price additions, duplicate IDs/details including real concurrent inserts, invalid quantities, foreign menu IDs, stale prices, manipulated totals/deposits, direct financial-input edits, legitimate verified payment/status/refund transitions and notifications, daily/monthly/subscription/publication guards, historical detail behavior, parent/menu FK cascades and cross-account/anonymous denial. Separate hardening tests reproduce the anonymous TRUNCATE exposure, then verify denial without breaking CRUD workflows. No hosted Auth/PostgREST/Xendit request or device interaction was tested. The disposable cluster was stopped (cc-package-pg-5s39lG).
- Current offline focused suites total **73/74 passed** (pricing 11, publication 14, payment dependencies 12, monthly 7, Xendit 15, reports 8, notes 7). Pricing is **11/11** including the new mirror/hardening source contracts. The sole failure is the existing source-contract assertion requiring the text “Actual payments received” in the user-modified reports screen. Reports code/test were left unchanged.
- `fixed_package_pricing_EXECUTE.sql` is prepared for separate review/approval. It matches the fully tested proposal byte-for-byte except removal of its single intentional proposal-stop block; BEGIN/COMMIT, locks, preflights, price/owner checks, private registry and all guards remain. SHA256: `63dc813baf31d6d63ba78e7a35514a16a0b1867777b1a6af0f838147d3fa8639`. It has not been installed in live Supabase. Following separate preparation approval, the TRUNCATE-hardening execution copy and its own review are now prepared; see `pricing_detail_truncate_hardening_review.md` for permission tests and the SET ROLE membership limitation. Neither migration is authorized for live installation.

## Installation and manual steps

1. Review the tested execution copy and the separate TRUNCATE-hardening proposal. The exact supplied policy/column/constraint definitions and confirmed effective privileges are now covered. Review any external direct-SQL maintenance caller relying on client TRUNCATE before approving the separate hardening. Unqueried ACL provenance/role memberships and deployment drift remain installation checks, not reasons to assume broader access is safe.
2. Separately approve installation of pricing and permission hardening. Prepare a hardening execution copy only after its own approval; retain its role/permission verification. Do not release until the confirmed client TRUNCATE bypass is addressed. No previously installed availability, quota, publication, notes or reports migration should be rerun. Pricing preflights stop on already-present max_guests/extra_guest_fee or unexpected customization/menu triggers; inspect collisions instead of dropping data.
3. Install backend before releasing updated mobile code, using an approved coordinated rollout window. Old clients multiply packages and their over-capacity totals will be rejected by the new guard; new clients require max_guests. Review this transition rather than silently accepting old manipulated/stale totals.
4. Caterers review each existing package maximum (initially included capacity). Test new/edited packages, all supplied boundaries, fractional pricing, multiple menu quantities, wrong-caterer menu IDs, manipulated totals/deposits, price changes during submission, unpublished packages, and payment on a new quote with actual database protections enabled. Existing pending/paid/completed history must retain stored amounts.
5. Test Expo Go on Android/iOS and ensure all price summaries match the stored server-validated total. Do not trigger Xendit payments or deploy automatically as part of these checks.

Operator verification queries after separately approved installation (not executed by Codex):

```sql
-- Pricing triggers should all be enabled (O or A).
SELECT tgname, tgenabled FROM pg_trigger
WHERE tgrelid IN ('public.packages'::regclass, 'public.bookings'::regclass,
                 'public.booking_customizations'::regclass)
  AND tgname LIKE '%cc_fixed_price1%';
-- After separately approved hardening, both client roles must return false.
SELECT r.rolname,
  has_table_privilege(r.oid, 'public.menu_items', 'TRUNCATE') AS menu_truncate,
  has_table_privilege(r.oid, 'public.booking_customizations', 'TRUNCATE') AS detail_truncate
FROM pg_roles r WHERE r.rolname IN ('anon', 'authenticated');
-- Only max_guests should appear; extra_guest_fee is not introduced.
SELECT attname, format_type(atttypid, atttypmod)
FROM pg_attribute WHERE attrelid='public.packages'::regclass
  AND attname IN ('max_guests', 'extra_guest_fee') AND NOT attisdropped;
```

For mitigation, hide/revert the new booking entry flow first under separate approval, retain protected quotes and max_guests, and prefer a forward fix. Removing guards or the status/quote fields blindly would weaken protection or reinterpret history. Never use CASCADE or drop legacy pricing data automatically.
