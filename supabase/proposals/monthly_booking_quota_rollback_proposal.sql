-- MATCHING MONTHLY QUOTA ROLLBACK -- PROPOSAL ONLY. NOT EXECUTED/TESTED.
-- Run separately only after explicit approval and dependency inspection.
-- Safe removal is limited to unused installations with intact snapshots.
BEGIN;
DO $$ BEGIN
  RAISE EXCEPTION 'PROPOSAL ONLY: monthly quota rollback needs separate explicit approval';
END $$;
LOCK TABLE public.caterers, public.bookings IN ACCESS EXCLUSIVE MODE;
DO $review$
DECLARE saved cc_monthly1_private.backup; installed jsonb;
BEGIN
  IF current_user<>'postgres' THEN RAISE EXCEPTION 'Reviewed maintenance role required'; END IF;
  SELECT * INTO STRICT saved FROM cc_monthly1_private.backup WHERE singleton;
  IF EXISTS(SELECT 1 FROM cc_monthly1_private.touched_bookings) THEN
    RAISE EXCEPTION 'Post-install booking activity exists: preserve quota history and use a reviewed forward fix';
  END IF;
  IF EXISTS(SELECT 1 FROM public.caterers c FULL JOIN cc_monthly1_private.caterer_snapshot s
    ON s.caterer_id=c.id WHERE c.id IS NULL OR s.caterer_id IS NULL
      OR s.installed_cache IS DISTINCT FROM jsonb_build_object(
        'monthly_booking_count',c.monthly_booking_count,'booking_count_reset_at',c.booking_count_reset_at)) THEN
    RAISE EXCEPTION 'Caterer/cache snapshot drift: refuse stale counter restoration';
  END IF;
  IF EXISTS(SELECT 1 FROM public.bookings b FULL JOIN cc_monthly1_private.legacy_month_map m
    ON m.booking_id=b.id WHERE b.id IS NULL OR b.quota_month IS DISTINCT FROM m.quota_month) THEN
    RAISE EXCEPTION 'Quota assignments drifted; retain history';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.bookings'::regclass
    AND tgname='on_booking_created_increment_count') THEN
    RAISE EXCEPTION 'Original trigger name occupied: inspect instead of overwriting';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=saved.function_oid
    AND p.oid='public.handle_new_booking_count()'::regprocedure
    AND pg_get_functiondef(p.oid)=saved.function_definition
    AND p.proowner=saved.function_owner AND p.proacl IS NOT DISTINCT FROM saved.function_acl
    AND p.proconfig IS NOT DISTINCT FROM saved.function_config) THEN
    RAISE EXCEPTION 'Original counter function drifted; do not overwrite later work';
  END IF;
  SELECT jsonb_build_object(
    'functions',(SELECT jsonb_object_agg(p.oid::text,pg_get_functiondef(p.oid))
      FROM pg_proc p WHERE p.oid IN ('public.cc_monthly1_limit(text,timestamptz)'::regprocedure,
        'public.cc_monthly1_stamp_booking()'::regprocedure,'public.cc_monthly1_check_booking()'::regprocedure,
        'public.cc_monthly1_guard_cache()'::regprocedure)),
    'triggers',(SELECT jsonb_object_agg(t.tgname,pg_get_triggerdef(t.oid,true))
      FROM pg_trigger t WHERE (t.tgrelid='public.bookings'::regclass AND t.tgname IN
        ('cc_monthly1_stamp_booking','cc_monthly1_check_booking'))
        OR (t.tgrelid='public.caterers'::regclass AND t.tgname='cc_monthly1_guard_cache'))
  ) INTO installed;
  IF saved.installed_definitions IS NULL OR installed IS DISTINCT FROM saved.installed_definitions
    OR EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid IN
      ('public.cc_monthly1_limit(text,timestamptz)'::regprocedure,'public.cc_monthly1_stamp_booking()'::regprocedure,
       'public.cc_monthly1_check_booking()'::regprocedure,'public.cc_monthly1_guard_cache()'::regprocedure)
      AND (pg_get_userbyid(p.proowner)<>'postgres'
        OR has_function_privilege('authenticated',p.oid,'EXECUTE')
        OR has_function_privilege('anon',p.oid,'EXECUTE')))
    OR EXISTS(SELECT 1 FROM pg_trigger WHERE tgname IN
      ('cc_monthly1_stamp_booking','cc_monthly1_check_booking','cc_monthly1_guard_cache')
      AND tgrelid IN ('public.bookings'::regclass,'public.caterers'::regclass) AND tgenabled<>'O') THEN
    RAISE EXCEPTION 'Monthly guards drifted: review a forward correction';
  END IF;
