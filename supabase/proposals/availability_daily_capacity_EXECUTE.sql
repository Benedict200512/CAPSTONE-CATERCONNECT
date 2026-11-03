-- CaterConnect availability/daily capacity -- LOCAL PROPOSAL ONLY.
-- NOT EXECUTED OR DATABASE-TESTED. Not approved for staging/production execution.
-- Keep outside automatic migrations. Review companion verification and rollback.
-- Existing booking/caterer triggers, RLS, monthly limits, payment/refund logic
-- and Security Migration 1 are not replaced. Existing RPC ACL is retained.
-- PROPOSED compatibility decision (requires approval): awaiting_payment also
-- reserves a slot. A local legacy webhook writes it; excluding it could free a
-- confirmed reservation and later reject its payment transition. No status is
-- added to an enum/CHECK and no payment writer is changed by this proposal.
-- Reviewed index cutover: snapshot the exact existing standalone
-- public.bookings_unique_active_caterer_date, then drop ONLY that index after
-- guard installation checks, under the locks below in this same transaction.
BEGIN;

-- Reviewed maintenance window required; these locks block application writers.
LOCK TABLE public.caterers, public.bookings IN ACCESS EXCLUSIVE MODE;
CREATE SCHEMA cc_availability1_private;
REVOKE ALL ON SCHEMA cc_availability1_private FROM PUBLIC, anon, authenticated;
CREATE TABLE cc_availability1_private.backup (
  singleton boolean PRIMARY KEY CHECK (singleton),
  original_definition text NOT NULL,
  installed_definition text,
  original_oid oid NOT NULL,
  original_owner oid NOT NULL,
  original_acl aclitem[],
  original_config text[],
  original_index_oid oid NOT NULL,
  original_index_name text NOT NULL CHECK (original_index_name='bookings_unique_active_caterer_date'),
  original_index_definition text NOT NULL,
  original_index_comment text,
  original_index_owner oid NOT NULL
);
REVOKE ALL ON cc_availability1_private.backup FROM PUBLIC, anon, authenticated;
DO $preflight$
DECLARE f record; i record;
BEGIN
  IF current_user <> 'postgres' OR NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls)
  ) THEN RAISE EXCEPTION 'Reviewed postgres RLS-bypass maintenance role required'; END IF;
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Use READ COMMITTED for this proposal';
  END IF;
  SELECT * INTO STRICT f FROM pg_proc
    WHERE oid='public.get_caterer_unavailable_dates(uuid)'::regprocedure;
  IF f.prokind<>'f' OR f.pronargs<>1 OR NOT f.prosecdef OR pg_get_userbyid(f.proowner)<>'postgres'
    OR pg_get_function_result(f.oid)<>'TABLE(event_date date)'
    OR f.proargnames[1] IS DISTINCT FROM 'p_caterer_id' THEN
    RAISE EXCEPTION 'RPC shape/owner differs: prepare exact compatible replacement';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.bookings'::regclass
      AND attname='event_date' AND atttypid='date'::regtype AND NOT attisdropped)
    OR EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.caterers'::regclass
      AND attname='max_bookings_per_day' AND NOT attisdropped)
    OR to_regclass('public.caterer_blocked_dates') IS NOT NULL THEN
    RAISE EXCEPTION 'Schema mismatch or object collision: inspect before proceeding';
  END IF;
  SELECT x.*,c.relowner,c.relkind,am.amname,
      pg_get_indexdef(x.indexrelid) AS definition,
      pg_get_expr(x.indpred,x.indrelid) AS predicate,
      obj_description(x.indexrelid,'pg_class') AS comment
    INTO STRICT i
    FROM pg_index x JOIN pg_class c ON c.oid=x.indexrelid
    JOIN pg_am am ON am.oid=c.relam
    WHERE x.indexrelid='public.bookings_unique_active_caterer_date'::regclass;
  -- Validate the supplied ordinary btree index, NOT merely its familiar name.
  -- Only whitespace is normalized; both exact text-cast forms are accepted.
  -- Different enum/domain casts or predicates require exact metadata review;
  -- do not widen this comparison speculatively or silently drop another index.
  IF i.indrelid<>'public.bookings'::regclass OR i.relkind<>'i'
    OR i.amname<>'btree' OR NOT i.indisunique OR NOT i.indisvalid
    OR NOT i.indisready OR NOT i.indislive OR i.indisprimary
    OR i.indisreplident OR i.indisclustered OR i.indexprs IS NOT NULL
    OR i.indnkeyatts<>2 OR i.indnatts<>2
    OR pg_get_indexdef(i.indexrelid,1,false)<>'caterer_id'
    OR pg_get_indexdef(i.indexrelid,2,false)<>'event_date'
    OR i.indoption::text<>'0 0'
    OR i.indpred IS NULL OR i.definition LIKE '%NULLS NOT DISTINCT%'
    OR regexp_replace(i.predicate,'\s+',' ','g') NOT IN (
      '(status = ANY (ARRAY[''confirmed'', ''paid'', ''ongoing'']))',
      '(status = ANY (ARRAY[''confirmed''::text, ''paid''::text, ''ongoing''::text]))')
    OR EXISTS(SELECT 1 FROM pg_constraint WHERE conindid=i.indexrelid)
    OR i.relowner<>(SELECT relowner FROM pg_class WHERE oid='public.bookings'::regclass) THEN
    RAISE EXCEPTION 'Active-date index differs from reviewed standalone index; inspect exact metadata before cutover';
  END IF;
  -- Other date restrictions are NOT approved for removal. This remains a
  -- conservative screen, not a complete expression-index/rule/function audit.
  IF EXISTS (
    SELECT 1 FROM pg_index x
    JOIN pg_attribute c ON c.attrelid=x.indrelid AND c.attname='caterer_id'
    JOIN pg_attribute d ON d.attrelid=x.indrelid AND d.attname='event_date'
    WHERE x.indrelid='public.bookings'::regclass AND x.indexrelid<>i.indexrelid AND x.indisunique
      AND x.indnkeyatts=2 AND x.indkey::smallint[] @> ARRAY[c.attnum,d.attnum]
  ) OR EXISTS (
    SELECT 1 FROM pg_constraint x
    JOIN pg_attribute c ON c.attrelid=x.conrelid AND c.attname='caterer_id'
    JOIN pg_attribute d ON d.attrelid=x.conrelid AND d.attname='event_date'
    WHERE x.conrelid='public.bookings'::regclass AND x.contype='x'
      AND x.conkey @> ARRAY[c.attnum,d.attnum]
  ) THEN
    RAISE EXCEPTION 'Existing booking date unique/exclusion object requires explicit compatibility review; nothing was removed';
  END IF;
  -- Missing caterer/date on committed rows cannot be safely capacity-checked.
  IF EXISTS (SELECT 1 FROM public.bookings WHERE status::text IN ('confirmed','awaiting_payment','paid','ongoing','completed')
      AND (caterer_id IS NULL OR event_date IS NULL OR NOT isfinite(event_date))) THEN
    RAISE EXCEPTION 'Invalid legacy committed booking keys require a reviewed data plan';
  END IF;
  INSERT INTO cc_availability1_private.backup
    (singleton,original_definition,original_oid,original_owner,original_acl,original_config,
     original_index_oid,original_index_name,original_index_definition,original_index_comment,original_index_owner)
    VALUES(true,pg_get_functiondef(f.oid),f.oid,f.proowner,f.proacl,f.proconfig,
      i.indexrelid,'bookings_unique_active_caterer_date',i.definition,i.comment,i.relowner);
