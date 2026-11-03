# Phase 4 internal booking notes — installation review

The existing `bookings.caterer_notes` field is **customer-visible**: the collected grants allow SELECT and the customer booking screen renders it. It remains unchanged, including historical content. Repurposing it would either expose internal notes or break existing customer queries and messages. The new private table is therefore deliberate, not a duplicate of a private field.

`booking_internal_notes_proposal.sql` creates one table in a private schema and two narrow RPCs. Direct schema/table access is revoked from PUBLIC, anon, authenticated and service_role; RLS is enabled and forced with no client policies. The RPCs have a fixed empty search path, postgres ownership and explicit current assigned-caterer authorization. No caller-supplied owner identity is accepted. Saving checks an expected revision, preventing stale overwrites including after clearing a note.

Existing booking SELECT * queries, customer-visible fields, RLS, grants, triggers and public notes remain unchanged. Private notes never enter booking rows, customer payloads, payment/refund updates or notification messages. The assigned caterer account is the only supported team identity; this change does not introduce staff/team membership access. Trusted database administrators retain privileged access.

The private FK cascades on permitted booking deletion. It also causes service-role TRUNCATE CASCADE operations to fail on private table permissions, even without completed bookings. Do not weaken privileges to bypass this. Ordinary non-completed DELETE cleanup remains supported; completed-history protection remains authoritative.

## Manual installation order

1. Review the guarded SQL and the local test results. No execution copy is prepared and nothing has been installed by Codex.
2. After separate approval, prepare/install the reviewed SQL transaction without its intentional proposal stop. Keep the maintenance lock, preflight checks and preservation assertions intact. Do not rerun previous availability, quota or publication migrations.
3. Release the mobile component/helper and the booking-details integration after the two RPCs exist. Before installation, the editor shows setup-required feedback and does not fall back to the public column.
4. Manually verify owner read/save/clear, another caterer's denial, customer denial and unchanged customer booking/payment/refund access. Existing stored `caterer_notes` are not private and are not migrated implicitly.

If rollout needs to be paused, remove/hide the new editor while retaining its private storage. Do not copy notes to the public booking column, grant direct client access, or drop stored private notes as an automatic rollback.

Local database tests use the four collected catalog exports plus the previously installed availability/quota support DDL. Their auth.users object is a UUID foreign-key anchor; these tests do not test hosted Supabase Auth, PostgREST deployment, device behavior or Xendit network calls.

## Local verification — 2026-10-20

- PostgreSQL 18.3: **53/53** checks passed using `node supabase/tests/test-package-publication-postgres.cjs --internal-notes`. This includes 21 internal-note checks and 32 existing publication/booking regressions. Owner read/save/edit/clear, customer/other-caterer/staff/admin/anonymous denial, direct private-table denial, unchanged public booking reads, stale-write rollback and real overlapping note saves were verified.
- All **7/7** new offline internal-note tests passed. The combined offline run passed **50/51**. The existing package management source-contract test expects `Unpublish` and `Restore as unpublished` labels that are absent from the current unrelated package screen; that screen and assertion were left untouched.
- Focused TypeScript passed for the caterer booking screen, new component/helper and their imports. Device interaction and installed PostgREST RPC discovery still require manual testing after approved installation.
