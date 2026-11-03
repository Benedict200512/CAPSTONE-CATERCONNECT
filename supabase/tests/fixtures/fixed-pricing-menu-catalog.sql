-- Operator-supplied live catalog definitions, 2026-10-20. Disposable tests ONLY.
-- Column defaults/nullability, PK/FKs/CHECK and six policy expressions supplied
-- in the conversation. Confirmed effective CRUD/TRUNCATE grants are reproduced;
-- unqueried REFERENCES/TRIGGER/MAINTAIN privileges are not inferred.
CREATE TABLE public.menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caterer_id uuid NOT NULL REFERENCES public.caterers(id) ON DELETE CASCADE,
  category text NOT NULL CHECK(category IN ('main_course','dessert','drink','appetizer')),
  name text NOT NULL,description text,image_url text,
  price_per_guest numeric NOT NULL DEFAULT 0,created_at timestamptz,
  serving_size numeric,serving_unit text
);
CREATE TABLE public.booking_customizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1,price_per_guest numeric NOT NULL,
  is_added boolean NOT NULL DEFAULT true,created_at timestamptz
);
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_customizations ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE,TRUNCATE ON public.menu_items,public.booking_customizations TO anon,authenticated,service_role;
CREATE POLICY "Caterer views booking customizations" ON public.booking_customizations FOR SELECT TO PUBLIC USING (
  auth.uid() = (
    SELECT c.user_id FROM caterers c JOIN bookings b ON b.caterer_id = c.id
    WHERE b.id = booking_customizations.booking_id
  )
);
CREATE POLICY "Customer manages own booking customizations" ON public.booking_customizations FOR ALL TO PUBLIC USING (
  auth.uid() = (SELECT bookings.customer_id FROM bookings WHERE bookings.id = booking_customizations.booking_id)
);
CREATE POLICY "Customer views own booking customizations" ON public.booking_customizations FOR SELECT TO PUBLIC USING (
  auth.uid() = (SELECT bookings.customer_id FROM bookings WHERE bookings.id = booking_customizations.booking_id)
);
CREATE POLICY "Staff views all booking customizations" ON public.booking_customizations FOR SELECT TO PUBLIC USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = ANY (ARRAY['staff'::text,'admin'::text]))
);
CREATE POLICY "Anyone can view menu items" ON public.menu_items FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "Caterer manages own menu items" ON public.menu_items FOR ALL TO PUBLIC USING (
  auth.uid() = (SELECT caterers.user_id FROM caterers WHERE caterers.id = menu_items.caterer_id)
);
-- No explicit WITH CHECK: the ALL policy USING expression is its write check.
-- No non-primary indexes, extra uniqueness or non-internal triggers were supplied.
