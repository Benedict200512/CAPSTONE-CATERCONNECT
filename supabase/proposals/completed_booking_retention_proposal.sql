-- Completed booking retention -- LOCAL PROPOSAL ONLY. NOT EXECUTED.
-- Install after phase2_security_dependencies_EXECUTE.sql, before monthly quota.
-- Preserve all FKs, grants, RLS, existing triggers and non-completed cleanup.
BEGIN;
DO $$ BEGIN
  RAISE EXCEPTION 'PROPOSAL ONLY: completed booking retention requires separate execution approval';
END $$;
-- Same parent-first maintenance order as daily availability and monthly quota.
LOCK TABLE public.caterers, public.bookings IN ACCESS EXCLUSIVE MODE;
CREATE SCHEMA cc_completed_retention1_private;
REVOKE ALL ON SCHEMA cc_completed_retention1_private FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE cc_completed_retention1_private.backup (
  singleton boolean PRIMARY KEY CHECK(singleton),
  original_catalog jsonb NOT NULL, installed_functions jsonb
);
REVOKE ALL ON ALL TABLES IN SCHEMA cc_completed_retention1_private FROM PUBLIC,anon,authenticated,service_role;

DO $preflight$
BEGIN
  IF current_user<>'postgres' OR NOT EXISTS(SELECT 1 FROM pg_roles
    WHERE rolname=current_user AND (rolsuper OR rolbypassrls)) THEN
    RAISE EXCEPTION 'Verified postgres RLS-bypass maintenance role required';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_class WHERE oid='public.bookings'::regclass
      AND (relkind<>'r' OR relispartition OR relowner<>'postgres'::regrole))
    OR EXISTS(SELECT 1 FROM pg_inherits WHERE inhparent='public.bookings'::regclass
      OR inhrelid='public.bookings'::regclass) THEN
    RAISE EXCEPTION 'Review inherited/partitioned booking retention before installation';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.bookings'::regclass
    AND attname='status' AND attnum>0 AND NOT attisdropped) THEN
    RAISE EXCEPTION 'Booking status column missing';
  END IF;
END;
$preflight$;

DO $dependencies$
DECLARE guard record;
BEGIN
  IF current_user<>'postgres' OR NOT EXISTS(SELECT 1 FROM pg_roles
    WHERE rolname=current_user AND (rolsuper OR rolbypassrls)) THEN
    RAISE EXCEPTION 'Verified postgres RLS-bypass maintenance role required';
  END IF;
  IF to_regclass('cc_phase2_dependency1_private.trusted_functions') IS NULL THEN
    RAISE EXCEPTION 'Install the reviewed Phase 2 security dependency patch first';
  END IF;
  -- The supplied live review confirms both writers preserve valid plan/expiry
  -- semantics and do not rely on a zero counter after their UPDATE completes.
  -- Refuse later drift from the dependency installation's captured definitions.
  IF NOT EXISTS(SELECT 1 FROM cc_phase2_dependency1_private.trusted_functions
      WHERE definition LIKE '%activate_paid_subscription%')
    OR NOT EXISTS(SELECT 1 FROM cc_phase2_dependency1_private.trusted_functions
      WHERE definition LIKE '%staff_correct_subscription_plan%')
    OR EXISTS(SELECT 1 FROM cc_phase2_dependency1_private.trusted_functions s
      LEFT JOIN pg_proc p ON p.oid=s.function_oid
      WHERE p.oid IS NULL OR pg_get_functiondef(p.oid) IS DISTINCT FROM s.definition
        OR p.proowner IS DISTINCT FROM s.owner_id OR p.proacl IS DISTINCT FROM s.acl
        OR p.proconfig IS DISTINCT FROM s.config)
    OR (SELECT count(*) FROM cc_phase2_dependency1_private.trusted_functions)<>
      (SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND prokind='f'
        AND proname IN ('activate_paid_subscription','staff_correct_subscription_plan')) THEN
    RAISE EXCEPTION 'Trusted subscription writers missing or changed since reviewed dependency installation';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_roles r WHERE r.rolname IN ('anon','authenticated')
    AND (has_column_privilege(r.oid,'public.caterers','subscription_plan','INSERT')
      OR has_column_privilege(r.oid,'public.caterers','subscription_expires_at','INSERT')
      OR has_column_privilege(r.oid,'public.caterers','subscription_plan','UPDATE')
      OR has_column_privilege(r.oid,'public.caterers','subscription_expires_at','UPDATE')
      OR has_column_privilege(r.oid,'public.profiles','role','INSERT')
      OR has_column_privilege(r.oid,'public.profiles','role','UPDATE')
      OR has_table_privilege(r.oid,'public.bookings','DELETE')
      OR has_table_privilege(r.oid,'public.bookings','TRUNCATE'))) THEN
    RAISE EXCEPTION 'Required role/subscription/booking client protections are absent';
  END IF;
  -- Compare complete normalized trigger bodies, not just installed names.
  FOR guard IN SELECT * FROM (VALUES
    ('cc_phase2_dependency1_guard_status',17,false,'O','64f1e412e7487efe81861486ba243329')
  ) expected(name,event_bits,definer,enabled,body_hash) LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
      WHERE t.tgrelid='public.bookings'::regclass AND t.tgname=guard.name
        AND p.oid=to_regprocedure('public.'||guard.name||'()')
        AND t.tgtype=guard.event_bits AND t.tgenabled::text=guard.enabled
        AND NOT t.tgisinternal AND t.tgconstraint=0 AND t.tgqual IS NULL
        AND t.tgnargs=0 AND t.tgattr::text='' AND t.tgoldtable IS NULL AND t.tgnewtable IS NULL
        AND p.prokind='f' AND p.pronargs=0 AND p.prorettype='trigger'::regtype
        AND p.prolang=(SELECT oid FROM pg_language WHERE lanname='plpgsql')
        AND p.prosecdef=guard.definer AND p.provolatile='v'
        AND pg_get_userbyid(p.proowner)='postgres' AND p.proconfig=ARRAY['search_path=""']
        AND md5(replace(p.prosrc,chr(13)||chr(10),chr(10)))=guard.body_hash)
      OR has_function_privilege('anon',to_regprocedure('public.'||guard.name||'()'),'EXECUTE')
      OR has_function_privilege('authenticated',to_regprocedure('public.'||guard.name||'()'),'EXECUTE') THEN
      RAISE EXCEPTION 'Required booking protection missing or changed: %',guard.name;
    END IF;
  END LOOP;
