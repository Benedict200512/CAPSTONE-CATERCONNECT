-- MATCHING AVAILABILITY ROLLBACK -- PROPOSAL ONLY / NOT EXECUTED.
-- Never append to forward. Requires new forward's intact private backup.
-- Disable availability UI/drain writers first. Rollback restores old date
-- exclusion behavior (one committed booking made a date unavailable).
BEGIN;
DO $$ BEGIN
  RAISE EXCEPTION 'PROPOSAL ONLY: availability rollback requires separate explicit approval';
END $$;
LOCK TABLE public.caterers, public.bookings, public.caterer_blocked_dates IN ACCESS EXCLUSIVE MODE;
DO $restore$
DECLARE saved cc_availability1_private.backup;
BEGIN
  IF current_user<>'postgres' THEN RAISE EXCEPTION 'Reviewed maintenance role required'; END IF;
  SELECT * INTO STRICT saved FROM cc_availability1_private.backup WHERE singleton;
  -- Recreate exactly the ORIGINAL three-status uniqueness rule, for ALL dates.
  -- awaiting_payment/completed count for capacity but were not indexed by this
  -- legacy predicate. Default unique-index NULL keys do not conflict.
  IF EXISTS(SELECT 1 FROM public.bookings
    WHERE status::text IN ('confirmed','paid','ongoing')
      AND caterer_id IS NOT NULL AND event_date IS NOT NULL
    GROUP BY caterer_id,event_date HAVING count(*)>1) THEN
    RAISE EXCEPTION 'Cannot restore original active-date unique index: multiple active bookings share a caterer/date. Keep capacity enforcement and use a reviewed forward fix; no bookings were changed';
  END IF;
  IF to_regclass('public.bookings_unique_active_caterer_date') IS NOT NULL THEN
    RAISE EXCEPTION 'Original index name is occupied: inspect instead of overwriting';
  END IF;
  IF (SELECT relowner FROM pg_class WHERE oid='public.bookings'::regclass)
      IS DISTINCT FROM saved.original_index_owner THEN
    RAISE EXCEPTION 'Bookings owner drifted; index ownership restoration needs review';
  END IF;
  -- No blanket data deletion: user-created calendar settings require an
  -- approved retention/forward-fix plan, not automatic DROP TABLE cleanup.
  IF EXISTS(SELECT 1 FROM public.caterer_blocked_dates) THEN
    RAISE EXCEPTION 'Blocked-date history exists: retain settings and use a forward correction';
  END IF;
  IF EXISTS(SELECT 1 FROM public.caterers c
      LEFT JOIN cc_availability1_private.initial_capacities i ON i.caterer_id=c.id
      WHERE c.max_bookings_per_day IS DISTINCT FROM coalesce(i.capacity,1)) THEN
    RAISE EXCEPTION 'Capacity settings changed: review retention before rollback';
  END IF;
  IF saved.installed_definition IS NULL
    OR pg_get_functiondef('public.get_caterer_unavailable_dates(uuid)'::regprocedure) IS DISTINCT FROM saved.installed_definition
    OR EXISTS(SELECT 1 FROM pg_proc WHERE oid='public.get_caterer_unavailable_dates(uuid)'::regprocedure
      AND (oid IS DISTINCT FROM saved.original_oid OR proowner IS DISTINCT FROM saved.original_owner
        OR proacl IS DISTINCT FROM saved.original_acl OR proconfig IS DISTINCT FROM saved.original_config)) THEN
    RAISE EXCEPTION 'Availability RPC drifted: inspect instead of overwriting';
  END IF;
  -- Existing capacity guards remain installed; ACCESS EXCLUSIVE blocks writers.
  -- Build original uniqueness before removing any replacement enforcement.
  -- CREATE UNIQUE INDEX itself is the final authority on restoration validity.
  -- Never use CONCURRENTLY, IF NOT EXISTS or data cleanup to force restoration.
  EXECUTE saved.original_index_definition;
  EXECUTE format('COMMENT ON INDEX public.%I IS %L',saved.original_index_name,saved.original_index_comment);
  IF pg_get_indexdef('public.bookings_unique_active_caterer_date'::regclass)
      IS DISTINCT FROM saved.original_index_definition
    OR obj_description('public.bookings_unique_active_caterer_date'::regclass,'pg_class')
      IS DISTINCT FROM saved.original_index_comment
    OR NOT EXISTS(SELECT 1 FROM pg_index x JOIN pg_class c ON c.oid=x.indexrelid
      WHERE x.indexrelid='public.bookings_unique_active_caterer_date'::regclass
        AND x.indisunique AND x.indisvalid AND x.indisready AND c.relowner=saved.original_index_owner) THEN
    RAISE EXCEPTION 'Original active-date index was not restored exactly';
  END IF;
  EXECUTE saved.original_definition;
  IF pg_get_functiondef('public.get_caterer_unavailable_dates(uuid)'::regprocedure)
      IS DISTINCT FROM saved.original_definition OR EXISTS (
    SELECT 1 FROM pg_proc WHERE oid='public.get_caterer_unavailable_dates(uuid)'::regprocedure
      AND (oid IS DISTINCT FROM saved.original_oid OR proowner IS DISTINCT FROM saved.original_owner
        OR proacl IS DISTINCT FROM saved.original_acl OR proconfig IS DISTINCT FROM saved.original_config)
  ) THEN RAISE EXCEPTION 'Original availability function was not restored exactly'; END IF;
