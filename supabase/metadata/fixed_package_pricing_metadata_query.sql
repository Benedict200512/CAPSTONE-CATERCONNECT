-- Targeted read-only catalogs only. No package, menu, customer or booking rows.
WITH targets AS (SELECT c.oid,c.relname,c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname IN ('menu_items','booking_customizations'))
SELECT jsonb_build_object('tables',(SELECT jsonb_agg(jsonb_build_object(
  'name',t.relname,'owner',pg_get_userbyid(t.relowner),'acl',t.relacl,'rls',t.relrowsecurity,'forced_rls',t.relforcerowsecurity,
  'columns',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
    'not_null',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid),'acl',a.attacl) ORDER BY a.attnum)
    FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE a.attrelid=t.oid AND a.attnum>0 AND NOT a.attisdropped),
  'constraints',(SELECT jsonb_agg(pg_get_constraintdef(c.oid,true)) FROM pg_constraint c WHERE c.conrelid=t.oid),
  'indexes',(SELECT jsonb_agg(pg_get_indexdef(i.indexrelid)) FROM pg_index i WHERE i.indrelid=t.oid),
  'policies',(SELECT jsonb_agg(to_jsonb(p)) FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=t.relname),
  'triggers',(SELECT jsonb_agg(jsonb_build_object('definition',pg_get_triggerdef(g.oid,true),'enabled',g.tgenabled,
    'function',pg_get_functiondef(g.tgfoid))) FROM pg_trigger g WHERE g.tgrelid=t.oid AND NOT g.tgisinternal)
)) FROM targets t),
  'package_pricing_columns',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod)))
    FROM pg_attribute a WHERE a.attrelid='public.packages'::regclass AND a.attname IN ('price','guest_capacity','min_guests','max_guests','extra_guest_fee') AND NOT a.attisdropped),
  'legacy_fee_function_references',(SELECT jsonb_agg(p.oid::regprocedure::text) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prokind='f' AND position('extra_guest_fee' IN p.prosrc)>0)
);
