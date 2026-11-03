-- Feature 3 package publication -- LOCAL PROPOSAL ONLY. NOT EXECUTED.
-- No executable copy. Review deployed policies/check_package_limit body and test
-- in an isolated database before separately approving installation.
BEGIN;
DO $$ BEGIN
  RAISE EXCEPTION 'PROPOSAL ONLY: package publishing requires separate execution approval';
END $$;
-- Drain writers first. Preserve the existing parent-first maintenance order.
LOCK TABLE public.caterers, public.bookings, public.packages IN ACCESS EXCLUSIVE MODE;
CREATE SCHEMA cc_package_publish1_private;
REVOKE ALL ON SCHEMA cc_package_publish1_private FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE cc_package_publish1_private.backup (
  singleton boolean PRIMARY KEY CHECK(singleton), catalog jsonb NOT NULL,
  package_count bigint NOT NULL, booking_count bigint NOT NULL
);
CREATE TABLE cc_package_publish1_private.original_functions (
  function_oid oid PRIMARY KEY, definition text NOT NULL, owner_id oid NOT NULL,
  acl aclitem[], config text[]
);
REVOKE ALL ON ALL TABLES IN SCHEMA cc_package_publish1_private FROM PUBLIC,anon,authenticated,service_role;

DO $preflight$
DECLARE field record;
BEGIN
  IF current_user<>'postgres' OR NOT EXISTS(SELECT 1 FROM pg_roles
    WHERE rolname=current_user AND (rolsuper OR rolbypassrls)) THEN
    RAISE EXCEPTION 'Verified postgres RLS-bypass maintenance role required';
  END IF;
  IF current_setting('transaction_isolation')<>'read committed' THEN
    RAISE EXCEPTION 'Use READ COMMITTED';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_class WHERE oid IN ('public.packages'::regclass,'public.bookings'::regclass)
      AND (relkind<>'r' OR relispartition OR relowner<>'postgres'::regrole))
    OR EXISTS(SELECT 1 FROM pg_inherits WHERE inhparent IN ('public.packages'::regclass,'public.bookings'::regclass)
      OR inhrelid IN ('public.packages'::regclass,'public.bookings'::regclass)) THEN
    RAISE EXCEPTION 'Unexpected package/booking ownership or inheritance';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.packages'::regclass AND relrowsecurity) THEN
    RAISE EXCEPTION 'Package RLS must already be enabled';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.packages'::regclass
    AND attname='publication_status' AND NOT attisdropped) THEN
    RAISE EXCEPTION 'Publication column collision: inspect instead of replacing';
  END IF;
  FOR field IN SELECT * FROM (VALUES
    ('public.packages'::regclass,'id'),('public.packages'::regclass,'caterer_id'),
    ('public.caterers'::regclass,'id'),('public.caterers'::regclass,'user_id'),
    ('public.bookings'::regclass,'package_id'),('public.bookings'::regclass,'caterer_id'),
    ('public.bookings'::regclass,'customer_id')
  ) expected(relation,name) LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=field.relation AND attname=field.name
      AND atttypid='uuid'::regtype AND attnum>0 AND NOT attisdropped) THEN
      RAISE EXCEPTION 'Review required UUID field %.%',field.relation,field.name;
    END IF;
  END LOOP;
  IF NOT EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.packages'::regclass
    AND polname='Anyone can view packages' AND polcmd='r' AND polpermissive
    AND pg_get_expr(polqual,polrelid)='true')
    OR NOT EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.packages'::regclass
      AND polname='Caterer manages own packages') THEN
    RAISE EXCEPTION 'Reviewed existing package policy baseline differs';
  END IF;
  -- The NO ACTION FK is retained, not replaced by a destructive cascade.
  IF NOT EXISTS(SELECT 1 FROM pg_constraint c WHERE c.contype='f'
    AND c.conrelid='public.bookings'::regclass AND c.confrelid='public.packages'::regclass
    AND c.confdeltype='a' AND c.convalidated
    AND c.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=c.conrelid AND attname='package_id')]::smallint[]
    AND c.confkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=c.confrelid AND attname='id')]::smallint[]) THEN
    RAISE EXCEPTION 'Reviewed booking/package NO ACTION FK missing';
  END IF;
  IF to_regprocedure('public.check_package_limit()') IS NULL OR NOT EXISTS(
    SELECT 1 FROM pg_trigger WHERE tgrelid='public.packages'::regclass
      AND tgfoid=to_regprocedure('public.check_package_limit()') AND tgtype IN (5,7) AND tgenabled IN ('O','A'))
    OR EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.packages'::regclass
      AND tgfoid=to_regprocedure('public.check_package_limit()') AND tgtype NOT IN (5,7)) THEN
    RAISE EXCEPTION 'Review package quantity trigger: expected enabled row INSERT only; do not rewrite its limit logic';
  END IF;
