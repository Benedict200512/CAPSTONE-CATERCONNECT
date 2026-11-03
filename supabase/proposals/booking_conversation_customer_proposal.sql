-- Messaging customer profile lookup. PROPOSAL ONLY, not installed.
BEGIN;
DO $$ BEGIN
  RAISE EXCEPTION 'PROPOSAL ONLY: booking conversation profile lookup requires separate installation approval';
END $$;
DO $preflight$
DECLARE field text;
BEGIN
  IF current_user<>'postgres' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls)) THEN
    RAISE EXCEPTION 'Verified postgres maintenance role required';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='get_booking_conversation_customer') THEN
    RAISE EXCEPTION 'Conversation profile RPC collision: review instead of replacing';
  END IF;
  FOREACH field IN ARRAY ARRAY['full_name','avatar_url','phone_number','address','email'] LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.profiles'::regclass AND attname=field
      AND atttypid='text'::regtype AND attnum>0 AND NOT attisdropped) THEN
      RAISE EXCEPTION 'Reviewed profile field differs: %',field;
    END IF;
  END LOOP;
END;
$preflight$;
CREATE FUNCTION public.get_booking_conversation_customer(p_booking_id uuid)
RETURNS TABLE(id uuid,full_name text,avatar_url text,phone_number text,address text,email text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Booking participant access required' USING ERRCODE='42501';
  END IF;
  RETURN QUERY SELECT p.id,p.full_name,p.avatar_url,p.phone_number,p.address,p.email
    FROM public.bookings b JOIN public.caterers c ON c.id=b.caterer_id
    JOIN public.profiles p ON p.id=b.customer_id
    WHERE b.id=p_booking_id AND (b.customer_id=auth.uid() OR c.user_id=auth.uid());
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking participant access required' USING ERRCODE='42501';
  END IF;
END;
$$;
ALTER FUNCTION public.get_booking_conversation_customer(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_booking_conversation_customer(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_booking_conversation_customer(uuid) TO authenticated;
DO $verify$
BEGIN
  IF has_function_privilege('anon','public.get_booking_conversation_customer(uuid)','EXECUTE')
    OR has_function_privilege('service_role','public.get_booking_conversation_customer(uuid)','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.get_booking_conversation_customer(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Conversation profile RPC permissions differ';
  END IF;
END;
$verify$;
COMMIT;
-- No existing RLS, table/column privilege, booking field or message is changed.
-- The collected profiles SELECT policy already allows all authenticated users
-- to read profiles directly. This narrow RPC does not fix or widen that prior
-- exposure. Tightening shared profile access needs separate impact review.
-- Rollout after approval only; release the modal after RPC installation.
-- Mitigation: hide the modal; separately approved DROP FUNCTION ... RESTRICT.
-- Never broaden profile RLS to make this lookup work. Never CASCADE.
