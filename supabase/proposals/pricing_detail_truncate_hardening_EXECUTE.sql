-- Separate permission-hardening proposal; NOT part of pricing installation.
-- Operator confirmed anon/authenticated have TRUNCATE on both tables. RLS
-- and row triggers do not protect TRUNCATE. No live execution authorized.
BEGIN;
DO $preflight$
BEGIN
  IF current_user<>'postgres' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls)) THEN
    RAISE EXCEPTION 'Verified postgres maintenance role required';
  END IF;
  IF to_regclass('public.menu_items') IS NULL OR to_regclass('public.booking_customizations') IS NULL THEN
    RAISE EXCEPTION 'Reviewed tables are missing';
  END IF;
END;
$preflight$;
REVOKE TRUNCATE ON public.menu_items,public.booking_customizations FROM PUBLIC,anon,authenticated;
DO $verify$
BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles r WHERE r.rolname IN ('anon','authenticated')
    AND (has_table_privilege(r.oid,'public.menu_items','TRUNCATE') OR has_table_privilege(r.oid,'public.booking_customizations','TRUNCATE'))) THEN
    RAISE EXCEPTION 'Client TRUNCATE still inherited; inspect role memberships before approval';
  END IF;
END;
$verify$;
COMMIT;
-- SELECT/INSERT/UPDATE/DELETE grants, RLS, triggers and service_role grants
-- remain unchanged. Review any external maintenance caller before installation.
-- Mitigation: repair the approved maintenance caller; do not restore broad
-- client TRUNCATE privileges as an automatic rollback.