END;
$preflight$;

INSERT INTO cc_package_publish1_private.backup
SELECT true,jsonb_build_object(
  'relations',(SELECT jsonb_object_agg(c.oid::text,jsonb_build_object('owner',c.relowner,
    'acl',c.relacl,'rls',c.relrowsecurity,'forced',c.relforcerowsecurity)) FROM pg_class c
    WHERE c.oid IN ('public.packages'::regclass,'public.bookings'::regclass)),
  'policies',(SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY tablename,policyname),'[]'::jsonb)
    FROM pg_policies p WHERE schemaname='public' AND tablename IN ('packages','bookings')),
  'foreign_keys',(SELECT coalesce(jsonb_object_agg(c.oid::text,pg_get_constraintdef(c.oid,true)),'{}'::jsonb)
    FROM pg_constraint c WHERE contype='f' AND (conrelid IN ('public.packages'::regclass,'public.bookings'::regclass)
      OR confrelid IN ('public.packages'::regclass,'public.bookings'::regclass))),
  'triggers',(SELECT coalesce(jsonb_object_agg(t.oid::text,jsonb_build_object('definition',pg_get_triggerdef(t.oid,true),
    'enabled',t.tgenabled)),'{}'::jsonb) FROM pg_trigger t
    WHERE t.tgrelid IN ('public.packages'::regclass,'public.bookings'::regclass) AND NOT t.tgisinternal)
), (SELECT count(*) FROM public.packages),(SELECT count(*) FROM public.bookings);
INSERT INTO cc_package_publish1_private.original_functions
SELECT DISTINCT p.oid,pg_get_functiondef(p.oid),p.proowner,p.proacl,p.proconfig
FROM pg_proc p JOIN pg_trigger t ON t.tgfoid=p.oid
WHERE t.tgrelid IN ('public.packages'::regclass,'public.bookings'::regclass) AND NOT t.tgisinternal;

-- Constant ADD COLUMN default initializes only the new field for existing rows.
-- No UPDATE/backfill of prices, capacities or booking amounts; no INSERT trigger
-- is replayed. Change the default immediately for future INSERTs under the lock.
ALTER TABLE public.packages ADD COLUMN publication_status text NOT NULL DEFAULT 'published'
  CONSTRAINT cc_package_publish1_status CHECK(publication_status IN ('published','unpublished','archived'));
ALTER TABLE public.packages ALTER COLUMN publication_status SET DEFAULT 'unpublished';
GRANT SELECT(publication_status) ON public.packages TO anon,authenticated;
GRANT INSERT(publication_status),UPDATE(publication_status) ON public.packages TO authenticated;

-- Narrow boolean reader avoids packages -> bookings RLS -> packages recursion.
-- Caller identity is always auth.uid(), never a client-supplied actor. Fixed SQL,
-- fully qualified tables, empty search_path, postgres owner verified above.
CREATE FUNCTION public.cc_package_publish1_can_read_history(p_package_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS(SELECT 1 FROM public.bookings b LEFT JOIN public.caterers c ON c.id=b.caterer_id
      WHERE b.package_id=p_package_id AND (b.customer_id=auth.uid() OR c.user_id=auth.uid()))
  );
