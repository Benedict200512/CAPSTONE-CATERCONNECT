-- CaterConnect Security Migration 1 -- STAGING ONLY, PROPOSED, NOT EXECUTED.
-- Run only on an isolated staging copy after reviewing the definer inventory.
-- This script cannot determine whether a Supabase project is production.
-- No application/consent changes; monitoring/suspension functions unchanged.
-- DELETE grants/RLS unchanged: no DELETE/ALL policies means default deny.
-- Contains executable SQL; do not add to an automatic migrations directory.
-- Matching reverse script: security_migration_1_profile_protection_rollback.sql
--
-- Signup patch preserves the installed function verbatim except two verified
-- role expressions. It captures the actual original for exact rollback rather
-- than reconstructing unknown field mappings from the consent proposal.
-- The conflict assignment becomes a no-op (profiles.role = existing role),
-- protecting ALL existing account roles, including staff/admin.
-- A mismatch aborts the transaction; never loosen assertions blindly.
--
-- BEFORE STAGING EXECUTION: inspect every exposed SECURITY DEFINER function,
-- including non-public schemas exposed through PostgREST, nested function calls,
-- owners/ACLs/search_path and all profile writers. postgres-owned functions are
-- not automatically safe. The guard's current_user bypass trusts their writes;
-- untrusted callers must be authorized by each such function. This audit has
-- NOT been completed: definitions/catalog results were not supplied locally.
--
-- Read-only inventory (run separately; these statements are comments):
-- SELECT p.oid::regprocedure, n.nspname, pg_get_userbyid(p.proowner),
--   p.prosecdef, p.proacl, p.proconfig, pg_get_functiondef(p.oid),
--   has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
--   has_function_privilege('authenticated',p.oid,'EXECUTE') AS user_execute
-- FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
-- WHERE p.prokind='f' AND p.prosecdef
--   AND n.nspname NOT IN ('pg_catalog','information_schema') ORDER BY 1;
-- SELECT * FROM pg_policies WHERE schemaname='public' AND tablename='profiles';
-- SELECT pg_get_functiondef('public.staff_account_monitoring_action(uuid,text,text)'::regprocedure);
-- SELECT pg_get_functiondef('public.account_monitoring_protect_suspension()'::regprocedure);
-- SELECT t.tgname,t.tgenabled,pg_get_triggerdef(t.oid,true),
--   p.oid::regprocedure,p.prosecdef,p.proconfig,p.proacl,pg_get_functiondef(p.oid)
-- FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
-- WHERE t.tgrelid='public.profiles'::regclass AND NOT t.tgisinternal;
-- SELECT relrowsecurity,relforcerowsecurity,relowner::regrole,relacl
-- FROM pg_class WHERE oid='public.profiles'::regclass;
-- SELECT attname,attacl FROM pg_attribute
-- WHERE attrelid='public.profiles'::regclass AND attnum>0 AND NOT attisdropped;
-- SELECT rolname,rolsuper,rolbypassrls,rolinherit FROM pg_roles
-- WHERE rolname IN ('postgres','anon','authenticated','service_role');
-- SELECT roleid::regrole,member::regrole,admin_option FROM pg_auth_members;
-- SELECT pg_get_functiondef('public.handle_new_user()'::regprocedure);
-- Also inventory invoker RPCs calling definer helpers, exposed views/rules and
-- role memberships. EXECUTE grants are exposure evidence, not authorization.

BEGIN;
DO $$ BEGIN
  RAISE EXCEPTION 'PROPOSAL ONLY: Security Migration 1 requires explicit approval and completed dependency review';
END $$;
-- Blocking maintenance lock; drain writers and approve lock timeouts first.
LOCK TABLE public.profiles IN ACCESS EXCLUSIVE MODE;
-- Private-to-postgres snapshot: CREATE fails on rerun/collision intentionally.
-- Stores function DDL only, no user rows. No RLS policy or API grant is added.
CREATE TABLE public.cc_security1_function_backup (
  singleton boolean PRIMARY KEY CHECK (singleton),
  definition text NOT NULL,
  monitoring_definition text NOT NULL,
  suspension_definition text NOT NULL,
  hardened_definition text
);
ALTER TABLE public.cc_security1_function_backup OWNER TO postgres;
REVOKE ALL ON public.cc_security1_function_backup FROM PUBLIC, anon, authenticated;
ALTER TABLE public.cc_security1_function_backup ENABLE ROW LEVEL SECURITY;

