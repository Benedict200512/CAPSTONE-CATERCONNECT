-- CaterConnect MONTHLY QUOTA -- LOCAL PROPOSAL ONLY. NOT EXECUTED/TESTED.
-- Not production-ready. Keep outside automatic migration runners.
-- Approved: Manila calendar months; five committed states; cancelled releases;
-- reconfirmation acquires in current month; upgrades do not reset usage.
-- Existing booking/status/payment authorization and daily rules stay separate.
-- Empty-bookings deployment ONLY: check under the maintenance lock and again
-- before cutover. No historical month mapping or booking backfill is permitted.
-- Existing own-profile UPDATE RLS stays unchanged. Unprotected profiles.role
-- self-promotion can compromise staff/admin RPC authorization; resolve/verify
-- that separate security prerequisite before removing the dependency gate.
BEGIN;
DO $$ BEGIN
  RAISE EXCEPTION 'PROPOSAL ONLY: monthly quota needs explicit execution approval';
END $$;
-- A SECOND deliberate gate: execution approval alone cannot resolve these
-- missing facts. Replace only with a separately reviewed, concrete resolution.
DO $$ BEGIN
  RAISE EXCEPTION 'DEPENDENCY BLOCK: verify trusted plan/expiry writers and staff/admin authorization, reset compatibility and booking retention/reassignment before execution';
END $$;

-- Same maintenance order as Availability. Drain writers first; bounded lock
-- timeouts belong in the approved runbook, not speculative retry loops here.
LOCK TABLE public.caterers, public.bookings IN ACCESS EXCLUSIVE MODE;
CREATE SCHEMA cc_monthly1_private;
REVOKE ALL ON SCHEMA cc_monthly1_private FROM PUBLIC,anon,authenticated;
CREATE TABLE cc_monthly1_private.backup (
  singleton boolean PRIMARY KEY CHECK(singleton),
  trigger_definition text NOT NULL, trigger_comment text,
  function_oid oid NOT NULL, function_definition text NOT NULL,
  function_owner oid NOT NULL, function_acl aclitem[], function_config text[],
  installed_definitions jsonb
);
CREATE TABLE cc_monthly1_private.caterer_snapshot (
  caterer_id uuid PRIMARY KEY,
  original_cache jsonb NOT NULL, installed_cache jsonb
);
-- No FK: deletion must not erase evidence that rollback would lose quota history.
CREATE TABLE cc_monthly1_private.touched_bookings (booking_id uuid PRIMARY KEY);
-- Retained EMPTY solely for compatibility with the existing guarded rollback.
-- Not a deployment input: no legacy bookings or mapping INSERTs are allowed.
CREATE TABLE cc_monthly1_private.legacy_month_map (
  booking_id uuid PRIMARY KEY, quota_month date NOT NULL,
  evidence text NOT NULL CHECK(char_length(btrim(evidence))>0),
  CHECK(extract(day FROM quota_month)=1 AND isfinite(quota_month))
);
REVOKE ALL ON ALL TABLES IN SCHEMA cc_monthly1_private FROM PUBLIC,anon,authenticated;

