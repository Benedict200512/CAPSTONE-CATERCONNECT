-- Phase 4: PRIVATE operational notes. REVIEW PROPOSAL ONLY; not installed.
-- bookings.caterer_notes is an existing CUSTOMER-VISIBLE message, not private.
-- Keep it and its historical contents unchanged. No booking projection changes.
BEGIN;
LOCK TABLE public.caterers, public.bookings IN SHARE ROW EXCLUSIVE MODE;
DO $preflight$
BEGIN
  IF current_user<>'postgres' OR NOT EXISTS(SELECT 1 FROM pg_roles
    WHERE rolname=current_user AND (rolsuper OR rolbypassrls)) THEN
    RAISE EXCEPTION 'Verified postgres maintenance role required';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.bookings'::regclass
    AND attname='caterer_notes' AND atttypid='text'::regtype AND NOT attisdropped) THEN
    RAISE EXCEPTION 'Reviewed customer-visible caterer_notes baseline differs';
  END IF;
  IF to_regnamespace('cc_booking_notes1_private') IS NOT NULL
    OR to_regprocedure('public.get_booking_internal_notes(uuid)') IS NOT NULL
    OR to_regprocedure('public.save_booking_internal_notes(uuid,text,bigint)') IS NOT NULL THEN
    RAISE EXCEPTION 'Internal notes installation collision: inspect instead of replacing';
  END IF;
END;
$preflight$;
CREATE SCHEMA cc_booking_notes1_private AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA cc_booking_notes1_private FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE cc_booking_notes1_private.catalog_snapshot AS
SELECT c.oid AS relation_id,c.relacl,c.relrowsecurity,c.relforcerowsecurity,
  (SELECT jsonb_agg(to_jsonb(p) ORDER BY p.polname) FROM pg_policy p WHERE p.polrelid=c.oid) AS policies,
  (SELECT jsonb_agg(jsonb_build_object('definition',pg_get_triggerdef(t.oid),
      'enabled',t.tgenabled,'function',pg_get_functiondef(t.tgfoid)) ORDER BY t.tgname)
    FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal) AS triggers