DO $patch$
DECLARE
  original_definition text;
  revised_definition text;
  matches integer;
  role_pattern constant text := $re$COALESCE\(\s*NEW\.raw_user_meta_data\s*->>\s*'role'\s*,\s*'customer'\s*\)$re$;
  conflict_pattern constant text := $re$\mrole\s*=\s*EXCLUDED\.role\M$re$;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Staging installation requires reviewed postgres maintenance context';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.oid='public.handle_new_user()'::regprocedure
      AND p.prosecdef AND pg_get_userbyid(p.proowner)='postgres'
      AND p.prorettype='pg_catalog.trigger'::regtype
  ) THEN RAISE EXCEPTION 'Unexpected signup function properties'; END IF;

  original_definition := pg_get_functiondef('public.handle_new_user()'::regprocedure);
  SELECT count(*) INTO matches FROM regexp_matches(original_definition,role_pattern,'gi');
  IF matches <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one verified signup COALESCE role expression, got %',matches;
  END IF;
  SELECT count(*) INTO matches FROM regexp_matches(original_definition,conflict_pattern,'gi');
  IF matches <> 1 OR original_definition !~* 'ON\s+CONFLICT\s*\(\s*id\s*\)\s+DO\s+UPDATE' THEN
    RAISE EXCEPTION 'Unexpected profile conflict role assignment; inspect original definition';
  END IF;
  -- RHS target qualification requires the unaliased profiles insert confirmed
  -- below. If live SQL uses a target alias, abort and prepare an exact body patch.
  IF original_definition !~* 'INSERT\s+INTO\s+(public\.)?profiles\s*\(' THEN
    RAISE EXCEPTION 'Expected unaliased profiles insert with explicit field list';
  END IF;

  INSERT INTO public.cc_security1_function_backup
    (singleton, definition, monitoring_definition, suspension_definition) VALUES (
    true, original_definition,
    pg_get_functiondef('public.staff_account_monitoring_action(uuid,text,text)'::regprocedure),
    pg_get_functiondef('public.account_monitoring_protect_suspension()'::regprocedure)
  );
  revised_definition := regexp_replace(original_definition,role_pattern,
    $replacement$(CASE WHEN NEW.raw_user_meta_data->>'role' = 'caterer' THEN 'caterer' ELSE 'customer' END)$replacement$,'gi');
  revised_definition := regexp_replace(revised_definition,conflict_pattern,
    'role = profiles.role','gi');
  -- CREATE OR REPLACE from pg_get_functiondef preserves signature/body fields,
  -- volatility/security/config; PostgreSQL retains original owner and ACLs.
  EXECUTE revised_definition;
  UPDATE public.cc_security1_function_backup
    SET hardened_definition = pg_get_functiondef('public.handle_new_user()'::regprocedure)
    WHERE singleton;
  IF pg_get_functiondef('public.staff_account_monitoring_action(uuid,text,text)'::regprocedure)
       IS DISTINCT FROM (SELECT monitoring_definition FROM public.cc_security1_function_backup)
     OR pg_get_functiondef('public.account_monitoring_protect_suspension()'::regprocedure)
       IS DISTINCT FROM (SELECT suspension_definition FROM public.cc_security1_function_backup) THEN
    RAISE EXCEPTION 'Monitoring definitions changed unexpectedly';
  END IF;
END;
$patch$;

CREATE FUNCTION public.cc_security1_is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin' AND p.status = 'active'
  );
$fn$;
ALTER FUNCTION public.cc_security1_is_admin() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.cc_security1_is_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cc_security1_is_admin() TO authenticated;