END;
$preflight$;

ALTER TABLE public.caterers ADD COLUMN max_bookings_per_day integer NOT NULL DEFAULT 1
  CONSTRAINT cc_availability1_positive_capacity CHECK (max_bookings_per_day > 0);
-- Safe legacy strategy: do not reject or rewrite existing bookings. Only
-- caterers with >1 future commitments on a date get an elevated initial limit.
-- Completed rows are counted too, including future-dated completed records.
WITH peaks AS (
  SELECT caterer_id,max(n)::integer AS capacity FROM (
    SELECT caterer_id,event_date,count(*) AS n FROM public.bookings
    WHERE status::text IN ('confirmed','awaiting_payment','paid','ongoing','completed')
      AND event_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date
    GROUP BY caterer_id,event_date
  ) daily GROUP BY caterer_id
)
UPDATE public.caterers c SET max_bookings_per_day=greatest(1,peaks.capacity)
FROM peaks WHERE c.id=peaks.caterer_id AND peaks.capacity>1;
CREATE TABLE cc_availability1_private.initial_capacities (
  caterer_id uuid PRIMARY KEY REFERENCES public.caterers(id) ON DELETE CASCADE,
  capacity integer NOT NULL
);
REVOKE ALL ON cc_availability1_private.initial_capacities FROM PUBLIC, anon, authenticated;
INSERT INTO cc_availability1_private.initial_capacities SELECT id,max_bookings_per_day FROM public.caterers;

