-- Phase 2 targeted dependencies -- LOCAL PROPOSAL ONLY. NOT EXECUTED.
-- Does not replace monthly, availability, staff provisioning or payment functions.
BEGIN;
DO $$ BEGIN
  RAISE EXCEPTION 'PROPOSAL ONLY: Phase 2 dependency patch requires separate execution approval';
END $$;
-- Same maintenance order as the existing daily/monthly proposals. Drain writers.
LOCK TABLE public.caterers, public.bookings IN ACCESS EXCLUSIVE MODE;
CREATE SCHEMA cc_phase2_dependency1_private;
REVOKE ALL ON SCHEMA cc_phase2_dependency1_private FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE cc_phase2_dependency1_private.original_catalog (
  relation oid PRIMARY KEY, owner_id oid NOT NULL, acl aclitem[],
  column_acls jsonb NOT NULL, policies jsonb NOT NULL, triggers jsonb NOT NULL
);
CREATE TABLE cc_phase2_dependency1_private.insert_access (
  role_id oid NOT NULL, role_name name NOT NULL, column_name name NOT NULL,
  can_insert boolean NOT NULL, PRIMARY KEY(role_id,column_name)
);
CREATE TABLE cc_phase2_dependency1_private.public_insert_access (
  column_name name PRIMARY KEY, can_insert boolean NOT NULL
);
CREATE TABLE cc_phase2_dependency1_private.booking_access (
  role_id oid PRIMARY KEY, role_name name NOT NULL,
  can_delete boolean NOT NULL, can_truncate boolean NOT NULL
);
CREATE TABLE cc_phase2_dependency1_private.trusted_functions (
  function_oid oid PRIMARY KEY, definition text NOT NULL,
  owner_id oid NOT NULL, acl aclitem[], config text[]
);
REVOKE ALL ON ALL TABLES IN SCHEMA cc_phase2_dependency1_private FROM PUBLIC,anon,authenticated,service_role;