$$;
ALTER FUNCTION public.cc_package_publish1_can_read_history(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.cc_package_publish1_can_read_history(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.cc_package_publish1_can_read_history(uuid) TO anon,authenticated;

-- Preserve existing policies verbatim. This mandatory restriction intersects
-- EVERY permissive SELECT policy (including the original public true policy).
-- History participants may read their related hidden package, so discovery
-- queries must also explicitly filter publication_status='published'.
CREATE POLICY cc_package_publish1_read_scope ON public.packages AS RESTRICTIVE FOR SELECT TO PUBLIC
  USING(publication_status='published'
    OR EXISTS(SELECT 1 FROM public.caterers c WHERE c.id=packages.caterer_id AND c.user_id=auth.uid())
    OR public.cc_package_publish1_can_read_history(id));
CREATE POLICY cc_package_publish1_insert_owner ON public.packages AS RESTRICTIVE FOR INSERT TO anon,authenticated
  WITH CHECK(EXISTS(SELECT 1 FROM public.caterers c WHERE c.id=packages.caterer_id AND c.user_id=auth.uid()));
CREATE POLICY cc_package_publish1_update_owner ON public.packages AS RESTRICTIVE FOR UPDATE TO anon,authenticated
  USING(EXISTS(SELECT 1 FROM public.caterers c WHERE c.id=packages.caterer_id AND c.user_id=auth.uid()))
  WITH CHECK(EXISTS(SELECT 1 FROM public.caterers c WHERE c.id=packages.caterer_id AND c.user_id=auth.uid()));
CREATE POLICY cc_package_publish1_delete_owner ON public.packages AS RESTRICTIVE FOR DELETE TO anon,authenticated
  USING(EXISTS(SELECT 1 FROM public.caterers c WHERE c.id=packages.caterer_id AND c.user_id=auth.uid()));

CREATE FUNCTION public.cc_package_publish1_identity_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.caterer_id IS DISTINCT FROM OLD.caterer_id THEN
    RAISE EXCEPTION 'Package identity and caterer assignment cannot be rewritten' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.cc_package_publish1_delete_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF TG_OP='TRUNCATE' THEN
    RAISE EXCEPTION 'Packages cannot be truncated; archive packages instead' USING ERRCODE='23514';
  END IF;
  -- Global visibility includes RLS-hidden booking history and every status.
  IF EXISTS(SELECT 1 FROM public.bookings WHERE package_id=OLD.id) THEN
    RAISE EXCEPTION 'Package has booking history; archive it instead of deleting it' USING ERRCODE='23514';
  END IF;
  RETURN OLD;
END;
$$;

CREATE FUNCTION public.cc_package_publish1_booking_guard() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE needs_check boolean; assigned_caterer uuid; publication text;
BEGIN
  IF TG_OP='INSERT' THEN needs_check:=true;
  ELSE
    needs_check:=NEW.package_id IS DISTINCT FROM OLD.package_id
      OR NEW.caterer_id IS DISTINCT FROM OLD.caterer_id
      OR (coalesce(NEW.status::text IN ('confirmed','awaiting_payment','paid','ongoing','completed'),false)
        AND NOT coalesce(OLD.status::text IN ('confirmed','awaiting_payment','paid','ongoing','completed'),false));
  END IF;
  -- Accepted payment transitions, cancellation, completion and refund-only edits
  -- do not reacquire package eligibility. Existing booking authorization remains.
  IF NOT needs_check THEN RETURN NEW; END IF;
  IF current_setting('transaction_isolation')<>'read committed' THEN
    RAISE EXCEPTION 'Package eligibility checks require READ COMMITTED' USING ERRCODE='55000';
  END IF;
  IF NEW.package_id IS NULL THEN
    RAISE EXCEPTION 'Choose a published package for this booking' USING ERRCODE='23514';
  END IF;
  -- Match the daily/monthly parent-first order. FOR SHARE on the package, not
  -- KEY SHARE: status changes normally take NO KEY UPDATE and must conflict.
  PERFORM 1 FROM public.caterers WHERE id=NEW.caterer_id FOR NO KEY UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Caterer unavailable' USING ERRCODE='23503'; END IF;
  SELECT caterer_id,publication_status INTO assigned_caterer,publication
    FROM public.packages WHERE id=NEW.package_id FOR SHARE;
  IF NOT FOUND OR assigned_caterer IS DISTINCT FROM NEW.caterer_id OR publication<>'published' THEN
    RAISE EXCEPTION 'This package is not published or is unavailable for new bookings. Choose another package.' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;

DO $function_acl$
DECLARE name text;
BEGIN
  FOREACH name IN ARRAY ARRAY['cc_package_publish1_identity_guard','cc_package_publish1_delete_guard','cc_package_publish1_booking_guard'] LOOP
    EXECUTE format('ALTER FUNCTION public.%I() OWNER TO postgres',name);
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I() FROM PUBLIC,anon,authenticated,service_role',name);
  END LOOP;
END;
$function_acl$;
CREATE TRIGGER cc_package_publish1_identity_guard BEFORE UPDATE ON public.packages
  FOR EACH ROW EXECUTE FUNCTION public.cc_package_publish1_identity_guard();
CREATE TRIGGER cc_package_publish1_delete_guard BEFORE DELETE ON public.packages
  FOR EACH ROW EXECUTE FUNCTION public.cc_package_publish1_delete_guard();
CREATE TRIGGER cc_package_publish1_truncate_guard BEFORE TRUNCATE ON public.packages
  FOR EACH STATEMENT EXECUTE FUNCTION public.cc_package_publish1_delete_guard();
CREATE TRIGGER cc_package_publish1_booking_guard AFTER INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.cc_package_publish1_booking_guard();
ALTER TABLE public.packages ENABLE ALWAYS TRIGGER cc_package_publish1_identity_guard;
ALTER TABLE public.packages ENABLE ALWAYS TRIGGER cc_package_publish1_delete_guard;
ALTER TABLE public.packages ENABLE ALWAYS TRIGGER cc_package_publish1_truncate_guard;
ALTER TABLE public.bookings ENABLE ALWAYS TRIGGER cc_package_publish1_booking_guard;

DO $verify$
DECLARE saved record; actual jsonb;
BEGIN
  SELECT * INTO STRICT saved FROM cc_package_publish1_private.backup WHERE singleton;
  SELECT jsonb_build_object(
    'relations',(SELECT jsonb_object_agg(c.oid::text,jsonb_build_object('owner',c.relowner,
      'acl',c.relacl,'rls',c.relrowsecurity,'forced',c.relforcerowsecurity)) FROM pg_class c
      WHERE c.oid IN ('public.packages'::regclass,'public.bookings'::regclass)),
    'policies',(SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY tablename,policyname),'[]'::jsonb)
      FROM pg_policies p WHERE schemaname='public' AND tablename IN ('packages','bookings')
        AND policyname NOT IN ('cc_package_publish1_read_scope','cc_package_publish1_insert_owner',
          'cc_package_publish1_update_owner','cc_package_publish1_delete_owner')),
    'foreign_keys',(SELECT coalesce(jsonb_object_agg(c.oid::text,pg_get_constraintdef(c.oid,true)),'{}'::jsonb)
      FROM pg_constraint c WHERE contype='f' AND (conrelid IN ('public.packages'::regclass,'public.bookings'::regclass)
        OR confrelid IN ('public.packages'::regclass,'public.bookings'::regclass))),
    'triggers',(SELECT coalesce(jsonb_object_agg(t.oid::text,jsonb_build_object('definition',pg_get_triggerdef(t.oid,true),
      'enabled',t.tgenabled)),'{}'::jsonb) FROM pg_trigger t
      WHERE t.tgrelid IN ('public.packages'::regclass,'public.bookings'::regclass) AND NOT t.tgisinternal
        AND t.tgname NOT IN ('cc_package_publish1_identity_guard','cc_package_publish1_delete_guard',
          'cc_package_publish1_truncate_guard','cc_package_publish1_booking_guard'))
  ) INTO actual;
  IF actual IS DISTINCT FROM saved.catalog OR saved.package_count<>(SELECT count(*) FROM public.packages)
    OR saved.booking_count<>(SELECT count(*) FROM public.bookings)
    OR EXISTS(SELECT 1 FROM public.packages WHERE publication_status<>'published') THEN
    RAISE EXCEPTION 'Original policies/FKs/triggers/table privileges or existing row visibility changed unexpectedly';
  END IF;
  IF EXISTS(SELECT 1 FROM cc_package_publish1_private.original_functions s LEFT JOIN pg_proc p ON p.oid=s.function_oid
    WHERE p.oid IS NULL OR pg_get_functiondef(p.oid) IS DISTINCT FROM s.definition
      OR p.proowner IS DISTINCT FROM s.owner_id OR p.proacl IS DISTINCT FROM s.acl
      OR p.proconfig IS DISTINCT FROM s.config) THEN
    RAISE EXCEPTION 'Existing package quantity, booking, payment, daily or monthly trigger function changed';
  END IF;