DO $preflight$
DECLARE t record; f record; field_name text;
BEGIN
  IF current_user<>'postgres' OR NOT EXISTS(SELECT 1 FROM pg_roles
    WHERE rolname=current_user AND (rolsuper OR rolbypassrls)) THEN
    RAISE EXCEPTION 'Verified postgres RLS-bypass maintenance role required';
  END IF;
  IF current_setting('transaction_isolation')<>'read committed' THEN
    RAISE EXCEPTION 'Use READ COMMITTED';
  END IF;
  IF EXISTS(SELECT 1 FROM public.bookings) THEN
    RAISE EXCEPTION 'Empty-bookings deployment required: bookings appeared after test reset; stop without deleting or mapping them';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.bookings'::regclass
    AND attname='quota_month' AND NOT attisdropped) THEN
    RAISE EXCEPTION 'quota_month collision: inspect instead of replacing';
  END IF;
  FOREACH field_name IN ARRAY ARRAY['subscription_expires_at','booking_count_reset_at'] LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.caterers'::regclass
      AND attname=field_name AND atttypid='timestamptz'::regtype AND NOT attisdropped) THEN
      RAISE EXCEPTION 'Caterer timestamp shape differs: %',field_name;
    END IF;
  END LOOP;
  IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.caterers'::regclass
    AND attname='monthly_booking_count' AND atttypid IN ('integer'::regtype,'bigint'::regtype)
    AND NOT attisdropped) THEN RAISE EXCEPTION 'Inspect counter type before adapting'; END IF;
  SELECT * INTO STRICT t FROM pg_trigger WHERE tgrelid='public.bookings'::regclass
    AND tgname='on_booking_created_increment_count';
  SELECT * INTO STRICT f FROM pg_proc WHERE oid=t.tgfoid;
  IF t.tgisinternal OR t.tgtype<>5 OR t.tgenabled<>'O' OR t.tgconstraint<>0
    OR t.tgqual IS NOT NULL OR t.tgnargs<>0 OR t.tgoldtable IS NOT NULL
    OR t.tgnewtable IS NOT NULL OR NOT f.prosecdef
    OR t.tgfoid<>'public.handle_new_booking_count()'::regprocedure THEN
    RAISE EXCEPTION 'Original counter trigger/function differs from reviewed baseline';
  END IF;
  IF (SELECT count(*) FROM pg_trigger WHERE tgrelid='public.bookings'::regclass
    AND NOT tgisinternal AND tgfoid=f.oid)<>1 THEN
    RAISE EXCEPTION 'Additional counter trigger attachment needs review';
  END IF;
  INSERT INTO cc_monthly1_private.backup(singleton,trigger_definition,trigger_comment,
    function_oid,function_definition,function_owner,function_acl,function_config) VALUES
    (true,pg_get_triggerdef(t.oid,true),obj_description(t.oid,'pg_trigger'),
     f.oid,pg_get_functiondef(f.oid),f.proowner,f.proacl,f.proconfig);
  INSERT INTO cc_monthly1_private.caterer_snapshot(caterer_id,original_cache)
    SELECT id,jsonb_build_object('monthly_booking_count',monthly_booking_count,
      'booking_count_reset_at',booking_count_reset_at) FROM public.caterers;
END;
$preflight$;

ALTER TABLE public.bookings ADD COLUMN quota_month date
  CONSTRAINT cc_monthly1_month_start CHECK(quota_month IS NULL OR
    (isfinite(quota_month) AND extract(day FROM quota_month)=1));
GRANT SELECT(quota_month) ON public.bookings TO authenticated;

-- No booking UPDATE/backfill: quota_month is assigned only by the future
-- committed-acquisition guard. Empty baseline needs no historical assumptions.
CREATE INDEX cc_monthly1_booking_period ON public.bookings(caterer_id,quota_month);

CREATE FUNCTION public.cc_monthly1_limit(p_plan text,p_expires timestamptz)
RETURNS integer LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF p_plan IS NULL OR p_plan NOT IN ('free','basic','standard','premium') THEN
    RAISE EXCEPTION 'Subscription entitlement unavailable' USING ERRCODE='55000';
  END IF;
  IF p_plan<>'free' AND p_expires IS NULL THEN
    RAISE EXCEPTION 'Subscription expiry needs review' USING ERRCODE='55000';
  END IF;
  IF p_plan='free' OR p_expires<=clock_timestamp() THEN RETURN 5; END IF;
  RETURN CASE p_plan WHEN 'basic' THEN 20 WHEN 'standard' THEN 50 ELSE NULL END;
END;
$$;