DO $preflight$
DECLARE plan_default text; plan_type text; expiry_default text;
BEGIN
  IF current_user<>'postgres' OR NOT EXISTS(SELECT 1 FROM pg_roles
    WHERE rolname=current_user AND (rolsuper OR rolbypassrls)) THEN
    RAISE EXCEPTION 'Verified postgres RLS-bypass maintenance role required';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_class WHERE oid IN ('public.caterers'::regclass,'public.bookings'::regclass)
      AND (relkind<>'r' OR relispartition OR relowner<>'postgres'::regrole))
    OR EXISTS(SELECT 1 FROM pg_inherits WHERE inhparent IN ('public.caterers'::regclass,'public.bookings'::regclass)
      OR inhrelid IN ('public.caterers'::regclass,'public.bookings'::regclass)) THEN
    RAISE EXCEPTION 'Unexpected table ownership/inheritance: review coverage';
  END IF;
  SELECT pg_get_expr(d.adbin,d.adrelid),format_type(a.atttypid,NULL)
    INTO plan_default,plan_type FROM pg_attribute a LEFT JOIN pg_attrdef d
    ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE a.attrelid='public.caterers'::regclass AND a.attname='subscription_plan' AND NOT a.attisdropped;
  IF plan_default IS NULL OR plan_default NOT IN ('''free''',format('%L::%s','free',plan_type)) THEN
    RAISE EXCEPTION 'Registration requires the reviewed literal Free-plan default';
  END IF;
  SELECT pg_get_expr(d.adbin,d.adrelid) INTO expiry_default
    FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE a.attrelid='public.caterers'::regclass AND a.attname='subscription_expires_at'
      AND a.atttypid='timestamptz'::regtype AND NOT a.attnotnull AND NOT a.attisdropped;
  IF NOT FOUND OR (expiry_default IS NOT NULL AND expiry_default NOT IN
      ('NULL::timestamp with time zone','NULL::timestamptz','NULL')) THEN
    RAISE EXCEPTION 'Review safe NULL expiry initialization before restricting INSERT';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_roles r CROSS JOIN pg_attribute a
    WHERE r.rolname IN ('anon','authenticated') AND a.attrelid='public.caterers'::regclass
      AND a.attname IN ('subscription_plan','subscription_expires_at') AND NOT a.attisdropped
      AND has_column_privilege(r.oid,a.attrelid,a.attnum,'UPDATE')) THEN
    RAISE EXCEPTION 'Existing subscription UPDATE protection differs from verified baseline';
  END IF;
  -- Preserve grant chains: do not silently remove delegated INSERT privileges.
  IF EXISTS(SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) g
      WHERE c.oid='public.caterers'::regclass AND g.privilege_type='INSERT' AND g.is_grantable
        AND g.grantee IN (0,'anon'::regrole,'authenticated'::regrole))
    OR EXISTS(SELECT 1 FROM pg_attribute a CROSS JOIN LATERAL aclexplode(a.attacl) g
      WHERE a.attrelid='public.caterers'::regclass AND g.privilege_type='INSERT' AND g.is_grantable
        AND g.grantee IN (0,'anon'::regrole,'authenticated'::regrole)) THEN
    RAISE EXCEPTION 'Delegated client INSERT grant options require separate review';
  END IF;
  IF EXISTS(SELECT 1 FROM public.bookings WHERE status IS NULL OR status::text NOT IN
    ('pending','confirmed','awaiting_payment','paid','ongoing','completed','cancelled','rejected')) THEN
    RAISE EXCEPTION 'Unclassified booking status: review without rewriting history';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.pronamespace='public'::regnamespace
      AND p.proname='activate_paid_subscription' AND p.prokind='f')
    OR EXISTS(SELECT 1 FROM pg_proc p WHERE p.pronamespace='public'::regnamespace
      AND p.proname='activate_paid_subscription' AND p.prokind='f'
      AND (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE'))) THEN
    RAISE EXCEPTION 'Trusted paid activation baseline differs';
  END IF;
  INSERT INTO cc_phase2_dependency1_private.original_catalog
    SELECT c.oid,c.relowner,c.relacl,
      (SELECT jsonb_object_agg(a.attname,coalesce(to_jsonb(a.attacl),'null'::jsonb)) FROM pg_attribute a
        WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
      (SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.policyname),'[]'::jsonb) FROM pg_policies p
        WHERE p.schemaname='public' AND p.tablename=c.relname),
      (SELECT coalesce(jsonb_object_agg(t.tgname,jsonb_build_object('definition',pg_get_triggerdef(t.oid,true),
        'enabled',t.tgenabled)),'{}'::jsonb) FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal)
    FROM pg_class c WHERE c.oid IN ('public.caterers'::regclass,'public.bookings'::regclass);
  INSERT INTO cc_phase2_dependency1_private.insert_access
    SELECT r.oid,r.rolname,a.attname,has_column_privilege(r.oid,a.attrelid,a.attnum,'INSERT')
    FROM pg_roles r CROSS JOIN pg_attribute a WHERE a.attrelid='public.caterers'::regclass
      AND a.attnum>0 AND NOT a.attisdropped;
  INSERT INTO cc_phase2_dependency1_private.public_insert_access
    SELECT a.attname,EXISTS(SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) g
      WHERE c.oid=a.attrelid AND g.grantee=0 AND g.privilege_type='INSERT')
      OR EXISTS(SELECT 1 FROM aclexplode(a.attacl) g WHERE g.grantee=0 AND g.privilege_type='INSERT')
    FROM pg_attribute a WHERE a.attrelid='public.caterers'::regclass AND a.attnum>0 AND NOT a.attisdropped;
  INSERT INTO cc_phase2_dependency1_private.booking_access
    SELECT oid,rolname,has_table_privilege(oid,'public.bookings','DELETE'),
      has_table_privilege(oid,'public.bookings','TRUNCATE') FROM pg_roles;
  INSERT INTO cc_phase2_dependency1_private.trusted_functions
    SELECT p.oid,pg_get_functiondef(p.oid),p.proowner,p.proacl,p.proconfig FROM pg_proc p
    WHERE p.pronamespace='public'::regnamespace AND p.prokind='f'
      AND p.proname IN ('activate_paid_subscription','staff_correct_subscription_plan');
