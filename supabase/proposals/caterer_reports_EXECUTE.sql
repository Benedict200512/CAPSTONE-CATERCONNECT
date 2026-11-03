-- Phase 5 read-only reports. PROPOSAL ONLY: no live installation authorized.
BEGIN;
DO $preflight$
BEGIN
  IF current_user<>'postgres' OR NOT EXISTS(SELECT 1 FROM pg_roles
    WHERE rolname=current_user AND (rolsuper OR rolbypassrls)) THEN
    RAISE EXCEPTION 'Verified postgres maintenance role required';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace
    AND proname='get_caterer_reports') THEN
    RAISE EXCEPTION 'Reports RPC collision: inspect instead of replacing';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.bookings'::regclass
    AND attname='created_at' AND atttypid='timestamptz'::regtype AND NOT attisdropped)
    OR NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.bookings'::regclass
    AND attname='total_cost' AND atttypid='numeric'::regtype AND NOT attisdropped)
    OR NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.bookings'::regclass
    AND attname='refund_amount' AND atttypid='numeric'::regtype AND NOT attisdropped) THEN
    RAISE EXCEPTION 'Reviewed booking timestamp/amount types differ';
  END IF;
END;
$preflight$;

CREATE FUNCTION public.get_caterer_reports(p_start date,p_end date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); target uuid; report jsonb;
BEGIN
  IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles p
    WHERE p.id=actor AND p.role='caterer') THEN
    RAISE EXCEPTION 'Caterer reports require your own caterer account' USING ERRCODE='42501';
  END IF;
  SELECT c.id INTO target FROM public.caterers c WHERE c.user_id=actor;
  IF target IS NULL THEN
    RAISE EXCEPTION 'Caterer reports require your own caterer account' USING ERRCODE='42501';
  END IF;
  IF p_start IS NULL OR p_end IS NULL OR NOT isfinite(p_start) OR NOT isfinite(p_end)
    OR p_start<DATE '1900-01-01' OR p_end>DATE '9999-12-31'
    OR p_end<p_start OR p_end-p_start>365 THEN
    RAISE EXCEPTION 'Choose a valid inclusive date range of at most 366 days' USING ERRCODE='22023';
  END IF;
  -- One statement snapshot, one row per booking. No joins to callback/payment
  -- events, optimistic counters, private notes or customer identities.
  WITH scoped AS MATERIALIZED (
    SELECT b.id,b.package_id,b.status,b.created_at,b.total_cost,b.refund_status,b.refund_amount
    FROM public.bookings b WHERE b.caterer_id=target
      AND b.created_at >= (p_start::timestamp AT TIME ZONE 'Asia/Manila')
      AND b.created_at < ((p_end+1)::timestamp AT TIME ZONE 'Asia/Manila')
  ), status_counts AS (
    SELECT s.status,count(b.id) AS n
    FROM unnest(ARRAY['pending','confirmed','awaiting_payment','paid','ongoing','completed','rejected','cancelled']) s(status)
    LEFT JOIN scoped b ON b.status=s.status GROUP BY s.status
  ), months AS (
    SELECT m::date AS month FROM generate_series(date_trunc('month',p_start::timestamp),
      date_trunc('month',p_end::timestamp),interval '1 month') m
  ), monthly AS (
    SELECT date_trunc('month',b.created_at AT TIME ZONE 'Asia/Manila')::date AS month,count(*) AS n
    FROM scoped b GROUP BY 1
  ), ranked AS (
    SELECT b.package_id,coalesce(p.name,'Package unavailable') AS name,count(*) AS n
    FROM scoped b LEFT JOIN public.packages p ON p.id=b.package_id AND p.caterer_id=target
    GROUP BY b.package_id,p.name ORDER BY count(*) DESC,coalesce(p.name,'Package unavailable'),b.package_id NULLS LAST LIMIT 10
  ), expected AS (
    SELECT CASE WHEN count(*) FILTER(WHERE total_cost IS NULL OR total_cost<0
        OR total_cost::text IN ('NaN','Infinity','-Infinity'))>0 THEN NULL
      ELSE round(coalesce(sum(total_cost),0),2)::text END AS amount
    FROM scoped WHERE status IN ('confirmed','awaiting_payment','paid','ongoing','completed')
  ), obligations AS (
    SELECT CASE WHEN count(*) FILTER(WHERE refund_amount IS NULL OR refund_amount<0
        OR refund_amount::text IN ('NaN','Infinity','-Infinity'))>0 THEN NULL
      ELSE round(coalesce(sum(refund_amount),0),2)::text END AS amount,count(*) AS n
    FROM scoped WHERE status='cancelled'
      AND refund_status IN ('pending','overdue','awaiting_customer_confirmation')
  )
  SELECT jsonb_build_object(
    'start',p_start::text,'end',p_end::text,'timezone','Asia/Manila','date_basis','booking_created_at',
    'total',(SELECT count(*) FROM scoped),
    'statuses',(SELECT jsonb_object_agg(status,n) FROM status_counts),
    'months',(SELECT jsonb_agg(jsonb_build_object('month',m.month::text,'count',coalesce(b.n,0)) ORDER BY m.month)
      FROM months m LEFT JOIN monthly b ON b.month=m.month),
    'packages',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',package_id,'name',name,'count',n)
      ORDER BY n DESC,name,package_id NULLS LAST),'[]'::jsonb) FROM ranked),
    'expected_value',(SELECT amount FROM expected),
    'refund_obligations',(SELECT amount FROM obligations),
    'refund_obligation_count',(SELECT n FROM obligations),
    'open_refund_disputes',(SELECT count(*) FROM scoped b WHERE EXISTS(
      SELECT 1 FROM public.refund_disputes d WHERE d.booking_id=b.id AND d.status IN ('open','investigating'))),
    'actual_payments',NULL,'settled_refunds',NULL,
    'financial_evidence','unavailable',
    'undated_bookings',(SELECT count(*) FROM public.bookings b WHERE b.caterer_id=target AND b.created_at IS NULL)
  ) INTO report;
  RETURN report;
END;
$$;
ALTER FUNCTION public.get_caterer_reports(date,date) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_caterer_reports(date,date) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_caterer_reports(date,date) TO authenticated;
DO $verify$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid='public.get_caterer_reports(date,date)'::regprocedure
    AND p.prosecdef AND p.provolatile='s' AND p.proconfig=ARRAY['search_path=""']
    AND pg_get_userbyid(p.proowner)='postgres')
    OR has_function_privilege('anon','public.get_caterer_reports(date,date)','EXECUTE')
    OR has_function_privilege('service_role','public.get_caterer_reports(date,date)','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.get_caterer_reports(date,date)','EXECUTE') THEN
    RAISE EXCEPTION 'Report RPC security differs from reviewed installation';
  END IF;
END;
$verify$;
COMMIT;
-- No table, row, policy, trigger, payment writer or subscription is changed.
-- Rollout: approve/install this proposal separately, then release mobile.
-- Mitigation: hide the new report route if needed. A separately reviewed
-- DROP FUNCTION public.get_caterer_reports(date,date) RESTRICT can remove only
-- this read-only API; no historical data needs rollback. Never use CASCADE.
