-- CaterConnect Phase 2 dependency patch -- LOCAL PROPOSAL ONLY. NOT EXECUTED.
-- No monthly migration, Phase 1 trigger, payment function or RLS is replaced.
-- NOT deployment-ready: resolve the explicit dependency gate below first.
-- Column ACLs are the subscription boundary; no postgres/auth.uid/metadata-based
-- subscription trigger bypass is introduced. Existing RPC owners/ACLs stay intact.
BEGIN;
DO $$ BEGIN
  RAISE EXCEPTION 'PROPOSAL ONLY: subscription security/retention requires explicit execution approval';
END $$;
DO $$ BEGIN
  RAISE EXCEPTION 'DEPENDENCY BLOCK: verify trusted RPC owners/bodies, protected INSERT defaults, client reset/staff approval compatibility and account-deletion retention before execution';
END $$;

-- Drain writers first; approve bounded maintenance timeouts separately.
LOCK TABLE public.caterers, public.bookings IN ACCESS EXCLUSIVE MODE;
CREATE SCHEMA cc_subscription_retention1_private;
REVOKE ALL ON SCHEMA cc_subscription_retention1_private FROM PUBLIC,anon,authenticated;
CREATE TABLE cc_subscription_retention1_private.original_acl (
  attnum smallint PRIMARY KEY, column_name name, acl aclitem[], table_owner oid NOT NULL
);
CREATE TABLE cc_subscription_retention1_private.client_access (
  role_name name NOT NULL, column_name name NOT NULL,
  can_insert boolean NOT NULL, can_update boolean NOT NULL,
  PRIMARY KEY(role_name,column_name)
);
CREATE TABLE cc_subscription_retention1_private.trusted_functions (
  function_oid oid PRIMARY KEY, signature text NOT NULL,
  definition text NOT NULL, owner_id oid NOT NULL, acl aclitem[], config text[]
);
REVOKE ALL ON ALL TABLES IN SCHEMA cc_subscription_retention1_private FROM PUBLIC,anon,authenticated;

DO $preflight$
DECLARE field_name text; function_name text;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Reviewed postgres maintenance role required'; END IF;
  -- Refuse inheritance/partitions pending explicit coverage of direct child writes.
  IF EXISTS(SELECT 1 FROM pg_class WHERE oid IN ('public.caterers'::regclass,'public.bookings'::regclass)
      AND (relkind <> 'r' OR relispartition))
    OR EXISTS(SELECT 1 FROM pg_inherits WHERE inhparent IN ('public.caterers'::regclass,'public.bookings'::regclass)) THEN
    RAISE EXCEPTION 'Review inherited/partitioned table protection before installing';
  END IF;
  FOREACH field_name IN ARRAY ARRAY['id','user_id','subscription_plan','subscription_expires_at',
      'monthly_booking_count','booking_count_reset_at'] LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.caterers'::regclass
      AND attname=field_name AND attnum>0 AND NOT attisdropped) THEN
      RAISE EXCEPTION 'Required caterer field missing: %',field_name;
    END IF;
  END LOOP;
  -- Signatures were not supplied. Refuse ambiguous overloads; never guess them.
  FOREACH function_name IN ARRAY ARRAY['activate_paid_subscription','staff_correct_subscription_plan'] LOOP
    IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname=function_name AND p.prokind='f')<>1
      OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='public' AND p.proname=function_name AND p.prokind='f' AND NOT p.prosecdef) THEN
      RAISE EXCEPTION 'Expected one reviewed definer function: %',function_name;
    END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='activate_paid_subscription' AND p.prokind='f'
      AND (has_function_privilege('authenticated',p.oid,'EXECUTE')
        OR has_function_privilege('anon',p.oid,'EXECUTE'))) THEN
    RAISE EXCEPTION 'Activation is exposed to public API roles';
  END IF;
  INSERT INTO cc_subscription_retention1_private.original_acl
    SELECT 0::smallint,NULL,relacl,relowner FROM pg_class WHERE oid='public.caterers'::regclass;
  INSERT INTO cc_subscription_retention1_private.original_acl
    SELECT a.attnum,a.attname,a.attacl,c.relowner FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
    WHERE a.attrelid='public.caterers'::regclass AND a.attnum>0 AND NOT a.attisdropped;
  INSERT INTO cc_subscription_retention1_private.client_access
    SELECT r.rolname,a.attname,
      has_column_privilege(r.oid,a.attrelid,a.attnum,'INSERT'),
      has_column_privilege(r.oid,a.attrelid,a.attnum,'UPDATE')
    FROM pg_roles r CROSS JOIN pg_attribute a WHERE r.rolname IN ('anon','authenticated')
      AND a.attrelid='public.caterers'::regclass AND a.attnum>0 AND NOT a.attisdropped;
  INSERT INTO cc_subscription_retention1_private.trusted_functions
    SELECT p.oid,p.oid::regprocedure::text,pg_get_functiondef(p.oid),p.proowner,p.proacl,p.proconfig
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN ('activate_paid_subscription','staff_correct_subscription_plan')
      AND p.prokind='f';