END;
$dependencies$;

INSERT INTO cc_completed_retention1_private.backup(singleton,original_catalog)
SELECT true,jsonb_build_object(
  'table',jsonb_build_object('owner',c.relowner,'acl',c.relacl,
    'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity),
  'columns',(SELECT jsonb_object_agg(a.attname,to_jsonb(a.attacl)) FROM pg_attribute a
    WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
  'policies',(SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY policyname),'[]'::jsonb)
    FROM pg_policies p WHERE schemaname='public' AND tablename='bookings'),
  'foreign_keys',(SELECT coalesce(jsonb_object_agg(k.oid::text,pg_get_constraintdef(k.oid,true)),'{}'::jsonb)
    FROM pg_constraint k WHERE k.contype='f' AND (k.conrelid=c.oid OR k.confrelid=c.oid)),
  'triggers',(SELECT coalesce(jsonb_object_agg(t.tgname,jsonb_build_object(
    'definition',pg_get_triggerdef(t.oid,true),'enabled',t.tgenabled)),'{}'::jsonb)
    FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal)
) FROM pg_class c WHERE c.oid='public.bookings'::regclass;

CREATE FUNCTION public.cc_completed_retention1_guard_delete() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF OLD.status::text='completed' THEN
    RAISE EXCEPTION 'Completed booking history cannot be deleted, including by account cascades' USING ERRCODE='23514';
  END IF;
  RETURN OLD;
END;
$$;

CREATE FUNCTION public.cc_completed_retention1_guard_truncate() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  -- TRUNCATE holds ACCESS EXCLUSIVE already. Definer visibility avoids RLS hiding
  -- completed rows, including during TRUNCATE of a parent with CASCADE.
  IF EXISTS(SELECT 1 FROM public.bookings WHERE status::text='completed') THEN
    RAISE EXCEPTION 'TRUNCATE would erase completed booking history' USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END;
$$;
ALTER FUNCTION public.cc_completed_retention1_guard_delete() OWNER TO postgres;
ALTER FUNCTION public.cc_completed_retention1_guard_truncate() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.cc_completed_retention1_guard_delete(),
  public.cc_completed_retention1_guard_truncate() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER cc_completed_retention1_guard_delete BEFORE DELETE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.cc_completed_retention1_guard_delete();