CREATE TABLE public.caterer_blocked_dates (
  caterer_id uuid NOT NULL REFERENCES public.caterers(id) ON DELETE CASCADE,
  event_date date NOT NULL CHECK (isfinite(event_date)),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(caterer_id,event_date)
);
ALTER TABLE public.caterer_blocked_dates OWNER TO postgres;
ALTER TABLE public.caterer_blocked_dates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.caterer_blocked_dates FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,DELETE ON public.caterer_blocked_dates TO authenticated;
-- Existing table-wide grants are not revoked. Trigger below protects capacity
-- even if authenticated already has table UPDATE. Ordinary edits are unchanged.
GRANT SELECT(max_bookings_per_day),UPDATE(max_bookings_per_day) ON public.caterers TO authenticated;

CREATE FUNCTION public.cc_availability1_owns_caterer(p_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS(SELECT 1 FROM public.caterers WHERE id=p_id AND user_id=auth.uid());
$$;
ALTER FUNCTION public.cc_availability1_owns_caterer(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.cc_availability1_owns_caterer(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cc_availability1_owns_caterer(uuid) TO authenticated;
CREATE POLICY cc_availability1_block_read ON public.caterer_blocked_dates FOR SELECT TO authenticated
  USING(public.cc_availability1_owns_caterer(caterer_id));
CREATE POLICY cc_availability1_block_insert ON public.caterer_blocked_dates FOR INSERT TO authenticated
  WITH CHECK(public.cc_availability1_owns_caterer(caterer_id));
CREATE POLICY cc_availability1_block_delete ON public.caterer_blocked_dates FOR DELETE TO authenticated
  USING(public.cc_availability1_owns_caterer(caterer_id));

CREATE FUNCTION public.cc_availability1_booking_guard() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE committed boolean; acquiring boolean; requesting boolean; capacity integer; occupied bigint;
BEGIN
  committed := NEW.status::text IN ('confirmed','awaiting_payment','paid','ongoing','completed');
  IF TG_OP='INSERT' THEN
    acquiring := committed;
    requesting := NEW.status::text='pending';
  ELSE
    acquiring := committed AND (OLD.status::text NOT IN ('confirmed','awaiting_payment','paid','ongoing','completed')
      OR OLD.status IS NULL OR NEW.caterer_id IS DISTINCT FROM OLD.caterer_id
      OR NEW.event_date IS DISTINCT FROM OLD.event_date);
    requesting := NEW.status::text='pending' AND (OLD.status IS DISTINCT FROM NEW.status
      OR NEW.caterer_id IS DISTINCT FROM OLD.caterer_id OR NEW.event_date IS DISTINCT FROM OLD.event_date);
  END IF;
  IF NOT coalesce(acquiring,false) AND NOT coalesce(requesting,false) THEN RETURN NEW; END IF;
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Availability-changing bookings require READ COMMITTED' USING ERRCODE='55000';
  END IF;
  IF NEW.caterer_id IS NULL OR NEW.event_date IS NULL OR NOT isfinite(NEW.event_date) THEN
    RAISE EXCEPTION 'A caterer and valid event date are required' USING ERRCODE='23514';
  END IF;
  -- This is the serialization point, NOT the outer booking UPDATE snapshot.
  -- NO KEY UPDATE conflicts with another acquisition/capacity UPDATE, but
  -- coexists with the FK's KEY SHARE. Hold it to transaction end. The count
  -- MUST remain a separate SQL command after this lock in a VOLATILE function:
  -- a combined CTE/query could retain the pre-wait snapshot and overbook.
  SELECT max_bookings_per_day INTO capacity FROM public.caterers
    WHERE id=NEW.caterer_id FOR NO KEY UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Caterer unavailable' USING ERRCODE='23503'; END IF;
  IF EXISTS(SELECT 1 FROM public.caterer_blocked_dates WHERE caterer_id=NEW.caterer_id AND event_date=NEW.event_date) THEN
    RAISE EXCEPTION 'This event date is blocked. Please choose another date.' USING ERRCODE='23514';
  END IF;
  -- AFTER-row trigger: NEW is already in the count if it is committed. Pending
  -- requests do not reserve a slot, but cannot be created on a currently full day.
  SELECT count(*) INTO occupied FROM public.bookings WHERE caterer_id=NEW.caterer_id
    AND event_date=NEW.event_date AND status::text IN ('confirmed','awaiting_payment','paid','ongoing','completed');
  IF (coalesce(acquiring,false) AND occupied>capacity)
    OR (coalesce(requesting,false) AND occupied>=capacity) THEN
    RAISE EXCEPTION 'This event date has reached the caterer daily booking limit. Please choose another date.' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER cc_availability1_booking_guard AFTER INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.cc_availability1_booking_guard();

CREATE FUNCTION public.cc_availability1_capacity_guard() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.max_bookings_per_day=1 THEN RETURN NEW; END IF;
    IF auth.uid() IS NULL OR NEW.user_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Only the caterer owner can configure daily capacity' USING ERRCODE='42501';
    END IF;
  ELSE
    IF NEW.max_bookings_per_day IS NOT DISTINCT FROM OLD.max_bookings_per_day THEN RETURN NEW; END IF;
    IF auth.uid() IS NULL OR OLD.user_id IS DISTINCT FROM auth.uid() OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Only the existing caterer owner can configure daily capacity' USING ERRCODE='42501';
    END IF;
  END IF;
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Capacity changes require READ COMMITTED' USING ERRCODE='55000';
  END IF;
  -- The UPDATE already holds the same caterer-row lock used by booking checks.
  -- No postgres/admin/JWT-role exemption: admin maintenance must use an actual
  -- owner-authorized operation, or a separately reviewed narrow maintenance
  -- interface retaining these locks/count checks. Do not spoof JWT claims,
  -- disable triggers or grant a generic definer table writer for maintenance.
  IF EXISTS(SELECT 1 FROM public.bookings WHERE caterer_id=NEW.id
      AND event_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date
      AND status::text IN ('confirmed','awaiting_payment','paid','ongoing','completed')
      GROUP BY event_date HAVING count(*)>NEW.max_bookings_per_day) THEN
    RAISE EXCEPTION 'Daily capacity cannot be lower than existing commitments on a future event date.' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER cc_availability1_capacity_guard AFTER INSERT OR UPDATE ON public.caterers
  FOR EACH ROW EXECUTE FUNCTION public.cc_availability1_capacity_guard();

CREATE FUNCTION public.cc_availability1_block_guard() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE target uuid; owner_id uuid;
BEGIN
  IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Blocked dates are immutable; remove and add a date instead' USING ERRCODE='23514'; END IF;
  IF TG_OP='DELETE' THEN target:=OLD.caterer_id; ELSE target:=NEW.caterer_id; END IF;
  SELECT user_id INTO owner_id FROM public.caterers WHERE id=target FOR NO KEY UPDATE;
  -- Native ON DELETE CASCADE runs after the parent row's deletion, visible to
  -- this transaction. Unblocking cannot acquire capacity, and has no surviving
  -- owner to authorize in that case. Allow only DELETE when parent is absent;
  -- INSERT still fails. This is not a current_user/trigger-depth/auth-null bypass.
  -- If parent remains (including manual child-first cleanup), strict owner
  -- authorization below still applies. Do not silently exempt admin callers.
  IF NOT FOUND AND TG_OP='DELETE' THEN RETURN OLD; END IF;
  IF NOT FOUND OR auth.uid() IS NULL OR owner_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Only the caterer owner can change blocked dates' USING ERRCODE='42501';
  END IF;
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Calendar changes require READ COMMITTED' USING ERRCODE='55000';
  END IF;
  IF TG_OP='INSERT' THEN NEW.created_at:=now(); RETURN NEW; END IF;
  RETURN OLD;
END;
$$;
CREATE TRIGGER cc_availability1_block_guard BEFORE INSERT OR UPDATE OR DELETE ON public.caterer_blocked_dates
  FOR EACH ROW EXECUTE FUNCTION public.cc_availability1_block_guard();

-- Preserve signature and row shape; CREATE OR REPLACE retains owner and ACLs.
-- Explicit return-shape preflight is mandatory: no DROP FUNCTION workaround.
CREATE OR REPLACE FUNCTION public.get_caterer_unavailable_dates(p_caterer_id uuid)
RETURNS TABLE(event_date date) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT blocked.event_date FROM public.caterer_blocked_dates blocked
  WHERE blocked.caterer_id=p_caterer_id
    AND blocked.event_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date
  UNION
  SELECT b.event_date FROM public.bookings b JOIN public.caterers c ON c.id=b.caterer_id
  WHERE b.caterer_id=p_caterer_id
    AND b.event_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date
    AND b.status::text IN ('confirmed','awaiting_payment','paid','ongoing','completed')
  GROUP BY b.event_date,c.max_bookings_per_day HAVING count(*)>=c.max_bookings_per_day;
$$;
DO $acl$
DECLARE signature text;
BEGIN
  FOREACH signature IN ARRAY ARRAY['public.cc_availability1_booking_guard()',
    'public.cc_availability1_capacity_guard()','public.cc_availability1_block_guard()'] LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres',signature);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',signature);
  END LOOP;
  IF EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN cc_availability1_private.backup b
      WHERE p.oid='public.get_caterer_unavailable_dates(uuid)'::regprocedure
        AND (p.oid IS DISTINCT FROM b.original_oid OR p.proowner IS DISTINCT FROM b.original_owner
          OR p.proacl IS DISTINCT FROM b.original_acl OR p.proconfig IS DISTINCT FROM b.original_config)) THEN
    RAISE EXCEPTION 'Original availability function identity/ownership/ACL/config changed: review exact replacement';
  END IF;
  UPDATE cc_availability1_private.backup SET installed_definition=
    pg_get_functiondef('public.get_caterer_unavailable_dates(uuid)'::regprocedure) WHERE singleton;
END;
$acl$;

-- Preserve a date lookup path when replacing uniqueness with capacity counting.
-- This adds no booking uniqueness rule and does not change booking data.
CREATE INDEX cc_availability1_booking_date_lookup ON public.bookings(caterer_id,event_date);
DO $cutover$
DECLARE g record; t record; saved cc_availability1_private.backup;
BEGIN
  -- Installation verification only; actual behavior/concurrency requires the
  -- approved staging matrix. Never use this catalog check as a runtime claim.
  FOR g IN SELECT * FROM (VALUES
    ('public.bookings'::regclass,'cc_availability1_booking_guard',
      'public.cc_availability1_booking_guard()'::regprocedure,21),
    ('public.caterers'::regclass,'cc_availability1_capacity_guard',
      'public.cc_availability1_capacity_guard()'::regprocedure,21),
    ('public.caterer_blocked_dates'::regclass,'cc_availability1_block_guard',
      'public.cc_availability1_block_guard()'::regprocedure,31)
  ) AS guards(relation,name,function_oid,event_bits) LOOP
    SELECT * INTO STRICT t FROM pg_trigger WHERE tgrelid=g.relation AND tgname=g.name;
    IF t.tgfoid<>g.function_oid OR t.tgtype<>g.event_bits OR t.tgenabled<>'O'
      OR t.tgisinternal OR t.tgconstraint<>0 OR t.tgqual IS NOT NULL
      OR t.tgnargs<>0 OR NOT EXISTS (
        SELECT 1 FROM pg_proc WHERE oid=g.function_oid AND prosecdef AND provolatile='v'
          AND pg_get_userbyid(proowner)='postgres' AND proconfig=ARRAY['search_path=""']
      ) OR has_function_privilege('authenticated',g.function_oid,'EXECUTE')
        OR has_function_privilege('anon',g.function_oid,'EXECUTE') THEN
      RAISE EXCEPTION 'Capacity guard installation/privileges differ: refusing index removal';
    END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM public.bookings b JOIN public.caterers c ON c.id=b.caterer_id
    WHERE b.event_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date
      AND b.status::text IN ('confirmed','awaiting_payment','paid','ongoing','completed')
    GROUP BY b.caterer_id,b.event_date,c.max_bookings_per_day
    HAVING count(*)>c.max_bookings_per_day) THEN
    RAISE EXCEPTION 'Future commitments exceed initialized daily capacity';
  END IF;
  SELECT * INTO STRICT saved FROM cc_availability1_private.backup WHERE singleton;
  IF to_regclass('public.bookings_unique_active_caterer_date') IS DISTINCT FROM saved.original_index_oid
    OR pg_get_indexdef(saved.original_index_oid) IS DISTINCT FROM saved.original_index_definition THEN
    RAISE EXCEPTION 'Original active-date index drifted before cutover';
  END IF;
END;
$cutover$;
-- NOT CONCURRENTLY: ordinary transactional DDL under ACCESS EXCLUSIVE locks.
-- RESTRICT refuses tracked dependencies. All existing objects/DDL are restored
-- automatically if this drop or any subsequent statement/COMMIT fails.
DROP INDEX public.bookings_unique_active_caterer_date RESTRICT;
COMMIT;
-- No user/bookings are deleted; only the new capacity field is initialized.
-- Count/delete races can conservatively reject a concurrent operation; retry
-- after commit. Deadlocks/serialization errors require whole-request retry.
-- TRUNCATE, disabled triggers, replica session modes, owner rewrites, generic
-- privileged SQL and unreviewed triggers are outside this guard's trust boundary.