END;
$verify$;
COMMIT;

/* REVIEW / ROLLOUT / MITIGATION -- NOT RUN
- Review exact existing ownership policy, check_package_limit body and attachment,
  booking RLS, other package RPCs/views and trigger side effects before approval.
  Preconditions stop on the supplied baseline drifting. No trigger is replaced.
- Existing packages become published in the NEW column only. New INSERT default
  is unpublished. Legacy clients can still edit, but need the new UI to publish
  new packages. Review this transition and release backend before mobile together.
- Existing quantity rules remain unchanged: if they count archived rows, archived
  packages still consume that limit. Do not silently exempt them or change plans.
- Old pending requests for a now-hidden package cannot first confirm; republish
  explicitly or choose another package via the existing authorized workflow.
  Legacy NULL package requests cannot acquire a new slot; accepted NULL-package
  bookings still retain same-package payment/cancellation/refund transitions.
- Booking participant access intentionally exposes that related hidden package's
  existing details, never unrelated hidden packages. Explicit discovery filters
  are required even for participants. No booking-history query is filtered.
- Rehearse owner/other-owner/customer/anon reads and writes, booking INSERT and
  reconfirmation, both race orders, stale IDs, historical joins, deletion/cascades,
  status changes at package limits, and daily/monthly rejection rollback in an
  isolated database. Deadlocks fail atomically; no automatic payment retry.
- No prices, guest capacities, booking totals/details, foreign keys, existing
  trigger definitions, payment functions or existing RLS policies are rewritten.
- Keep private snapshots. Prefer a forward fix. Any reversal needs separate
  approval and drift review: removing read/eligibility guards exposes hidden
  packages. Do not drop the status column or discard archived records blindly.
  New objects may be removed only by reviewed explicit RESTRICT operations after
  their dependencies are handled. Never CASCADE, delete history or disable guards
  to make a rollback pass. Operators controlling DDL remain outside this boundary.
*/
