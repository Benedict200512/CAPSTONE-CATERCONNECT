-- READ ONLY. Run manually in Supabase SQL Editor as the maintenance owner.
-- Returns catalog definitions and aggregate counts, never raw payment JSON,
-- caterer/customer identifiers, names, receipts or financial amounts.
-- Save the result as last_payment_reference_catalog_export.json for review.
-- Do not interpret an empty dependency list as proof that dynamic SQL,
-- external scripts, older clients or historical retention needs do not exist.
WITH target AS MATERIALIZED (
  SELECT c.oid AS relation_id,c.reltype,a.attnum,a.attname,a.atttypid,
    a.attnotnull,a.attacl,c.relacl,c.relrowsecurity,c.relforcerowsecurity,
    pg_catalog.pg_get_expr(d.adbin,d.adrelid) AS default_expression,
    pg_catalog.col_description(c.oid,a.attnum) AS column_comment
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid
  LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
  WHERE c.oid='public.caterers'::regclass
    AND a.attname='last_payment_reference' AND NOT a.attisdropped
), routines AS MATERIALIZED (
  SELECT p.oid,p.pronamespace,p.proowner,p.proacl,p.prosecdef,p.prorettype,
    p.proargtypes,p.proallargtypes,p.proconfig,
    pg_catalog.pg_get_functiondef(p.oid) AS definition
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
  WHERE p.prokind IN ('f','p') AND n.nspname NOT IN ('pg_catalog','information_schema')
    AND n.nspname NOT LIKE 'pg_toast%'
), candidate_routines AS MATERIALIZED (
  SELECT r.* FROM routines r
  WHERE r.definition ~* 'last_payment_reference|staff[[:space:]_]+manual[[:space:]_]+clearance|caterers|refund|clearance'
    OR EXISTS(SELECT 1 FROM target t WHERE r.prorettype=t.reltype
      OR t.reltype=ANY(r.proargtypes::oid[]) OR t.reltype=ANY(r.proallargtypes))
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_trigger tr WHERE tr.tgfoid=r.oid
      AND tr.tgrelid IN (to_regclass('public.caterers'),to_regclass('public.bookings'),
        to_regclass('public.refund_transfer_submissions'),to_regclass('public.refund_disputes'),
        to_regclass('public.subscription_payments')))
), inventory AS (
  SELECT count(*) AS total_caterers,
    count(*) FILTER(WHERE last_payment_reference IS NULL) AS sql_null,
    count(*) FILTER(WHERE last_payment_reference IS NOT NULL) AS non_sql_null,
    count(*) FILTER(WHERE last_payment_reference='null'::jsonb) AS json_null,
    count(*) FILTER(WHERE jsonb_typeof(last_payment_reference)='object') AS objects,
    count(*) FILTER(WHERE jsonb_typeof(last_payment_reference->'method')='string'
      AND last_payment_reference->>'method' ILIKE 'STAFF MANUAL CLEARANCE%') AS staff_manual_clearance
  FROM public.caterers
)
SELECT jsonb_build_object(
  'scope','Read-only snapshot; source matches are candidates, not proof of execution or provenance',
  'column',(SELECT to_jsonb(t) FROM target t),
  'inventory',(SELECT to_jsonb(i) FROM inventory i),
  'json_shapes',(SELECT coalesce(jsonb_object_agg(kind,n),'{}'::jsonb) FROM (
    SELECT jsonb_typeof(last_payment_reference) AS kind,count(*) AS n
    FROM public.caterers WHERE last_payment_reference IS NOT NULL GROUP BY 1
  ) shapes),
  'object_key_counts',(SELECT coalesce(jsonb_object_agg(key,n),'{}'::jsonb) FROM (
    SELECT k.key,count(*) AS n FROM public.caterers c
    CROSS JOIN LATERAL jsonb_object_keys(CASE WHEN jsonb_typeof(c.last_payment_reference)='object'
      THEN c.last_payment_reference ELSE '{}'::jsonb END) k(key)
    GROUP BY k.key
  ) keys),
  'effective_column_privileges',(SELECT jsonb_agg(jsonb_build_object(
    'role',r.rolname,'select',has_column_privilege(r.oid,t.relation_id,t.attnum,'SELECT'),
    'insert',has_column_privilege(r.oid,t.relation_id,t.attnum,'INSERT'),
    'update',has_column_privilege(r.oid,t.relation_id,t.attnum,'UPDATE')
  ) ORDER BY r.rolname) FROM pg_catalog.pg_roles r CROSS JOIN target t
    WHERE r.rolname IN ('anon','authenticated','service_role','postgres')),
  'registered_dependencies',(SELECT coalesce(jsonb_agg(jsonb_build_object(
    'scope',CASE WHEN d.refobjsubid=0 THEN 'whole table (may concern other columns)' ELSE 'target column' END,
    'object',pg_catalog.pg_describe_object(d.classid,d.objid,d.objsubid),
    'classid',d.classid,'objid',d.objid,'objsubid',d.objsubid,'dependency_type',d.deptype
  ) ORDER BY d.classid,d.objid,d.objsubid),'[]'::jsonb)
    FROM pg_catalog.pg_depend d JOIN target t ON d.refobjid=t.relation_id
    WHERE d.refclassid='pg_class'::regclass AND d.refobjsubid IN (0,t.attnum)),
  'candidate_routines',(SELECT coalesce(jsonb_agg(jsonb_build_object(
    'signature',r.oid::regprocedure::text,'owner',pg_catalog.pg_get_userbyid(r.proowner),
    'acl',r.proacl,'security_definer',r.prosecdef,'configuration',r.proconfig,
    'explicit_column_match',r.definition ILIKE '%last_payment_reference%',
    'definition',r.definition
  ) ORDER BY r.oid::regprocedure::text),'[]'::jsonb) FROM candidate_routines r),
  'related_triggers',(SELECT coalesce(jsonb_agg(jsonb_build_object(
    'table',tr.tgrelid::regclass::text,'name',tr.tgname,'enabled',tr.tgenabled,
    'definition',pg_catalog.pg_get_triggerdef(tr.oid),'function',tr.tgfoid::regprocedure::text
  ) ORDER BY tr.tgrelid,tr.tgname),'[]'::jsonb) FROM pg_catalog.pg_trigger tr
    WHERE NOT tr.tgisinternal AND (tr.tgrelid='public.caterers'::regclass
      OR tr.tgfoid IN (SELECT oid FROM candidate_routines))),
  'related_views',(SELECT coalesce(jsonb_agg(jsonb_build_object(
    'view',v.oid::regclass::text,'definition',pg_catalog.pg_get_viewdef(v.oid,true)
  ) ORDER BY v.oid),'[]'::jsonb) FROM pg_catalog.pg_class v
    WHERE v.relkind IN ('v','m') AND EXISTS(SELECT 1 FROM pg_catalog.pg_namespace n
      WHERE n.oid=v.relnamespace AND n.nspname NOT IN ('pg_catalog','information_schema'))
      AND pg_catalog.pg_get_viewdef(v.oid,true) ~* 'last_payment_reference|caterers'),
  'related_policies',(SELECT coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb)
    FROM pg_catalog.pg_policies p WHERE (p.tablename='caterers' AND p.schemaname='public')
      OR (coalesce(p.qual,'')||' '||coalesce(p.with_check,'')) ~* 'last_payment_reference|caterers'),
  'caterer_constraints',(SELECT coalesce(jsonb_agg(pg_catalog.pg_get_constraintdef(c.oid)),'[]'::jsonb)
    FROM pg_catalog.pg_constraint c WHERE c.conrelid='public.caterers'::regclass),
  'caterer_indexes',(SELECT coalesce(jsonb_agg(i.indexdef),'[]'::jsonb)
    FROM pg_catalog.pg_indexes i WHERE i.schemaname='public' AND i.tablename='caterers'),
  'installed_extensions',(SELECT jsonb_agg(extname ORDER BY extname) FROM pg_catalog.pg_extension),
  'limits',jsonb_build_array(
    'Run as maintenance owner: an RLS-filtered client inventory is not a complete inventory.',
    'PL/pgSQL source, JSON whole-row serialization and dynamic identifiers need manual review.',
    'Registered dependencies are direct only; review returned helper routines/callers as needed.',
    'Scheduled jobs, remotely deployed Edge Functions, old app builds and manual SQL are not fully inventoried here.',
    'Non-null JSON and STAFF MANUAL CLEARANCE annotations do not prove money was received or refunded.',
    'Audit provenance, copies in durable audit logs and retention requirements need operator review before removal.'
  )
);