CREATE TRIGGER cc_completed_retention1_guard_truncate BEFORE TRUNCATE ON public.bookings
  FOR EACH STATEMENT EXECUTE FUNCTION public.cc_completed_retention1_guard_truncate();
ALTER TABLE public.bookings ENABLE ALWAYS TRIGGER cc_completed_retention1_guard_delete;
ALTER TABLE public.bookings ENABLE ALWAYS TRIGGER cc_completed_retention1_guard_truncate;

DO $dependencies$
DECLARE guard record;
BEGIN
  IF current_user<>'postgres' OR NOT EXISTS(SELECT 1 FROM pg_roles
    WHERE rolname=current_user AND (rolsuper OR rolbypassrls)) THEN
    RAISE EXCEPTION 'Verified postgres RLS-bypass maintenance role required';
  END IF;
  IF to_regclass('cc_phase2_dependency1_private.trusted_functions') IS NULL THEN
    RAISE EXCEPTION 'Install the reviewed Phase 2 security dependency patch first';
  END IF;
  -- The supplied live review confirms both writers preserve valid plan/expiry
  -- semantics and do not rely on a zero counter after their UPDATE completes.
  -- Refuse later drift from the dependency installation's captured definitions.
  IF NOT EXISTS(SELECT 1 FROM cc_phase2_dependency1_private.trusted_functions
      WHERE definition LIKE '%activate_paid_subscription%')
    OR NOT EXISTS(SELECT 1 FROM cc_phase2_dependency1_private.trusted_functions
      WHERE definition LIKE '%staff_correct_subscription_plan%')
    OR EXISTS(SELECT 1 FROM cc_phase2_dependency1_private.trusted_functions s
      LEFT JOIN pg_proc p ON p.oid=s.function_oid
      WHERE p.oid IS NULL OR pg_get_functiondef(p.oid) IS DISTINCT FROM s.definition
        OR p.proowner IS DISTINCT FROM s.owner_id OR p.proacl IS DISTINCT FROM s.acl
        OR p.proconfig IS DISTINCT FROM s.config)
    OR (SELECT count(*) FROM cc_phase2_dependency1_private.trusted_functions)<>
      (SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND prokind='f'
        AND proname IN ('activate_paid_subscription','staff_correct_subscription_plan')) THEN
    RAISE EXCEPTION 'Trusted subscription writers missing or changed since reviewed dependency installation';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_roles r WHERE r.rolname IN ('anon','authenticated')
    AND (has_column_privilege(r.oid,'public.caterers','subscription_plan','INSERT')
      OR has_column_privilege(r.oid,'public.caterers','subscription_expires_at','INSERT')
      OR has_column_privilege(r.oid,'public.caterers','subscription_plan','UPDATE')
      OR has_column_privilege(r.oid,'public.caterers','subscription_expires_at','UPDATE')
      OR has_column_privilege(r.oid,'public.profiles','role','INSERT')
      OR has_column_privilege(r.oid,'public.profiles','role','UPDATE')
      OR has_table_privilege(r.oid,'public.bookings','DELETE')
      OR has_table_privilege(r.oid,'public.bookings','TRUNCATE'))) THEN
    RAISE EXCEPTION 'Required role/subscription/booking client protections are absent';
  END IF;
  -- Compare complete normalized trigger bodies, not just installed names.
  FOR guard IN SELECT * FROM (VALUES
    ('cc_phase2_dependency1_guard_status',17,false,'O','64f1e412e7487efe81861486ba243329'),
    ('cc_completed_retention1_guard_delete',11,true,'A','48945a476164b731b2d31787c59bcb19'),
    ('cc_completed_retention1_guard_truncate',34,true,'A','111ed98f323b6df37b5c7eab8cf92079')
  ) expected(name,event_bits,definer,enabled,body_hash) LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
      WHERE t.tgrelid='public.bookings'::regclass AND t.tgname=guard.name
        AND p.oid=to_regprocedure('public.'||guard.name||'()')
        AND t.tgtype=guard.event_bits AND t.tgenabled::text=guard.enabled
        AND NOT t.tgisinternal AND t.tgconstraint=0 AND t.tgqual IS NULL
        AND t.tgnargs=0 AND t.tgattr::text='' AND t.tgoldtable IS NULL AND t.tgnewtable IS NULL
        AND p.prokind='f' AND p.pronargs=0 AND p.prorettype='trigger'::regtype
        AND p.prolang=(SELECT oid FROM pg_language WHERE lanname='plpgsql')
        AND p.prosecdef=guard.definer AND p.provolatile='v'
        AND pg_get_userbyid(p.proowner)='postgres' AND p.proconfig=ARRAY['search_path=""']
        AND md5(replace(p.prosrc,chr(13)||chr(10),chr(10)))=guard.body_hash)
      OR has_function_privilege('anon',to_regprocedure('public.'||guard.name||'()'),'EXECUTE')
      OR has_function_privilege('authenticated',to_regprocedure('public.'||guard.name||'()'),'EXECUTE') THEN
      RAISE EXCEPTION 'Required booking protection missing or changed: %',guard.name;
    END IF;
  END LOOP;
