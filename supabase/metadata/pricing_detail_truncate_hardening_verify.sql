-- Read-only catalog verification; safe before AND after approved installation.
-- Returns no customer, menu, booking, payment or credential records.
BEGIN READ ONLY;
-- Before: all five confirmed privileges true for all four roles/two tables.
-- After: only anon/authenticated can_truncate should become false.
SELECT r.rolname, t.name AS relation,
  has_table_privilege(r.oid,t.name,'SELECT') AS can_select,
  has_table_privilege(r.oid,t.name,'INSERT') AS can_insert,
  has_table_privilege(r.oid,t.name,'UPDATE') AS can_update,
  has_table_privilege(r.oid,t.name,'DELETE') AS can_delete,
  has_table_privilege(r.oid,t.name,'TRUNCATE') AS can_truncate
FROM pg_roles r CROSS JOIN (VALUES ('public.menu_items'),('public.booking_customizations')) t(name)
WHERE r.rolname IN ('anon','authenticated','postgres','service_role') ORDER BY r.rolname,t.name;

-- Both client flags must be false after installation. has_table_privilege
-- includes PUBLIC and immediately inherited privileges, not just direct ACLs.
SELECT r.rolname,r.rolsuper,r.rolinherit,
  has_table_privilege(r.oid,'public.menu_items','TRUNCATE')
    OR has_table_privilege(r.oid,'public.booking_customizations','TRUNCATE') AS effective_truncate_remains
FROM pg_roles r WHERE r.rolname IN ('anon','authenticated');

-- Additional membership audit: investigate any rows, including memberships
-- not currently inherited. MEMBER is conservative: on newer PostgreSQL,
-- membership may have SET FALSE. This query flags candidates, not proof that
-- SET ROLE is allowed. Superuser membership also requires explicit review.
SELECT client.rolname AS client_role,parent.rolname AS member_of,parent.rolsuper,
  has_table_privilege(parent.oid,'public.menu_items','TRUNCATE') AS parent_menu_truncate,
  has_table_privilege(parent.oid,'public.booking_customizations','TRUNCATE') AS parent_detail_truncate
FROM pg_roles client JOIN pg_roles parent ON parent.oid<>client.oid
  AND pg_has_role(client.oid,parent.oid,'MEMBER')
WHERE client.rolname IN ('anon','authenticated')
  AND (parent.rolsuper OR has_table_privilege(parent.oid,'public.menu_items','TRUNCATE')
    OR has_table_privilege(parent.oid,'public.booking_customizations','TRUNCATE'));

SELECT c.oid::regclass AS relation,c.relowner::regrole AS owner,c.relrowsecurity,c.relforcerowsecurity,c.relacl
FROM pg_class c WHERE c.oid IN ('public.menu_items'::regclass,'public.booking_customizations'::regclass);
SELECT tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies
WHERE schemaname='public' AND tablename IN ('menu_items','booking_customizations') ORDER BY tablename,policyname;
SELECT t.tgrelid::regclass AS relation,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t WHERE t.tgrelid IN ('public.menu_items'::regclass,'public.booking_customizations'::regclass)
  AND NOT t.tgisinternal ORDER BY relation,t.tgname;

-- Candidate maintenance functions to review; text search cannot prove absence
-- of dynamic SQL, external jobs or functions in an uncollected deployment.
SELECT n.nspname,p.proname,p.oid::regprocedure AS signature,p.prosecdef,
  p.proowner::regrole AS owner
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname NOT IN ('pg_catalog','information_schema')
  AND p.prokind IN ('f','p') AND p.prosrc ~* '\mtruncate\M'
  AND (p.prosrc ~* '\mmenu_items\M' OR p.prosrc ~* '\mbooking_customizations\M');
COMMIT;