END;
$restore$;
DROP TRIGGER cc_availability1_booking_guard ON public.bookings;
DROP TRIGGER cc_availability1_capacity_guard ON public.caterers;
DROP TRIGGER cc_availability1_block_guard ON public.caterer_blocked_dates;
DROP POLICY cc_availability1_block_read ON public.caterer_blocked_dates;
DROP POLICY cc_availability1_block_insert ON public.caterer_blocked_dates;
DROP POLICY cc_availability1_block_delete ON public.caterer_blocked_dates;
DROP FUNCTION public.cc_availability1_booking_guard() RESTRICT;
DROP FUNCTION public.cc_availability1_capacity_guard() RESTRICT;
DROP FUNCTION public.cc_availability1_block_guard() RESTRICT;
DROP FUNCTION public.cc_availability1_owns_caterer(uuid) RESTRICT;
DROP INDEX public.cc_availability1_booking_date_lookup RESTRICT;
DROP TABLE public.caterer_blocked_dates RESTRICT;
ALTER TABLE public.caterers DROP COLUMN max_bookings_per_day RESTRICT;
DROP TABLE cc_availability1_private.initial_capacities RESTRICT;
DROP TABLE cc_availability1_private.backup RESTRICT;
DROP SCHEMA cc_availability1_private RESTRICT;
COMMIT;
-- New table PK/FKs and capacity CHECK/default/column grants disappear with
-- their owning new objects. No original grants/policies/triggers are dropped.
-- Bookings, monthly limits, payments, notifications and audit rows remain.
-- The only original index removed forward is restored by its saved exact DDL,
-- name and comment before guards are dropped. Its recreated OID will differ.
-- Any failure (including a dependent-object refusal later) rolls this entire
-- rollback back, leaving the pre-rollback capacity enforcement intact.
-- Empty-settings rollback does not undo bookings created after deployment.
-- New clients must not call removed objects. Prefer forward correction after
-- rollout; a separate approved archive/removal plan is needed for saved settings.
-- RESTRICT protects tracked dependencies, not every quoted SQL/PLpgSQL body or
-- application caller. Inventory those before rollback; never add CASCADE.
-- Restore original RPC before dropping its replacement's referenced objects;
-- remove triggers/policies before their functions. Any later failure rolls back
-- this whole transaction, including the RPC restoration.
-- Snapshot original catalogs before forward and compare before rollback. This
-- draft detects RPC drift; it does NOT certify unchanged new guards/policies or
-- erase a feature's historical usage merely because current settings are empty.
-- Prefer forward fix once in use: drain writers, preserve calendar/settings,
-- re-audit existing constraints and narrowly replace only the faulty guard/RPC
-- in a separately approved transaction with its own backup and verification.
-- Old RPC excludes only confirmed/paid/ongoing. Restoring it also restores that
-- legacy treatment of completed/awaiting_payment; approve client compatibility.