CREATE FUNCTION public.cc_security1_profile_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $fn$
BEGIN
  -- Identity is immutable even through a definer writer. No current application
  -- workflow needs to re-key profiles; verify Auth/FK maintenance before rollout.
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Profile identity cannot be changed' USING ERRCODE = '42501';
    END IF;
  END IF;
  -- Effective DB role. Preserves confirmed postgres-owned Auth/monitoring calls.
  -- Those functions must independently sanitize input and authorize callers.
  -- Do not make this guard DEFINER and then trust its own owner identity.
  IF current_user = 'postgres' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.id IS DISTINCT FROM auth.uid()
       OR NEW.role IS NULL OR NEW.role NOT IN ('customer','caterer')
       OR NEW.status IS DISTINCT FROM 'active' THEN
      RAISE EXCEPTION 'Unauthorized profile initialization' USING ERRCODE = '42501';
    END IF;
  ELSE
    IF NEW.role IS DISTINCT FROM OLD.role OR NEW.status IS DISTINCT FROM OLD.status THEN
      IF current_user <> 'authenticated' THEN
        RAISE EXCEPTION 'Unauthorized profile security change' USING ERRCODE = '42501';
      END IF;
      IF NOT public.cc_security1_is_admin() THEN
        RAISE EXCEPTION 'Role/status changes require an active admin'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;
ALTER FUNCTION public.cc_security1_profile_guard() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.cc_security1_profile_guard() FROM PUBLIC, anon, authenticated;
-- Existing account_monitoring_protect_profile executes first alphabetically.
-- Keep its stricter suspension checks intact. Ordinary RLS still applies.
CREATE TRIGGER cc_security1_profile_guard
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.cc_security1_profile_guard();

COMMIT;