CREATE FUNCTION public.cc_monthly1_stamp_booking() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE entering boolean; target uuid;
BEGIN
  -- Internal marker is transactional and records no personal details.
  INSERT INTO cc_monthly1_private.touched_bookings VALUES
    (CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END) ON CONFLICT DO NOTHING;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.quota_month IS NOT NULL THEN
      RAISE EXCEPTION 'Quota month is server-managed' USING ERRCODE='42501';
    END IF;
    entering:=coalesce(NEW.status::text IN ('confirmed','awaiting_payment','paid','ongoing','completed'),false);
  ELSE
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.quota_month IS DISTINCT FROM OLD.quota_month THEN
      RAISE EXCEPTION 'Booking identity/quota month cannot be rewritten' USING ERRCODE='42501';
    END IF;
    -- Proposed defensive restriction pending explicit reassignment review.
    -- No ordinary application path currently reassigns accepted bookings.
    IF OLD.quota_month IS NOT NULL AND NEW.caterer_id IS DISTINCT FROM OLD.caterer_id THEN
      RAISE EXCEPTION 'Previously counted booking reassignment requires review' USING ERRCODE='42501';
    END IF;
    entering:=coalesce(NEW.status::text IN ('confirmed','awaiting_payment','paid','ongoing','completed'),false)
      AND NOT coalesce(OLD.status::text IN ('confirmed','awaiting_payment','paid','ongoing','completed'),false);
  END IF;
  IF entering THEN
    IF current_setting('transaction_isolation')<>'read committed' THEN
      RAISE EXCEPTION 'Monthly quota acquisitions require READ COMMITTED' USING ERRCODE='55000';
    END IF;
    target:=NEW.caterer_id;
    PERFORM 1 FROM public.caterers WHERE id=target FOR NO KEY UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Caterer unavailable' USING ERRCODE='23503'; END IF;
    -- Time sampled AFTER waiting for the parent lock. Each reconfirmation gets
    -- the current month, not its cancelled episode's old month. No timestamp
    -- claiming historical confirmation is introduced.
    NEW.quota_month:=date_trunc('month',clock_timestamp() AT TIME ZONE 'Asia/Manila')::date;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.cc_monthly1_check_booking() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE target uuid; plan text; expires timestamptz; ceiling integer;
  used bigint; current_used bigint; month_now date; entering boolean;
BEGIN
  IF TG_OP='INSERT' THEN
    IF NOT coalesce(NEW.status::text IN ('confirmed','awaiting_payment','paid','ongoing','completed'),false) THEN RETURN NEW; END IF;
  ELSIF TG_OP='DELETE' THEN
    IF NOT coalesce(OLD.status::text IN ('confirmed','awaiting_payment','paid','ongoing','completed'),false) THEN RETURN OLD; END IF;
  END IF;
  IF TG_OP='UPDATE' THEN
    IF coalesce(OLD.status::text IN ('confirmed','awaiting_payment','paid','ongoing','completed'),false)
      =coalesce(NEW.status::text IN ('confirmed','awaiting_payment','paid','ongoing','completed'),false)
      AND NEW.caterer_id IS NOT DISTINCT FROM OLD.caterer_id THEN RETURN NEW; END IF;
  END IF;
  target:=CASE WHEN TG_OP='DELETE' THEN OLD.caterer_id ELSE NEW.caterer_id END;
  SELECT subscription_plan::text,subscription_expires_at INTO plan,expires
    FROM public.caterers WHERE id=target FOR NO KEY UPDATE;
  -- Native account/caterer cascade: no surviving parent's cache to update.
  IF NOT FOUND AND TG_OP='DELETE' THEN RETURN OLD; END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'Caterer unavailable' USING ERRCODE='23503'; END IF;
  IF current_setting('transaction_isolation')<>'read committed' THEN
    RAISE EXCEPTION 'Monthly accounting changes require READ COMMITTED' USING ERRCODE='55000';
  END IF;
  entering:=false;
  IF TG_OP<>'DELETE' THEN
    entering:=coalesce(NEW.status::text IN ('confirmed','awaiting_payment','paid','ongoing','completed'),false);
  END IF;
  IF entering THEN
    IF NEW.quota_month IS NULL THEN RAISE EXCEPTION 'Committed booking lacks quota assignment'; END IF;
    ceiling:=public.cc_monthly1_limit(plan,expires);
    -- Separate command, fresh READ COMMITTED snapshot, own statement visible.
    SELECT count(*) INTO used FROM public.bookings WHERE caterer_id=target
      AND quota_month=NEW.quota_month
      AND status::text IN ('confirmed','awaiting_payment','paid','ongoing','completed');
    IF ceiling IS NOT NULL AND used>ceiling THEN
      RAISE EXCEPTION 'Monthly accepted-booking limit reached. Please review your subscription.' USING ERRCODE='23514';
    END IF;
  END IF;
  month_now:=date_trunc('month',clock_timestamp() AT TIME ZONE 'Asia/Manila')::date;
  SELECT count(*) INTO current_used FROM public.bookings WHERE caterer_id=target
    AND quota_month=month_now
    AND status::text IN ('confirmed','awaiting_payment','paid','ongoing','completed');
  -- Recompute current cache, never decrement current usage for an old-month
  -- cancellation. No billing, expiry extension or daily-capacity mutation.
  -- Leave booking_count_reset_at to its existing writers. Its legacy meaning
  -- is not redefined here, and it is never authoritative for quota decisions.
  UPDATE public.caterers SET monthly_booking_count=current_used WHERE id=target;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.cc_monthly1_guard_cache() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE month_now date;