END;
$preflight$;

-- Column REVOKE alone cannot override table-wide privileges. Remove the broad
-- grants, then preserve each API role's previously effective safe-column access.
-- INSERT is included: otherwise an owner ALL policy can allow a new Premium row.
-- Protected INSERT fields must have reviewed safe bootstrap defaults or be set
-- by the reviewed signup definer. Do not infer defaults from column names.
REVOKE INSERT,UPDATE ON public.caterers FROM PUBLIC,anon,authenticated RESTRICT;
DO $columns$
DECLARE column_record record; access_record record;
BEGIN
  FOR column_record IN SELECT attname FROM pg_attribute WHERE attrelid='public.caterers'::regclass
      AND attnum>0 AND NOT attisdropped LOOP
    EXECUTE format('REVOKE INSERT (%I), UPDATE (%I) ON public.caterers FROM PUBLIC,anon,authenticated RESTRICT',
      column_record.attname,column_record.attname);
  END LOOP;
  FOR access_record IN SELECT * FROM cc_subscription_retention1_private.client_access LOOP
    IF access_record.can_insert AND access_record.column_name NOT IN
      ('subscription_plan','subscription_expires_at','monthly_booking_count','booking_count_reset_at') THEN
      EXECUTE format('GRANT INSERT (%I) ON public.caterers TO %I',access_record.column_name,access_record.role_name);
    END IF;
    IF access_record.can_update AND access_record.column_name NOT IN
      ('id','user_id','subscription_plan','subscription_expires_at','monthly_booking_count','booking_count_reset_at') THEN
      EXECUTE format('GRANT UPDATE (%I) ON public.caterers TO %I',access_record.column_name,access_record.role_name);
    END IF;
  END LOOP;
  -- Inherited grants may defeat direct revocation: refuse instead of silently
  -- changing unrelated roles/memberships. Also inspect SET ROLE memberships.
  IF EXISTS(SELECT 1 FROM cc_subscription_retention1_private.client_access a
    WHERE (a.column_name IN ('id','user_id','subscription_plan','subscription_expires_at',
        'monthly_booking_count','booking_count_reset_at')
      AND has_column_privilege(a.role_name::text,'public.caterers',a.column_name::text,'UPDATE'))
    OR (a.column_name IN ('subscription_plan','subscription_expires_at','monthly_booking_count','booking_count_reset_at')
      AND has_column_privilege(a.role_name::text,'public.caterers',a.column_name::text,'INSERT'))) THEN
    RAISE EXCEPTION 'Inherited/owner privileges still expose protected fields';
  END IF;
  -- Definer mode is not a universal bypass. Require original function owners
  -- to retain column UPDATE rights; review their existing RLS/trigger behavior.
  IF EXISTS(SELECT 1 FROM cc_subscription_retention1_private.trusted_functions f
    CROSS JOIN (VALUES ('subscription_plan'),('subscription_expires_at'),
      ('monthly_booking_count'),('booking_count_reset_at')) fields(field_name)
    WHERE NOT has_column_privilege(f.owner_id,'public.caterers',fields.field_name,'UPDATE')) THEN
    RAISE EXCEPTION 'Trusted subscription function owner lost required UPDATE privileges';
  END IF;
END;
$columns$;

CREATE FUNCTION public.cc_subscription_retention1_guard_delete() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  -- No JWT/current_user exemption, including service_role/definer/cascade calls.
  IF OLD.status::text IN ('awaiting_payment','confirmed','paid','ongoing','completed') THEN
    RAISE EXCEPTION 'Accepted booking records cannot be physically deleted. Use the existing cancellation workflow when eligible.'
      USING ERRCODE='23514';
  END IF;
  RETURN OLD;
END;
$$;
CREATE FUNCTION public.cc_subscription_retention1_guard_truncate() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  -- TRUNCATE does not fire row DELETE triggers. Never erase booking history.
  RAISE EXCEPTION 'Booking history cannot be truncated' USING ERRCODE='23514';
END;
$$;
ALTER FUNCTION public.cc_subscription_retention1_guard_delete() OWNER TO postgres;
ALTER FUNCTION public.cc_subscription_retention1_guard_truncate() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.cc_subscription_retention1_guard_delete(),
  public.cc_subscription_retention1_guard_truncate() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER cc_subscription_retention1_guard_delete BEFORE DELETE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.cc_subscription_retention1_guard_delete();