FROM pg_class c WHERE c.oid IN ('public.bookings'::regclass,'public.caterers'::regclass);
CREATE TABLE cc_booking_notes1_private.notes (
  booking_id uuid PRIMARY KEY REFERENCES public.bookings(id) ON DELETE CASCADE,
  note text NOT NULL CHECK(char_length(note)<=5000),
  revision bigint NOT NULL CHECK(revision>0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE cc_booking_notes1_private.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_booking_notes1_private.notes FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA cc_booking_notes1_private FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.get_booking_internal_notes(p_booking_id uuid)
RETURNS TABLE(note text,revision bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Only the assigned caterer can access internal notes' USING ERRCODE='42501';
  END IF;
  RETURN QUERY SELECT coalesce(n.note,''),coalesce(n.revision,0::bigint)
    FROM public.bookings b JOIN public.caterers c ON c.id=b.caterer_id
    LEFT JOIN cc_booking_notes1_private.notes n ON n.booking_id=b.id
    WHERE b.id=p_booking_id AND c.user_id=auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only the assigned caterer can access internal notes' USING ERRCODE='42501';
  END IF;
END;
$$;

CREATE FUNCTION public.save_booking_internal_notes(p_booking_id uuid,p_note text,p_expected_revision bigint)
RETURNS TABLE(note text,revision bigint)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); target uuid; owner_id uuid; previous bigint; result_note text; result_revision bigint;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Only the assigned caterer can access internal notes' USING ERRCODE='42501';
  END IF;
  IF p_expected_revision IS NULL OR p_expected_revision<0 OR char_length(coalesce(p_note,''))>5000 THEN
    RAISE EXCEPTION 'Internal notes must be at most 5000 characters with a valid revision' USING ERRCODE='22023';
  END IF;
  -- Lock the existing booking, then recheck its current owner. This writes no
  -- booking fields and fires none of its lifecycle/payment/quota triggers.
  SELECT b.caterer_id INTO target FROM public.bookings b
    WHERE b.id=p_booking_id AND EXISTS(SELECT 1 FROM public.caterers c
      WHERE c.id=b.caterer_id AND c.user_id=actor) FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only the assigned caterer can access internal notes' USING ERRCODE='42501';
  END IF;
  SELECT c.user_id INTO owner_id FROM public.caterers c WHERE c.id=target FOR SHARE;
  IF owner_id IS DISTINCT FROM actor THEN
    RAISE EXCEPTION 'Only the assigned caterer can access internal notes' USING ERRCODE='42501';
  END IF;
  SELECT n.revision INTO previous FROM cc_booking_notes1_private.notes n WHERE n.booking_id=p_booking_id;
  previous:=coalesce(previous,0);
  IF previous<>p_expected_revision THEN
    RAISE EXCEPTION 'Internal notes changed elsewhere. Reload the saved note before trying again.' USING ERRCODE='40001';
  END IF;
  -- Keep a revision even when cleared, so an older open editor cannot overwrite
  -- the clear. Preserve intentional newlines/indentation in nonblank notes.
  INSERT INTO cc_booking_notes1_private.notes AS saved(booking_id,note,revision)
    VALUES(p_booking_id,CASE WHEN btrim(coalesce(p_note,''))='' THEN '' ELSE p_note END,previous+1)
    ON CONFLICT(booking_id) DO UPDATE SET note=excluded.note,
      revision=excluded.revision,updated_at=clock_timestamp()
    RETURNING saved.note,saved.revision INTO result_note,result_revision;
  RETURN QUERY SELECT result_note,result_revision;
END;
$$;
ALTER FUNCTION public.get_booking_internal_notes(uuid) OWNER TO postgres;
ALTER FUNCTION public.save_booking_internal_notes(uuid,text,bigint) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_booking_internal_notes(uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.save_booking_internal_notes(uuid,text,bigint) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_booking_internal_notes(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_booking_internal_notes(uuid,text,bigint) TO authenticated;

DO $verify$
DECLARE saved record;
BEGIN
  FOR saved IN SELECT * FROM cc_booking_notes1_private.catalog_snapshot LOOP
    IF EXISTS(SELECT 1 FROM pg_class c WHERE c.oid=saved.relation_id AND
      (c.relacl IS DISTINCT FROM saved.relacl OR c.relrowsecurity IS DISTINCT FROM saved.relrowsecurity
       OR c.relforcerowsecurity IS DISTINCT FROM saved.relforcerowsecurity))
      OR (SELECT jsonb_agg(to_jsonb(p) ORDER BY p.polname) FROM pg_policy p WHERE p.polrelid=saved.relation_id)
        IS DISTINCT FROM saved.policies
      OR (SELECT jsonb_agg(jsonb_build_object('definition',pg_get_triggerdef(t.oid),
          'enabled',t.tgenabled,'function',pg_get_functiondef(t.tgfoid)) ORDER BY t.tgname)
        FROM pg_trigger t WHERE t.tgrelid=saved.relation_id AND NOT t.tgisinternal)
        IS DISTINCT FROM saved.triggers THEN
      RAISE EXCEPTION 'Existing booking/caterer permissions, RLS or triggers changed';
    END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM pg_roles r WHERE r.rolname IN ('anon','authenticated','service_role')
    AND (has_schema_privilege(r.oid,'cc_booking_notes1_private','USAGE')
      OR has_table_privilege(r.oid,'cc_booking_notes1_private.notes','SELECT')
      OR has_table_privilege(r.oid,'cc_booking_notes1_private.notes','INSERT')
      OR has_table_privilege(r.oid,'cc_booking_notes1_private.notes','UPDATE')
      OR has_table_privilege(r.oid,'cc_booking_notes1_private.notes','DELETE'))) THEN
    RAISE EXCEPTION 'Private internal notes table is directly exposed';
  END IF;
END;
$verify$;
COMMIT;
-- Rollout: approve/install this guarded proposal before releasing the UI.
-- No existing notes are copied: caterer_notes already has customer-visible use.
-- Only the assigned caterer account is supported; no team membership exists in
-- the reviewed schema. Trusted database administrators remain privileged.
-- The private FK makes service-role TRUNCATE ... CASCADE fail on private-table
-- privileges. Ordinary non-completed booking DELETE cleanup still cascades.
-- Do not grant private TRUNCATE access to work around that protection.
-- Mitigation: remove the new UI first if necessary; retain private note storage.
-- Never copy notes into bookings, notifications, public views or JSON payloads.
-- Do not drop this schema/data or grant direct access as an automatic rollback.