BEGIN
  IF TG_OP='UPDATE' THEN
    IF NEW.monthly_booking_count IS NOT DISTINCT FROM OLD.monthly_booking_count
      AND NEW.booking_count_reset_at IS NOT DISTINCT FROM OLD.booking_count_reset_at
      AND NEW.subscription_plan IS NOT DISTINCT FROM OLD.subscription_plan
      AND NEW.subscription_expires_at IS NOT DISTINCT FROM OLD.subscription_expires_at THEN RETURN NEW; END IF;
  END IF;
  IF current_setting('transaction_isolation')<>'read committed' THEN
    RAISE EXCEPTION 'Monthly counter projection requires READ COMMITTED' USING ERRCODE='55000';
  END IF;
  -- UPDATE already locks this parent. SELECT only: no recursive parent UPDATE.
  -- Ignore stale/reset/zero payloads, including those from old clients/webhooks;
  -- do not reject an otherwise authorized subscription activation transaction.
  month_now:=date_trunc('month',clock_timestamp() AT TIME ZONE 'Asia/Manila')::date;
  SELECT count(*) INTO NEW.monthly_booking_count FROM public.bookings
    WHERE caterer_id=NEW.id AND quota_month=month_now
      AND status::text IN ('confirmed','awaiting_payment','paid','ongoing','completed');
  -- Preserve the incoming legacy reset timestamp, including existing AuthContext
  -- and subscription activation payloads. Only the numeric cache is projected.
  -- Entitlement authorization is a separate mandatory execution prerequisite;
  -- this function does NOT authorize or protect plan/expiry changes.
  RETURN NEW;
END;
$$;

DO $acl$
DECLARE signature text;
BEGIN
  FOREACH signature IN ARRAY ARRAY['public.cc_monthly1_limit(text,timestamptz)',
    'public.cc_monthly1_stamp_booking()','public.cc_monthly1_check_booking()',
    'public.cc_monthly1_guard_cache()'] LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres',signature);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',signature);
  END LOOP;
END;
$acl$;
CREATE TRIGGER cc_monthly1_stamp_booking BEFORE INSERT OR UPDATE OR DELETE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.cc_monthly1_stamp_booking();
CREATE TRIGGER cc_monthly1_check_booking AFTER INSERT OR UPDATE OR DELETE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.cc_monthly1_check_booking();
CREATE TRIGGER cc_monthly1_guard_cache BEFORE INSERT OR UPDATE ON public.caterers
  FOR EACH ROW EXECUTE FUNCTION public.cc_monthly1_guard_cache();
-- Derive numeric cache from the locked empty booking baseline, never from old
-- INSERT counts. Snapshots are rollback-only, not enforcement authority.
-- No status, price, payment, plan, expiry or reset timestamp is rewritten.
UPDATE public.caterers c SET monthly_booking_count=(SELECT count(*) FROM public.bookings b
    WHERE b.caterer_id=c.id
      AND b.quota_month=date_trunc('month',clock_timestamp() AT TIME ZONE 'Asia/Manila')::date
      AND b.status::text IN ('confirmed','awaiting_payment','paid','ongoing','completed'))
  WHERE c.monthly_booking_count IS DISTINCT FROM 0;
UPDATE cc_monthly1_private.caterer_snapshot s SET installed_cache=
  jsonb_build_object('monthly_booking_count',c.monthly_booking_count,'booking_count_reset_at',c.booking_count_reset_at)
  FROM public.caterers c WHERE c.id=s.caterer_id;