CREATE TRIGGER cc_subscription_retention1_guard_truncate BEFORE TRUNCATE ON public.bookings
  FOR EACH STATEMENT EXECUTE FUNCTION public.cc_subscription_retention1_guard_truncate();
-- ALWAYS also fires in replica mode; table owners/superusers can still disable
-- or remove guards using trusted DDL. This is not a defense against DB operators.
ALTER TABLE public.bookings ENABLE ALWAYS TRIGGER cc_subscription_retention1_guard_delete;
ALTER TABLE public.bookings ENABLE ALWAYS TRIGGER cc_subscription_retention1_guard_truncate;
COMMIT;

/* REQUIRED DEPENDENCIES -- do not remove either stop based only on this file
1. Supply exact signatures/bodies/owners/config/ACLs of the two trusted RPCs,
   their nested writers, and the deployed activation/webhook path. Confirm caller
   authorization/payment validation, safe search_path, and no publicly reachable
   generic definer writer. SECURITY DEFINER alone proves none of these properties.
   Service-role direct webhook writes retain existing privileges here; its token
   and payment validation must be verified independently. No service-role key in app.
2. Local AuthContext.tsx:63-94 writes plan/expiry and counter/reset values. These
   writes will be DENIED, including legitimate expiry/reset attempts. Before
   deployment, replace that responsibility with reviewed trusted server handling
   or explicitly coordinate the monthly projection/expiry design. No client edit
   or monthly migration is included here. Do not permit arbitrary owner resets.
3. Staff CatererVerification.tsx:96-104 approval payload explicitly sets plan=free.
   Column ACL denies this even when unchanged. A reviewed trusted approval path
   or removal of that redundant field, after verifying bootstrap defaults, is
   REQUIRED. staff_correct_subscription_plan stays callable under its original
   ACL/authorization; this patch does not trust client profiles/metadata itself.
   Its role check still depends on deployed profiles.role protection: confirm
   callers cannot self-promote to staff/admin before relying on that RPC.
4. Review bootstrap INSERT defaults, handle_new_user/registration writers and
   effective/inherited grants/schema CREATE/membership. Direct protected INSERT
   fields are denied; safe ordinary profile edits and max_bookings_per_day grants
   are retained, still subject to existing RLS/Phase 1 ownership guards.
5. Retention follows CURRENT status exactly. Pending/rejected/cancelled DELETE
   retains existing permissions. A previously cancelled counted booking already
   released quota under the monthly design; this adds no episode ledger.
   Cascades containing committed bookings now fail atomically, including account
   deletion and privileged cleanup. Inventory actual FK actions/cleanup RPCs and
   approve a history-preserving account workflow before enabling this patch.
   No auth-null/parent-absent bypass; no FK rewrite or automatic cancellation.
6. Inspect existing DELETE/TRUNCATE/UPDATE triggers, rules and status permissions.
   No grant here authorizes a state transition or weakens refunds/payments. A
   privileged writer that first changes status is a separate authorization
   boundary. Transactional side effects roll back on rejected DELETE; external
   side effects require separate validation. RLS policies remain unchanged.

FOCUSED TESTS (not run)
- Owner/anon protected UPDATE, mixed-field UPDATE and protected INSERT/upsert
  fail; safe profile edits, signup and daily capacity/block operations work.
- Trusted payment activation and staff correction succeed with correct owner
  privileges; forged/unpaid/unauthorized calls fail. Existing monthly INSERT
  counter still increments; trusted resets unchanged; no duplicate payments.
- DELETE each five protected statuses fails under client, service_role and
  existing definer cleanup; mixed DELETE rolls back all rows. Test customer and
  caterer account cascades. Permitted cancellation/refund/status UPDATE works.
- TRUNCATE including cascading/replica contexts fails; no records are changed.
- Rehearse rollback only in an isolated disposable copy before deployment.

ROLLBACK / MITIGATION (no automatic reverse or unsafe broad GRANT)
Snapshot post-install ACLs and compare for drift. Restore original table/column
ACLs from original_acl via reviewed GRANT/REVOKE (never write system catalogs),
preserving grantors/grant options and subsequent authorized changes. Replaying
old broad grants reopens the security exposure and requires explicit approval.
For retention removal, DROP the two triggers before DROP FUNCTION ... RESTRICT;
never CASCADE and never delete records to make restoration pass. Drop private
snapshot tables/schema only after restoration is verified. Keep trusted RPCs,
Phase 1 objects and monthly proposals unchanged. No recovery guarantee is made.
*/
