# Client TRUNCATE hardening — final preparation, 2026-10-20

No live SQL, production permission change, deployment or payment was performed.
The reviewed proposal is unchanged. `pricing_detail_truncate_hardening_EXECUTE.sql`
differs only by removal of its single intentional proposal-stop block. Its
SHA256 is `a0547cf2ffb3c121c379bfa121be3c8fa4dcf593fec45b011e6092147c2eb9a6`.
The pricing proposal/execution migration remains separate and unchanged.

## Exact scope

The only permission mutation is:

```sql
REVOKE TRUNCATE ON public.menu_items,public.booking_customizations FROM PUBLIC,anon,authenticated;
```

No SELECT/INSERT/UPDATE/DELETE grants, policies, RLS flags, triggers, functions,
table rows, prices or role memberships are changed. It removes direct client
and PUBLIC TRUNCATE grants. Postgres remains table owner; service_role's direct
privileges are preserved. Broad PUBLIC grants can also affect other roles that
rely solely on PUBLIC: the reviewed live baseline confirms the four requested
roles' effective privileges, not every external role's grant provenance.

Effective results in disposable PostgreSQL, for **both** tables:

| Role | CRUD before | CRUD after | TRUNCATE before | TRUNCATE after |
|---|---|---|---|---|
| anon | all true | all true | true | false |
| authenticated | all true | all true | true | false |
| postgres | all true | all true | true | true |
| service_role | all true | all true | true | true |

Table privileges do not grant unrestricted row access: existing RLS still
controls ordinary client CRUD. Tests use all six exact supplied policies,
PUBLIC policy roles, NULL WITH CHECK semantics, and the confirmed effective
CRUD/TRUNCATE grants from the operator-supplied catalog.

## Compatibility and inheritance boundaries

- The migration verifies effective client TRUNCATE privileges with
  has_table_privilege, which includes PUBLIC and immediately inherited access.
  If either client retains access, the exception rolls back the entire
  transaction. Tests cover anon/authenticated direct inheritance and a
  multi-level chain; the original grants survive rejection unchanged.
- **Installation condition:** inspect role memberships before approval.
  A membership with INHERIT FALSE but SET TRUE can leave
  has_table_privilege('authenticated',...) false while allowing SET ROLE to a
  TRUNCATE-capable parent. The reviewed verifier does not detect that separate
  escalation path. A disposable test reproduces it; the read-only membership
  audit flags the parent. This is a demonstrated guard limitation, not evidence
  that live Supabase has such a membership. Do not install assuming inheritance
  is clear until the audit is reviewed. If a dangerous membership exists,
  prepare separately reviewed role hardening or an expanded guard; do not
  silently change this approved proposal or its execution copy.
- The membership audit uses MEMBER conservatively for compatibility across
  PostgreSQL versions. A returned candidate is not proof SET ROLE is permitted;
  inspect role membership options and paths before deciding it is safe.
- No SQL TRUNCATE workflow was found in mobile app/lib/screens/Edge Functions
  or web src. The only application text match was a bookmark pagination comment.
  All 32 function-definition occurrences in the four collected catalog exports
  were scanned; none mentions both TRUNCATE and either target table. Existing
  retention TRUNCATE guards reject operations; they do not require client
  TRUNCATE on these tables. The verification SQL includes a narrow live catalog
  search for additional candidate functions, without returning function bodies.
- External jobs, dynamic SQL, uncollected deployed functions, role memberships,
  grant-option delegation and other database users cannot be ruled out from
  these exports. A SECURITY INVOKER cleanup called as anon/authenticated would
  lose TRUNCATE access. Existing postgres/service_role maintenance access is
  preserved. Default REVOKE dependency behavior is retained; dependent grants
  may cause an atomic failure requiring review, never automatic CASCADE.

## Validation

The standalone harness path installs and executes the **actual execution file**
without installing fixed-package pricing:

```text
node supabase/tests/test-package-publication-postgres.cjs --internal-notes --reports --invoice-payment --pricing-math --truncate-hardening
```

Tests compare all four roles' effective privilege matrices before/after and
assert preservation of non-TRUNCATE ACL entries, RLS/ownership flags, all
existing policies, non-internal triggers and public function definitions/ACLs.
Actual client TRUNCATE denial and postgres/service_role TRUNCATE success are
tested in rolled-back transactions. Authorized caterer menu CRUD and customer
customization INSERT/UPDATE/DELETE still work; cross-caterer updates remain
denied. The proposal stop, maintenance-role guard, permission-idempotent rerun,
inheritance rollback, membership-audit limitation and read-only verification
script are covered. No app TypeScript changed in this preparation.

Final result: **101/101 PostgreSQL checks passed** (82 existing regressions and
19 focused hardening checks). PostgreSQL 18.3 disposable cluster
`cc-package-pg-S6se5Z` was stopped. Execution-copy byte comparison passed; the
pricing execution hash remains unchanged. The fixture tests PostgreSQL
authorization, not hosted Auth/PostgREST, external maintenance jobs or Expo Go.

## Operator steps, pending installation approval

1. Run `supabase/metadata/pricing_detail_truncate_hardening_verify.sql` read-only
   **before** installation. Save the eight-row privilege matrix, policy/trigger
   results and review any role-membership/function candidates. It returns no
   customer, booking, menu or payment records. Confirm external maintenance
   does not rely on anon/authenticated TRUNCATE. Resolve suspicious membership
   paths before authorizing installation.
2. After explicit installation approval, install only the separate hardening
   execution file as the verified postgres maintenance role. Do not rerun any
   pricing, availability, quota, publication, notes, reports or payment migration.
3. Rerun the same read-only verification file. Expect the matrix above, both
   effective client TRUNCATE flags false, and unchanged RLS/policy/trigger
   definitions. Review the membership candidates again, even if the direct
   flags are false. Verify normal menu and customization workflows manually.

For mitigation, repair any approved maintenance caller under separate review.
Do not restore broad client TRUNCATE, add CASCADE, alter RLS, or disable triggers
as an automatic rollback.
