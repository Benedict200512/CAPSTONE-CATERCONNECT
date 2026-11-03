-- Staff-only NEW account provisioning. LOCAL GUARDED PROPOSAL, NOT EXECUTED.
-- Requires installed profile-role protection; no original policies or accounts changed.
BEGIN;
DO $$ BEGIN
  RAISE EXCEPTION 'PROPOSAL ONLY: staff provisioning requires explicit database approval';
END $$;
LOCK TABLE public.profiles IN ACCESS EXCLUSIVE MODE;
CREATE SCHEMA cc_staff_provision1_private;
REVOKE ALL ON SCHEMA cc_staff_provision1_private FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE cc_staff_provision1_private.original_rpc (
  definition text NOT NULL, owner_id oid NOT NULL, acl aclitem[], config text[]
);
REVOKE ALL ON ALL TABLES IN SCHEMA cc_staff_provision1_private FROM PUBLIC,anon,authenticated,service_role;
DO $patch$
DECLARE f record; ddl text; expected text := $expected$
DECLARE actor uuid:=auth.uid(); desired public.profiles; target_role text;
BEGIN
  IF current_setting('transaction_isolation')<>'read committed' THEN
    RAISE EXCEPTION 'Role management requires READ COMMITTED' USING ERRCODE='55000';
  END IF;
  -- Serialize rare role-management calls before reading authorization. No
  -- recursion through profile RLS: verified definer owner bypasses RLS.
  LOCK TABLE public.profiles IN SHARE ROW EXCLUSIVE MODE;
  IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles p
    WHERE p.id=actor AND p.role::text='admin' AND p.status::text='active') THEN
    RAISE EXCEPTION 'An active administrator is required' USING ERRCODE='42501';
  END IF;
  IF p_profile_id IS NULL OR p_profile_id=actor OR p_role IS NULL OR p_role NOT IN ('staff','admin','customer') THEN
    RAISE EXCEPTION 'Choose another account and a permitted role' USING ERRCODE='42501';
  END IF;
  SELECT p.role::text INTO target_role FROM public.profiles p WHERE p.id=p_profile_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile unavailable'; END IF;
  IF target_role='caterer' OR EXISTS(SELECT 1 FROM public.caterers c WHERE c.user_id=p_profile_id) THEN
    RAISE EXCEPTION 'Business account role conversion requires a separate reviewed workflow';
  END IF;
  IF p_role='customer' AND target_role IS DISTINCT FROM 'staff' THEN
    RAISE EXCEPTION 'Only staff accounts can be demoted to customer' USING ERRCODE='42501';
  END IF;
  -- Populate the installed native role type rather than assuming text vs enum.
  SELECT * INTO desired FROM jsonb_populate_record(NULL::public.profiles,jsonb_build_object('role',p_role));
  UPDATE public.profiles p SET role=desired.role WHERE p.id=p_profile_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile unavailable'; END IF;
  RETURN QUERY SELECT p.id,p.role::text FROM public.profiles p WHERE p.id=p_profile_id;
END;
$expected$;
  replacement text := $replacement$
DECLARE actor uuid:=auth.uid(); desired public.profiles; target_role text;
BEGIN
  IF current_setting('transaction_isolation')<>'read committed' THEN
    RAISE EXCEPTION 'Role management requires READ COMMITTED' USING ERRCODE='55000';
  END IF;
  -- Serialize rare role-management calls before reading authorization. No
  -- recursion through profile RLS: verified definer owner bypasses RLS.
  LOCK TABLE public.profiles IN SHARE ROW EXCLUSIVE MODE;
  IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles p
    WHERE p.id=actor AND p.role::text='admin' AND p.status::text='active') THEN
    RAISE EXCEPTION 'An active administrator is required' USING ERRCODE='42501';
  END IF;
  IF p_profile_id IS NULL OR p_profile_id=actor OR p_role IS NULL OR p_role NOT IN ('staff','admin') THEN
    RAISE EXCEPTION 'Choose another account and a permitted role' USING ERRCODE='42501';
  END IF;
  SELECT p.role::text INTO target_role FROM public.profiles p WHERE p.id=p_profile_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile unavailable'; END IF;
  IF target_role IS NULL OR target_role NOT IN ('staff','admin') OR p_role NOT IN ('staff','admin') THEN
    RAISE EXCEPTION 'Customer conversion is not permitted' USING ERRCODE='42501';
  END IF;
  IF target_role='caterer' OR EXISTS(SELECT 1 FROM public.caterers c WHERE c.user_id=p_profile_id) THEN
    RAISE EXCEPTION 'Business account role conversion requires a separate reviewed workflow';
  END IF;
  -- Populate the installed native role type rather than assuming text vs enum.
  SELECT * INTO desired FROM jsonb_populate_record(NULL::public.profiles,jsonb_build_object('role',p_role));
  UPDATE public.profiles p SET role=desired.role WHERE p.id=p_profile_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile unavailable'; END IF;
  RETURN QUERY SELECT p.id,p.role::text FROM public.profiles p WHERE p.id=p_profile_id;
