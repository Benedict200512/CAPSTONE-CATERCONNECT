-- Fixed package pricing. REVIEW PROPOSAL ONLY; no live installation authorized.
BEGIN;
DO $$ BEGIN
  RAISE EXCEPTION 'PROPOSAL ONLY: fixed package pricing requires dependency review and separate installation approval';
END $$;
LOCK TABLE public.caterers,public.packages,public.bookings,public.menu_items,public.booking_customizations IN ACCESS EXCLUSIVE MODE;
DO $preflight$
BEGIN
  IF current_user<>'postgres' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls)) THEN
    RAISE EXCEPTION 'Verified postgres maintenance role required';
  END IF;
  IF to_regnamespace('cc_fixed_price1_private') IS NOT NULL
    OR EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.packages'::regclass AND attname IN ('max_guests','extra_guest_fee') AND NOT attisdropped) THEN
    RAISE EXCEPTION 'Pricing object/column collision: review deployed dependencies, never silently drop legacy fee data';
  END IF;
  IF EXISTS(SELECT 1 FROM public.packages WHERE price<=0 OR price::text IN ('NaN','Infinity','-Infinity')
    OR price<>round(price,2) OR guest_capacity<1 OR (min_guests IS NOT NULL AND (min_guests<1 OR min_guests>guest_capacity))) THEN
    RAISE EXCEPTION 'Existing package values need explicit review before adding maximum bounds';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.menu_items'::regclass AND attname='price_per_guest'
    AND atttypid='numeric'::regtype AND NOT attisdropped)
    OR NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.bookings'::regclass AND attname='customized_items'
      AND atttypid='jsonb'::regtype AND NOT attisdropped) THEN
    RAISE EXCEPTION 'Review authoritative menu price and booking customization definitions';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid IN ('public.menu_items'::regclass,'public.booking_customizations'::regclass) AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'Menu/customization triggers differ from reviewed no-trigger baseline';
  END IF;
END;
$preflight$;
CREATE SCHEMA cc_fixed_price1_private AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA cc_fixed_price1_private FROM PUBLIC,anon,authenticated,service_role;
-- Registry protects only new quotes; historical booking fields stay unchanged.
CREATE TABLE cc_fixed_price1_private.quotes (
  booking_id uuid PRIMARY KEY REFERENCES public.bookings(id) ON DELETE CASCADE,
  inputs jsonb NOT NULL
);
ALTER TABLE cc_fixed_price1_private.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_fixed_price1_private.quotes FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA cc_fixed_price1_private FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE public.packages ADD COLUMN max_guests integer;
UPDATE public.packages SET max_guests=guest_capacity;
ALTER TABLE public.packages ALTER COLUMN max_guests SET NOT NULL;
ALTER TABLE public.packages ADD CONSTRAINT cc_fixed_price1_guest_bounds CHECK (
  guest_capacity>0 AND max_guests>=guest_capacity AND (min_guests IS NULL OR (min_guests>=1 AND min_guests<=guest_capacity))
  AND price>0 AND price::text NOT IN ('NaN','Infinity','-Infinity') AND price=round(price,2));
CREATE FUNCTION public.cc_fixed_price1_package_default() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF NEW.max_guests IS NULL THEN NEW.max_guests:=NEW.guest_capacity; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER cc_fixed_price1_package_default BEFORE INSERT ON public.packages FOR EACH ROW EXECUTE FUNCTION public.cc_fixed_price1_package_default();