END;
$review$;

DROP TRIGGER cc_monthly1_stamp_booking ON public.bookings RESTRICT;
DROP TRIGGER cc_monthly1_check_booking ON public.bookings RESTRICT;
-- Must remove this projection guard BEFORE restoring the old cached values.
DROP TRIGGER cc_monthly1_guard_cache ON public.caterers RESTRICT;
DO $restore$
DECLARE saved cc_monthly1_private.backup;
BEGIN
  SELECT * INTO STRICT saved FROM cc_monthly1_private.backup WHERE singleton;
  EXECUTE saved.trigger_definition;
  EXECUTE format('COMMENT ON TRIGGER on_booking_created_increment_count ON public.bookings IS %L',saved.trigger_comment);
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.bookings'::regclass
    AND tgname='on_booking_created_increment_count' AND tgenabled='O'
    AND pg_get_triggerdef(oid,true)=saved.trigger_definition
    AND obj_description(oid,'pg_trigger') IS NOT DISTINCT FROM saved.trigger_comment) THEN
    RAISE EXCEPTION 'Original counter trigger restoration differs';
  END IF;
END;
$restore$;
-- Forward never changes the legacy reset timestamp. Drift was checked above;
-- do not target that column and unnecessarily invoke UPDATE OF reset triggers.
UPDATE public.caterers c SET monthly_booking_count=r.monthly_booking_count
FROM cc_monthly1_private.caterer_snapshot s
CROSS JOIN LATERAL jsonb_populate_record(NULL::public.caterers,s.original_cache) r
WHERE c.id=s.caterer_id;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.caterers c JOIN cc_monthly1_private.caterer_snapshot s ON s.caterer_id=c.id
    WHERE s.original_cache IS DISTINCT FROM jsonb_build_object(
      'monthly_booking_count',c.monthly_booking_count,'booking_count_reset_at',c.booking_count_reset_at)) THEN
    RAISE EXCEPTION 'Original counter cache was not restored exactly';
  END IF;
END $$;
-- Drop callers before callees, triggers already detached. No CASCADE.
DROP FUNCTION public.cc_monthly1_check_booking() RESTRICT;
DROP FUNCTION public.cc_monthly1_stamp_booking() RESTRICT;
DROP FUNCTION public.cc_monthly1_guard_cache() RESTRICT;
DROP FUNCTION public.cc_monthly1_limit(text,timestamptz) RESTRICT;
DROP INDEX public.cc_monthly1_booking_period RESTRICT;
ALTER TABLE public.bookings DROP COLUMN quota_month RESTRICT;
DROP TABLE cc_monthly1_private.touched_bookings RESTRICT;
DROP TABLE cc_monthly1_private.legacy_month_map RESTRICT;
DROP TABLE cc_monthly1_private.caterer_snapshot RESTRICT;
DROP TABLE cc_monthly1_private.backup RESTRICT;
DROP SCHEMA cc_monthly1_private RESTRICT;
COMMIT;
-- No original booking/payment records are deleted; only unused proposed quota
-- metadata is removed. All failures roll back the entire rollback transaction.
-- Existing legacy trigger function/owner/ACL/config remain untouched.
-- Old INSERT-count semantics return, including their known limitations.
-- Daily Availability objects are not removed/restored by this rollback.
-- pg_depend/RESTRICT cannot discover every quoted function body or app caller;
-- inspect them before removal. New grants/ACLs and caches need catalog comparison.
-- Once quota accounting has been used, retain assignments and correct forward;
-- never erase activity markers or edit bookings simply to pass this rollback.