END;
$replacement$;
BEGIN
  IF current_user<>'postgres' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls)) THEN
    RAISE EXCEPTION 'Verified postgres RLS-bypass owner required';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='auth.users'::regclass
    AND attname='banned_until' AND atttypid='timestamptz'::regtype AND NOT attisdropped) THEN
    RAISE EXCEPTION 'Required Auth ban column differs: inspect before installation';
  END IF;
  SELECT * INTO STRICT f FROM pg_proc WHERE oid='public.cc_profile_role1_assign_staff_role(uuid,text)'::regprocedure;
  IF NOT f.prosecdef OR pg_get_userbyid(f.proowner)<>'postgres'
    OR f.proconfig IS DISTINCT FROM ARRAY['search_path=""']
    OR replace(f.prosrc,chr(13)||chr(10),chr(10)) IS DISTINCT FROM replace(expected,chr(13)||chr(10),chr(10)) THEN
    RAISE EXCEPTION 'Installed role RPC differs from reviewed baseline';
  END IF;
  INSERT INTO cc_staff_provision1_private.original_rpc VALUES(pg_get_functiondef(f.oid),f.proowner,f.proacl,f.proconfig);
  -- Exact reviewed body replacement, not a permissive regex. Keep DDL wrapper.
  ddl:=replace(pg_get_functiondef(f.oid),f.prosrc,replacement);
  EXECUTE ddl;
  IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=f.oid AND p.proowner=f.proowner
    AND p.proacl IS NOT DISTINCT FROM f.proacl AND p.proconfig IS NOT DISTINCT FROM f.proconfig
    AND p.prosrc=replacement) THEN RAISE EXCEPTION 'Role RPC protection verification failed'; END IF;
END;
$patch$;

-- Service-only two-phase contract: NULL target is a readiness/authorization check;
-- finalization rechecks active admin and an unforgeable server-created Auth marker.
CREATE FUNCTION public.cc_staff_provision1_finalize(p_actor uuid,p_user uuid,p_nonce uuid)
RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE fresh boolean;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Trusted provisioning service required' USING ERRCODE='42501';
  END IF;
  IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'READ COMMITTED required'; END IF;
  LOCK TABLE public.profiles IN SHARE ROW EXCLUSIVE MODE;
  IF p_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=p_actor AND p.role::text='admin' AND p.status::text='active') THEN
    RAISE EXCEPTION 'An active administrator is required' USING ERRCODE='42501';
  END IF;
  IF p_user IS NULL AND p_nonce IS NULL THEN RETURN NULL; END IF;
  IF p_user IS NULL OR p_nonce IS NULL OR p_user=p_actor THEN RAISE EXCEPTION 'Invalid provisioning identity' USING ERRCODE='42501'; END IF;
  SELECT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=p_user
    AND u.raw_app_meta_data->>'cc_staff_provision_actor'=p_actor::text
    AND u.raw_app_meta_data->>'cc_staff_provision_nonce'=p_nonce::text
    AND u.created_at>=clock_timestamp()-interval '10 minutes'
    AND u.last_sign_in_at IS NULL
    AND u.banned_until>clock_timestamp()) INTO fresh;
  IF NOT fresh OR EXISTS(SELECT 1 FROM public.caterers c WHERE c.user_id=p_user) THEN
    RAISE EXCEPTION 'Only a new service-created staff identity is eligible' USING ERRCODE='42501';
  END IF;
  -- Signup's safe initializer creates this NEW profile as customer first. Only
  -- the Auth Admin marker above authorizes staff assignment; user metadata never does.
  UPDATE public.profiles p SET role='staff' WHERE p.id=p_user AND p.role::text='customer' AND p.status::text='active';
  IF NOT FOUND THEN RAISE EXCEPTION 'New profile missing or ineligible' USING ERRCODE='42501'; END IF;
  RETURN p_user;
END;
$$;
ALTER FUNCTION public.cc_staff_provision1_finalize(uuid,uuid,uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.cc_staff_provision1_finalize(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.cc_staff_provision1_finalize(uuid,uuid,uuid) TO service_role;
DO $$ BEGIN
  IF has_function_privilege('anon','public.cc_staff_provision1_finalize(uuid,uuid,uuid)','EXECUTE')
    OR has_function_privilege('authenticated','public.cc_staff_provision1_finalize(uuid,uuid,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Inherited grants expose staff provisioning';
  END IF;
END $$;
COMMIT;

/* DEPLOYMENT / REGRESSION REQUIREMENTS, NOT RUN
- Approve and run this complete transaction separately before deploying endpoint.
  Exact installed RPC drift aborts; never remove that check. Original role migration
  remains unchanged. This patch disallows customer targets and customer destinations.
- Verify new Auth signup produces an active profile, and service_role cannot be
  impersonated through grants/JWT metadata. raw_app_meta_data must remain server-only.
- Service key stays in Edge secrets. No generic public role writer is introduced.
- Test customer/staff/suspended admin/invalid JWT rejection, duplicate emails,
  concurrent same-email creates (one new identity), profile/finalization failures,
  admin suspension between creation/finalization, banned sign-in rejection, activation
  failure and uncertain network outcomes. Never automatically retry.
- Auth banned creation, profile assignment and unban are separate transactions. No
  automatic account deletion/compensation/retry: partial accounts require reviewed
  operator recovery. Neither existing customer identities nor existing roles change.
- Before client rollout verify createUser applies the initial Auth ban; finalization
  requires banned_until in the future. Only successfully finalized new identities
  may be unbanned. A failed/uncertain unban needs operator inspection, not retries.
  Password-form creation needs no SMTP. email_confirm=true is administrator-attested
  email ownership, not independent recipient verification.
- Rollback: first disable endpoint. Drop service RPC RESTRICT after checking callers;
  retain accounts and snapshots. Restoring old RPC reopens customer promotion and
  requires separate approval; prefer forward fix. Never replay seed provisioning.
*/