CREATE FUNCTION public.cc_fixed_price1_quote() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p public.packages%ROWTYPE; rate numeric; menu record; item jsonb; qty integer;
  extras numeric:=0; base numeric; total numeric; deposit numeric; normalized jsonb:='[]'; seen uuid[]:='{}'; menu_id uuid;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND (auth.uid() IS NULL OR NEW.customer_id IS DISTINCT FROM auth.uid()) THEN
    RAISE EXCEPTION 'Create only your own booking' USING ERRCODE='42501';
  END IF;
  IF NEW.status IS DISTINCT FROM 'pending' OR NEW.payment_verified_at IS NOT NULL OR NEW.payment_reference IS NOT NULL
    OR NEW.payment_receipt_url IS NOT NULL OR NEW.payment_submitted_at IS NOT NULL OR NEW.refund_status IS DISTINCT FROM 'none'
    OR coalesce(NEW.refund_amount,0)<>0 OR NEW.refunded_at IS NOT NULL THEN
    RAISE EXCEPTION 'A new quote cannot contain payment or refund evidence' USING ERRCODE='23514';
  END IF;
  -- Existing parent-first serialization order; never rewrite availability/quota.
  SELECT c.downpayment_percent INTO rate FROM public.caterers c WHERE c.id=NEW.caterer_id FOR NO KEY UPDATE;
  IF NOT FOUND OR rate IS NULL OR rate<0 OR rate>100 OR rate<>round(rate,2) OR rate::text IN ('NaN','Infinity','-Infinity') THEN
    RAISE EXCEPTION 'Invalid caterer downpayment configuration' USING ERRCODE='23514';
  END IF;
  SELECT * INTO p FROM public.packages WHERE id=NEW.package_id AND caterer_id=NEW.caterer_id FOR SHARE;
  IF NOT FOUND OR p.publication_status<>'published' THEN
    RAISE EXCEPTION 'Choose a published package owned by this caterer' USING ERRCODE='23514';
  END IF;
  IF NEW.guest_count IS NULL OR NEW.guest_count<coalesce(p.min_guests,1) OR NEW.guest_count>p.max_guests THEN
    RAISE EXCEPTION 'Guest count must be within the package minimum and maximum' USING ERRCODE='23514';
  END IF;
  IF NEW.customized_items IS NOT NULL AND (jsonb_typeof(NEW.customized_items)<>'array' OR jsonb_array_length(NEW.customized_items)>100) THEN
    RAISE EXCEPTION 'Invalid menu selections' USING ERRCODE='23514';
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(coalesce(NEW.customized_items,'[]')) ORDER BY value->>'menu_item_id' LOOP
    IF jsonb_typeof(item)<>'object' OR coalesce(item->>'menu_item_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR coalesce(item->>'quantity','') !~ '^[1-9][0-9]{0,8}$' THEN
      RAISE EXCEPTION 'Invalid menu ID or quantity' USING ERRCODE='23514';
    END IF;
    menu_id:=(item->>'menu_item_id')::uuid; qty:=(item->>'quantity')::integer;
    IF menu_id=ANY(seen) THEN RAISE EXCEPTION 'Duplicate menu selection' USING ERRCODE='23514'; END IF;
    seen:=array_append(seen,menu_id);
    SELECT m.name,m.price_per_guest INTO menu FROM public.menu_items m WHERE m.id=menu_id AND m.caterer_id=NEW.caterer_id FOR SHARE;
    IF NOT FOUND OR menu.price_per_guest IS NULL OR menu.price_per_guest<0 OR menu.price_per_guest<>round(menu.price_per_guest,2)
      OR menu.price_per_guest::text IN ('NaN','Infinity','-Infinity') THEN
      RAISE EXCEPTION 'Choose valid menu items from this caterer' USING ERRCODE='23514';
    END IF;
    extras:=extras+menu.price_per_guest*NEW.guest_count*qty;
    normalized:=normalized||jsonb_build_array(jsonb_build_object('menu_item_id',menu_id,'name',menu.name,'quantity',qty,'price_per_guest',menu.price_per_guest));
  END LOOP;
  -- Exact NUMERIC arithmetic: round the entire extra-guest subtotal once,
  -- never the per-guest rate before multiplication. Add-ons remain separate.
  base:=p.price+round(p.price*greatest(NEW.guest_count-p.guest_capacity,0)/p.guest_capacity,2);
  total:=base+extras; deposit:=round(total*rate/100,2);
  IF total*100>90071992547409 OR NEW.total_cost IS DISTINCT FROM total OR NEW.downpayment_amount IS DISTINCT FROM deposit THEN
    RAISE EXCEPTION 'Package/menu pricing changed or submitted totals are invalid. Refresh the quote.' USING ERRCODE='23514';
  END IF;
  NEW.total_cost:=total; NEW.downpayment_amount:=deposit;
  NEW.customized_items:=CASE WHEN normalized='[]'::jsonb THEN NULL ELSE normalized END;
  RETURN NEW;
END;
$$;
CREATE TRIGGER zz_cc_fixed_price1_quote BEFORE INSERT ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.cc_fixed_price1_quote();

CREATE FUNCTION public.cc_fixed_price1_keep_quote() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE snapshot jsonb; original jsonb;
BEGIN
  snapshot:=jsonb_build_array(NEW.customer_id,NEW.caterer_id,NEW.package_id,NEW.guest_count,NEW.total_cost,NEW.downpayment_amount,NEW.customized_items);
  IF TG_OP='INSERT' THEN
    INSERT INTO cc_fixed_price1_private.quotes VALUES(NEW.id,snapshot);
  ELSE
    SELECT q.inputs INTO original FROM cc_fixed_price1_private.quotes q WHERE q.booking_id=OLD.id;
    IF FOUND AND (NEW.id IS DISTINCT FROM OLD.id OR original IS DISTINCT FROM snapshot) THEN
      RAISE EXCEPTION 'Quoted guest count, package, menu selections and amounts are immutable' USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER zz_cc_fixed_price1_remember AFTER INSERT ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.cc_fixed_price1_keep_quote();
CREATE TRIGGER zz_cc_fixed_price1_keep BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.cc_fixed_price1_keep_quote();

-- Preserve the wizard's separate detail INSERT after booking creation. For new
-- quotes these are immutable mirrors, never a second source of financial truth.
-- Locking the parent serializes concurrent detail inserts without a new index.
CREATE FUNCTION public.cc_fixed_price1_detail() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE parent_id uuid; selected jsonb; protected boolean; parent_customer uuid;
BEGIN
  parent_id:=CASE WHEN TG_OP='INSERT' THEN NEW.booking_id ELSE OLD.booking_id END;
  SELECT b.customer_id INTO parent_customer FROM public.bookings b WHERE b.id=parent_id FOR UPDATE;
  IF NOT FOUND THEN
    -- An otherwise permitted parent DELETE cascades after its row is gone.
    IF TG_OP='DELETE' THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'Booking not found' USING ERRCODE='23503';
  END IF;
  -- Preserve the existing menu FK's ON DELETE CASCADE workflow. The immutable
  -- booking JSON retains the quoted menu name/quantity/price after menu removal.
  IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM public.menu_items m WHERE m.id=OLD.menu_item_id) THEN
    RETURN OLD;
  END IF;
  SELECT EXISTS(SELECT 1 FROM cc_fixed_price1_private.quotes q WHERE q.booking_id=parent_id) INTO protected;
  IF TG_OP='UPDATE' AND NEW.booking_id IS DISTINCT FROM OLD.booking_id THEN
    -- Never move historical detail rows into or out of a protected quote.
    protected:=protected OR EXISTS(SELECT 1 FROM cc_fixed_price1_private.quotes q WHERE q.booking_id=NEW.booking_id);
  END IF;
  IF NOT protected THEN
    IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  IF TG_OP='DELETE' OR (TG_OP='UPDATE' AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.booking_id IS DISTINCT FROM OLD.booking_id
    OR NEW.menu_item_id IS DISTINCT FROM OLD.menu_item_id OR NEW.quantity IS DISTINCT FROM OLD.quantity
    OR NEW.price_per_guest IS DISTINCT FROM OLD.price_per_guest OR NEW.is_added IS DISTINCT FROM OLD.is_added)) THEN
    RAISE EXCEPTION 'Saved quote customization details are immutable' USING ERRCODE='42501';
  END IF;
  IF auth.role() IS DISTINCT FROM 'service_role' AND (auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM parent_customer) THEN
    RAISE EXCEPTION 'Only the booking customer can submit quote details' USING ERRCODE='42501';
  END IF;
  SELECT item INTO selected FROM public.bookings b,
    LATERAL jsonb_array_elements(coalesce(b.customized_items,'[]')) item
    WHERE b.id=parent_id AND item->>'menu_item_id'=NEW.menu_item_id::text;
  IF selected IS NULL OR NEW.quantity IS DISTINCT FROM (selected->>'quantity')::integer
    OR NEW.price_per_guest IS DISTINCT FROM (selected->>'price_per_guest')::numeric OR NEW.is_added IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Customization details must match the saved authoritative quote' USING ERRCODE='23514';
  END IF;
  IF EXISTS(SELECT 1 FROM public.booking_customizations d WHERE d.booking_id=parent_id
    AND d.menu_item_id=NEW.menu_item_id AND (TG_OP='INSERT' OR d.id<>OLD.id)) THEN
    RAISE EXCEPTION 'Duplicate quote customization detail' USING ERRCODE='23505';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER cc_fixed_price1_detail BEFORE INSERT OR UPDATE OR DELETE ON public.booking_customizations
  FOR EACH ROW EXECUTE FUNCTION public.cc_fixed_price1_detail();
ALTER FUNCTION public.cc_fixed_price1_package_default() OWNER TO postgres;
ALTER FUNCTION public.cc_fixed_price1_quote() OWNER TO postgres;
ALTER FUNCTION public.cc_fixed_price1_keep_quote() OWNER TO postgres;
ALTER FUNCTION public.cc_fixed_price1_detail() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.cc_fixed_price1_package_default(),public.cc_fixed_price1_quote(),public.cc_fixed_price1_keep_quote(),public.cc_fixed_price1_detail() FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
-- Existing policies, triggers, quantity limits, payment/refund functions and
-- historic quotes are not rewritten. Only max_guests is added to packages.
-- Detail inserts retain their workflow and must mirror new authoritative quotes.
-- Retain the private registry on rollback. Never CASCADE or erase quote history.