/* STAGING VALIDATION / REMAINING PRODUCTION CHECKS (not executed)
The signup replacement is generated from the actual live definition. Export
pg_get_functiondef(public.handle_new_user()) after staging and diff against the
snapshot: ONLY the two intended role expressions may differ. Inspect the exact
original first: regex matching is a structural assertion, not a semantic audit.
Confirm no other use of raw metadata role can confer privileges or choose an
unsafe branch. An unmatched/aliased/differently formatted body deliberately fails.

1. Current/legacy customer AND caterer signup: preserve all eight profile fields,
   defaults, business side effects, and behavior without consent/version metadata.
2. Public staff/admin/unknown/null/missing role -> customer, never privileged.
   On isolated conflict fixtures confirm existing staff/admin/customer/caterer
   roles stay unchanged, while other existing conflict-update fields still work.
3. Ordinary role or status changes, including NULL transitions, combined edits,
   own/other row and upsert paths: no unauthorized changes, atomic failures.
4. Normal customer/caterer field/avatar edits and unchanged protected values work.
   Direct public-role INSERT still obeys existing ownership RLS and active status.
5. Active admin direct PlatformSettings role changes and UserManagement status
   changes work under existing RLS; staff cannot manage roles. Existing suspension
   protection can impose stricter denials. NULL-status admin convention unresolved:
   helper requires active; approve compatibility or adjust after actual inspection.
6. Staff monitoring actions preserve server reason checks, actor attribution,
   audit history and events. Ordinary/anon RPC calls cannot gain postgres writes.
7. DELETE as anon/authenticated/app admin affects zero rows or is denied. No
   DELETE/ALL policy introduced; delete/reinsert cannot replace existing profiles.
8. Manual Auth creation plus Table Editor promotion works. Verify actual effective
   Table Editor identity rather than assuming auth.uid() IS NULL means maintenance.
9. Review ALL exposed definer paths. Any unsafe postgres writer can bypass the
   invoker guard. Fix such a path separately before production approval; do not
   treat this bypass as a verified application-wide security boundary.
10. Confirm existing admin RLS, service operations/cascades, default function ACLs,
    role memberships, expected trigger enablement/order, owners and search_path.
    Compare original monitoring/suspension definitions/ACLs before and after.
11. Test concurrent admin demotion/suspension and role management; this migration
    does not add immediate-revocation serialization or last-admin safeguards.
12. Rehearse matching rollback; it restores exact captured signup definition and
    removes only new objects. No user/business/audit rows are deleted. Reversal
    reopens known vulnerabilities, so prefer forward correction when possible.

Production remains UNAPPROVED pending these checks and full definer audit.
PlatformSettings now checks errors and returned row; still verify database state.
No application or consent migration edits are included.

CONFIRMED AUTHORIZATION DEFECT (live metadata, not an executed exploit test):
authenticated has effective role/status UPDATE; own-row policy auth.uid()=id
does not restrict role. Omitted WITH CHECK inherits USING, which still accepts
an unchanged id after role promotion. Permissive admin/staff policies do not
restrict this own-row path. Existing BEFORE UPDATE OF status protection never
fires for a role-only change. No deployed role guard was reported.

SMALLEST COMPATIBLE REMEDIATION / DEPLOYMENT GATES:
- Keep existing RLS/grants initially: browser admins and ordinary users share
  authenticated. The additional guard enforces sensitive-column authorization,
  preserves normal editing, and blocks direct staff role/status changes. Staff
  suspension/reactivation continues through the existing audited definer RPC.
- Active admin direct UPDATE remains subject to existing RLS and suspension
  checks; this proposal cannot make previously denied reactivation succeed.
- Trigger remains INVOKER. current_user inside nested definer writes is the
  effective function owner, not necessarily the original API role. A DEFINER
  guard trusting its own current_user would be insecure. NULL auth.uid alone,
  trigger depth and editable metadata are never authorization proofs.
- The postgres branch is a TRUST BOUNDARY, not proof of authorization. Audit
  every exposed/nested writer before execution: actor from auth.uid, active
  staff/admin checks, target scope, reason validation, permitted actions,
  suspension context, audit writes, owner/search_path and EXECUTE privileges.
  Any unsafe writer is a BLOCKER; prepare a separately reviewed targeted patch
  or revoke only its unneeded EXECUTE. Do not guess the installed RPC body.
- Full handle_new_user body is also a BLOCKER. Regex assertions do not establish
  semantics. Review a generated forward/reverse definition diff on staging;
  preserve all original fields/defaults/side effects; sanitize every metadata
  role-dependent branch. No role overwrite on conflict and no consent change.
- Active-only admin helper intentionally denies NULL/suspended status. Decide
  NULL semantics first, without silently updating existing accounts.
- Verify no DELETE/ALL policies and no alternative profile writer/upsert path;
  default-deny DELETE must remain. Public INSERT still passes the new guard.
- Check postgres helper ownership actually bypasses profile RLS; fixed empty
  search_path plus qualified tables prevents policy recursion. Inspect policy
  helper dependencies/default grants and every BEFORE trigger's final mutations.
- Longer-term least privilege: replace direct admin sensitive updates with
  narrow authorized RPCs, then remove effective direct role/status grants at
  every table/column/inherited source. Do not revoke column grants alone while
  table UPDATE remains, and do not break normal editing by blanket revocation.

ADDITIONAL STAGING TESTS (not run): anon/ordinary user role-only promotion;
combined role/status/id/name updates reject atomically; self/other/bulk/upsert
attempts; direct staff protected changes denied; active admin direct writes;
NULL/suspended admin denied; signup metadata staff/admin/unknown on both current
and legacy clients; unchanged protected values plus normal editing succeed;
manual Dashboard promotion actual role verified; monitoring reason/audit and
unauthorized RPC calls; trusted cascades; all exposed writer bypass attempts;
forward/rollback body and ACL/policy diff; rollback drift refusal. Tests require
real authenticated sessions in isolated staging, not only postgres SQL Editor.

ORDER BEFORE PHASE 4: catalog/body inventory -> resolve unsafe writers/NULL and
Dashboard context -> review exact signup diff and guard -> approved isolated
staging forward/security/compatibility/rollback tests -> separately approved
Security 1 deployment -> verify effective protection -> resume Phase 4 review.
Do not infer historic promoted accounts are legitimate; investigate separately
with authorized audit evidence. This patch does not repair existing role data.
*/