END;
$preflight$;

-- Column REVOKE cannot override table-wide INSERT. Restore prior safe access,
-- including PUBLIC safe columns, without granting clients plan/expiry INSERT.
REVOKE INSERT ON public.caterers FROM PUBLIC,anon,authenticated RESTRICT;
DO $insert_acl$
DECLARE item record;
BEGIN
  FOR item IN SELECT attname FROM pg_attribute WHERE attrelid='public.caterers'::regclass
    AND attnum>0 AND NOT attisdropped LOOP
    EXECUTE format('REVOKE INSERT (%I) ON public.caterers FROM PUBLIC,anon,authenticated RESTRICT',item.attname);
  END LOOP;
  FOR item IN SELECT * FROM cc_phase2_dependency1_private.public_insert_access WHERE can_insert
    AND column_name NOT IN ('subscription_plan','subscription_expires_at') LOOP
    EXECUTE format('GRANT INSERT (%I) ON public.caterers TO PUBLIC',item.column_name);
  END LOOP;
  FOR item IN SELECT * FROM cc_phase2_dependency1_private.insert_access WHERE can_insert
    AND role_name IN ('anon','authenticated') AND column_name NOT IN ('subscription_plan','subscription_expires_at') LOOP
    EXECUTE format('GRANT INSERT (%I) ON public.caterers TO %I',item.column_name,item.role_name);
  END LOOP;
  -- Preserve the service's previously effective rights if PUBLIC revocation
  -- removed their source. Never grant a right the service did not already have.
  FOR item IN SELECT * FROM cc_phase2_dependency1_private.insert_access WHERE can_insert AND role_name='service_role' LOOP
    IF NOT has_column_privilege(item.role_id,'public.caterers',item.column_name::text,'INSERT') THEN
      EXECUTE format('GRANT INSERT (%I) ON public.caterers TO service_role',item.column_name);
    END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM cc_phase2_dependency1_private.insert_access s WHERE
    CASE WHEN s.role_name IN ('anon','authenticated') AND s.column_name IN ('subscription_plan','subscription_expires_at')
      THEN has_column_privilege(s.role_id,'public.caterers',s.column_name::text,'INSERT')
      ELSE has_column_privilege(s.role_id,'public.caterers',s.column_name::text,'INSERT') IS DISTINCT FROM s.can_insert END) THEN
    RAISE EXCEPTION 'Inherited exposure or unexpected INSERT privilege loss: review grant source; no broad bypass';
  END IF;
END;
$insert_acl$;

-- Verified direct grants only. PUBLIC/inherited sources cause final assertion
-- refusal rather than changing unrelated memberships or trusted operations.
REVOKE TRUNCATE ON public.bookings FROM anon,authenticated RESTRICT;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM cc_phase2_dependency1_private.booking_access s
    WHERE has_table_privilege(s.role_id,'public.bookings','DELETE') IS DISTINCT FROM s.can_delete
      OR CASE WHEN s.role_name IN ('anon','authenticated') THEN has_table_privilege(s.role_id,'public.bookings','TRUNCATE')
        ELSE has_table_privilege(s.role_id,'public.bookings','TRUNCATE') IS DISTINCT FROM s.can_truncate END) THEN
    RAISE EXCEPTION 'Unexpected DELETE/TRUNCATE privilege drift or inherited client TRUNCATE remains';
  END IF;
END $$;

CREATE FUNCTION public.cc_phase2_dependency1_guard_status() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  -- Same-status refund/payment/quota_month edits remain untouched.
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  IF OLD.status::text='completed' THEN
    RAISE EXCEPTION 'Completed bookings cannot change status' USING ERRCODE='23514';
  END IF;
  IF NEW.status IS NULL OR NEW.status::text NOT IN
      ('pending','confirmed','awaiting_payment','paid','ongoing','completed','cancelled','rejected') THEN
    RAISE EXCEPTION 'Unrecognized booking status transition' USING ERRCODE='23514';
  END IF;
  IF OLD.status::text IN ('confirmed','awaiting_payment','paid','ongoing','completed')
    AND NEW.status::text IN ('pending','rejected') THEN
    RAISE EXCEPTION 'Accepted bookings cannot return to pending or rejected. Use the authorized cancellation workflow.' USING ERRCODE='23514';
  END IF;
  -- Adds reversal restrictions only, never payment/status authorization.
  -- Existing RLS and trusted operations still decide who may make other changes.
  RETURN NEW;