-- Exact known trigger only. Keep its original function definition/ACL intact.
-- Locks prevent client writes until both replacement and removal commit.
-- Flush initialization's deferred constraint callbacks before final empty-state
-- checks. Do not suppress callbacks or clear their transactional activity markers.
SET CONSTRAINTS ALL IMMEDIATE;
DO $cutover$
DECLARE g record;
BEGIN
  -- Existing caterer UPDATE callbacks during cache initialization may write
  -- bookings. Successful installation must retain an empty starting state.
  -- Abort atomically rather than clear markers or add an installer bypass:
  -- every successful unused installation must start with an empty tracker.
  IF EXISTS(SELECT 1 FROM public.bookings)
    OR EXISTS(SELECT 1 FROM cc_monthly1_private.legacy_month_map)
    OR EXISTS(SELECT 1 FROM cc_monthly1_private.touched_bookings) THEN
    RAISE EXCEPTION 'Installation callbacks wrote bookings: inspect side effects before quota cutover';
  END IF;
  FOR g IN SELECT * FROM (VALUES
    ('public.bookings'::regclass,'cc_monthly1_stamp_booking','public.cc_monthly1_stamp_booking()'::regprocedure,31),
    ('public.bookings'::regclass,'cc_monthly1_check_booking','public.cc_monthly1_check_booking()'::regprocedure,29),
    ('public.caterers'::regclass,'cc_monthly1_guard_cache','public.cc_monthly1_guard_cache()'::regprocedure,23)
  ) guards(relation,name,function_oid,event_bits) LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
      WHERE t.tgrelid=g.relation AND t.tgname=g.name AND t.tgfoid=g.function_oid
        AND t.tgtype=g.event_bits AND t.tgenabled='O' AND NOT t.tgisinternal
        AND t.tgconstraint=0 AND t.tgqual IS NULL AND t.tgnargs=0
        AND p.prosecdef AND p.provolatile='v' AND pg_get_userbyid(p.proowner)='postgres'
        AND p.proconfig=ARRAY['search_path=""'])
      OR has_function_privilege('authenticated',g.function_oid,'EXECUTE')
      OR has_function_privilege('anon',g.function_oid,'EXECUTE') THEN
      RAISE EXCEPTION 'Monthly guard installation differs: refusing old trigger removal';
    END IF;
  END LOOP;
END;
$cutover$;
DROP TRIGGER on_booking_created_increment_count ON public.bookings RESTRICT;
UPDATE cc_monthly1_private.backup SET installed_definitions=jsonb_build_object(
  'functions',(SELECT jsonb_object_agg(p.oid::text,pg_get_functiondef(p.oid))
    FROM pg_proc p WHERE p.oid IN ('public.cc_monthly1_limit(text,timestamptz)'::regprocedure,
      'public.cc_monthly1_stamp_booking()'::regprocedure,'public.cc_monthly1_check_booking()'::regprocedure,
      'public.cc_monthly1_guard_cache()'::regprocedure)),
  'triggers',(SELECT jsonb_object_agg(t.tgname,pg_get_triggerdef(t.oid,true))
    FROM pg_trigger t WHERE (t.tgrelid='public.bookings'::regclass AND t.tgname IN
      ('cc_monthly1_stamp_booking','cc_monthly1_check_booking'))
      OR (t.tgrelid='public.caterers'::regclass AND t.tgname='cc_monthly1_guard_cache'))
) WHERE singleton;
COMMIT;
-- Empty-baseline regression checks (offline/static only until approved testing):
-- reject even ONE pending booking at preflight; reject initialization callbacks
-- creating bookings/mappings/markers; unused rollback sees an empty legacy map.
-- Old numeric counters are normalized, never used in quota decisions. Ensure
-- old INSERT trigger is absent after cutover: pending requests keep zero usage.
-- Test confirmations N/N+1 and concurrent confirmations, cancellation/reconfirm,
-- completed retention and unchanged committed payment transitions with Phase 1.
-- Persisted display cache may be stale at month rollover without later writes;
-- the application reads assigned-month bookings, not legacy optimistic counters.
-- Ordinary enabled triggers apply to service-role writes too; no postgres skip.
-- Disabled triggers/TRUNCATE/unsafe privileged DDL remain outside the boundary.