END;
$dependencies$;

DO $preservation$
DECLARE installed_catalog jsonb;
BEGIN
  SELECT jsonb_build_object(
  'table',jsonb_build_object('owner',c.relowner,'acl',c.relacl,
    'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity),
  'columns',(SELECT jsonb_object_agg(a.attname,to_jsonb(a.attacl)) FROM pg_attribute a
    WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
  'policies',(SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY policyname),'[]'::jsonb)
    FROM pg_policies p WHERE schemaname='public' AND tablename='bookings'),
  'foreign_keys',(SELECT coalesce(jsonb_object_agg(k.oid::text,pg_get_constraintdef(k.oid,true)),'{}'::jsonb)
    FROM pg_constraint k WHERE k.contype='f' AND (k.conrelid=c.oid OR k.confrelid=c.oid)),
  'triggers',(SELECT coalesce(jsonb_object_agg(t.tgname,jsonb_build_object(
    'definition',pg_get_triggerdef(t.oid,true),'enabled',t.tgenabled)),'{}'::jsonb)
    FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal AND t.tgname NOT IN ('cc_completed_retention1_guard_delete','cc_completed_retention1_guard_truncate'))
)
    INTO installed_catalog FROM pg_class c WHERE c.oid='public.bookings'::regclass;
  IF installed_catalog IS DISTINCT FROM
    (SELECT original_catalog FROM cc_completed_retention1_private.backup WHERE singleton) THEN
    RAISE EXCEPTION 'Existing booking FK, ACL, RLS or trigger state changed';
  END IF;
END;
$preservation$;
UPDATE cc_completed_retention1_private.backup SET installed_functions=(
  SELECT jsonb_object_agg(p.oid::text,pg_get_functiondef(p.oid)) FROM pg_proc p
  WHERE p.oid IN ('public.cc_completed_retention1_guard_delete()'::regprocedure,
    'public.cc_completed_retention1_guard_truncate()'::regprocedure)) WHERE singleton;
COMMIT;

/* INSTALLATION / VERIFICATION / MITIGATION -- NOT EXECUTED
- Keep this proposal guarded. Separate execution approval is required before
  preparing its execution copy removing only the PROPOSAL ONLY block.
- Install the Phase 2 security dependency patch first. Existing completed-status
  protection is required so a writer cannot change status before deletion.
- DELETE of completed rows fails for service-role, definer cleanup and cascades.
  A mixed-row DELETE rolls back all its database effects. Account deletion with
  completed history fails atomically; account deletion with no completed history
  retains existing authorization/constraints. External Auth side effects require
  separate hosted verification. No FK rewrite or anonymous tombstone is invented.
- TRUNCATE is independently refused if any completed row exists, including when
  reached through parent TRUNCATE CASCADE. Empty/non-completed-only truncation
  retains existing privileges and constraints; ordinary roles stay denied.
- Test these cases in a separately approved disposable database before live use;
  offline tests cannot prove PostgreSQL trigger/cascade behavior.
- Ordinary UPDATE reassignment/month rewrite is blocked by the monthly trigger
  once installed. Same-status payment/refund edits and cancellation of eligible
  non-completed bookings are unchanged. No payment/subscription function changes.
- ENABLE ALWAYS covers replication-role execution, not hostile table-owner DDL.
  Privileged operators must not disable/drop guards or rewrite protected history.
- Rollback requires separate approval and drift comparison against snapshots.
  Removing retention reopens history loss: prefer a forward fix. If approved,
  drop only the two named triggers, then their functions RESTRICT; never CASCADE,
  delete bookings, rewrite FKs or restore ordinary DELETE/TRUNCATE permissions.
*/