END;
$$;
ALTER FUNCTION public.cc_phase2_dependency1_guard_status() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.cc_phase2_dependency1_guard_status() FROM PUBLIC,anon,authenticated;
-- All UPDATE events, not UPDATE OF status: includes rewrites by BEFORE triggers.
CREATE TRIGGER cc_phase2_dependency1_guard_status AFTER UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.cc_phase2_dependency1_guard_status();

DO $verify$
DECLARE saved record;
BEGIN
  FOR saved IN SELECT * FROM cc_phase2_dependency1_private.original_catalog LOOP
    IF saved.policies IS DISTINCT FROM (SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.policyname),'[]'::jsonb)
      FROM pg_policies p JOIN pg_class c ON c.relname=p.tablename AND c.oid=saved.relation
      WHERE p.schemaname='public') THEN RAISE EXCEPTION 'RLS policy drift'; END IF;
    IF saved.triggers IS DISTINCT FROM (SELECT coalesce(jsonb_object_agg(t.tgname,
      jsonb_build_object('definition',pg_get_triggerdef(t.oid,true),'enabled',t.tgenabled)),'{}'::jsonb)
      FROM pg_trigger t WHERE t.tgrelid=saved.relation AND NOT t.tgisinternal
        AND t.tgname<>'cc_phase2_dependency1_guard_status') THEN RAISE EXCEPTION 'Existing trigger drift'; END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM cc_phase2_dependency1_private.trusted_functions s LEFT JOIN pg_proc p ON p.oid=s.function_oid
    WHERE p.oid IS NULL OR pg_get_functiondef(p.oid) IS DISTINCT FROM s.definition OR p.proowner IS DISTINCT FROM s.owner_id
      OR p.proacl IS DISTINCT FROM s.acl OR p.proconfig IS DISTINCT FROM s.config) THEN
    RAISE EXCEPTION 'Trusted subscription function drift';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.bookings'::regclass
    AND tgname='cc_phase2_dependency1_guard_status' AND tgtype=17 AND tgenabled='O' AND tgconstraint=0)
    THEN RAISE EXCEPTION 'Reversal guard installation differs'; END IF;
END;
$verify$;
COMMIT;

/* REQUIRED BEFORE DEPLOYMENT -- NOT RUN
1. Deploy/test the corrected booking webhook BEFORE installing this guard.
   Late callbacks must ignore completed/cancelled/processed rows, not overwrite
   them. Service-role has no guard bypass. Keep the monthly proposal unchanged.
2. Free/default NULL expiry preflight is strict. Review signup/approval trigger
   side effects in staging; do not rewrite defaults or bypass failures. Ordinary
   registration omits protected fields; trusted activation UPDATE stays unchanged.
3. Compare ACL/policy/trigger snapshots; test registration, approval, trusted
   activation, normal profile edits and existing daily-capacity settings.
4. Test all status pairs, same-status refund/quota updates, cancellation,
   payment verification and completion against actual server operations. Server
   cancellation/verification definitions not present locally remain dependencies.
5. No new booking DELETE/TRUNCATE trigger, FK action or account-deletion policy
   is introduced. Ordinary DELETE stays denied as verified. Privileged deletion
   of completed history remains a separate retention/maintenance boundary.
6. Guards do not authorize payment/status writes; existing authorization must
   still do so. Unknown/inherited grant sources abort instead of broad revocation.
7. Snapshot restores require drift checks, reviewed GRANT/REVOKE and separate
   approval. Reopening protected INSERT/TRUNCATE grants restores vulnerabilities;
   prefer forward fixes. Drop new trigger before function RESTRICT, never CASCADE.
   No automatic rollback, booking rewrite, deletion, SQL execution or live test.
*/
