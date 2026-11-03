-- CaterConnect Security Migration 1 -- MATCHING STAGING ROLLBACK ONLY.
-- Not executed. Run separately, never appended to forward migration.
-- Requires successful forward migration and its intact backup table.
-- CREATE OR REPLACE restores original definition while retaining owner/ACLs,
-- which forward migration does not change. Do not run after unrelated changes
-- to signup without reviewing the definition diff (avoid overwriting later work).
BEGIN;
DO $$ BEGIN
  RAISE EXCEPTION 'PROPOSAL ONLY: Security Migration 1 rollback requires separate explicit approval';
END $$;
LOCK TABLE public.profiles IN ACCESS EXCLUSIVE MODE;
DO $restore$
DECLARE saved_definition text; installed_definition text;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Expected maintenance context'; END IF;
  SELECT definition, hardened_definition INTO STRICT saved_definition, installed_definition
  FROM public.cc_security1_function_backup WHERE singleton;
  IF installed_definition IS NULL
    OR pg_get_functiondef('public.handle_new_user()'::regprocedure) IS DISTINCT FROM installed_definition THEN
    RAISE EXCEPTION 'Signup definition drifted: review before restoring snapshot';
  END IF;
  EXECUTE saved_definition;
END;
$restore$;
DROP TRIGGER cc_security1_profile_guard ON public.profiles;
DROP FUNCTION public.cc_security1_profile_guard() RESTRICT;
DROP FUNCTION public.cc_security1_is_admin() RESTRICT;
DROP TABLE public.cc_security1_function_backup;
COMMIT;
-- Verify original signup body, unchanged monitoring definitions, profile RLS/
-- grants and absence of DELETE/ALL policies. No CASCADE or user record deletion.
-- A failure before COMMIT rolls back this entire rollback transaction.
-- This reverse restores the vulnerable original authorization state. Prefer a
-- reviewed forward correction. Existing grants/policies/monitoring functions
-- are unchanged by forward, so no old ACL is replayed. No records are deleted.
