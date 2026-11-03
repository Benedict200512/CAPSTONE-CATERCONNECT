-- Read-only catalog query for this task. Returns no messages or profile records.
WITH target AS (SELECT to_regclass('public.messages') AS oid), funcs AS (
  SELECT t.tgfoid AS oid FROM pg_trigger t,target r WHERE t.tgrelid=r.oid AND NOT t.tgisinternal
  UNION SELECT d.refobjid FROM pg_depend d JOIN pg_policy p ON d.classid='pg_policy'::regclass AND d.objid=p.oid
    JOIN target r ON p.polrelid=r.oid WHERE d.refclassid='pg_proc'::regclass
)
SELECT jsonb_build_object(
  'relation', (SELECT jsonb_build_object('oid',c.oid,'owner',pg_get_userbyid(c.relowner),
    'rls',c.relrowsecurity,'forced_rls',c.relforcerowsecurity,'acl',c.relacl) FROM pg_class c,target r WHERE c.oid=r.oid),
  'columns',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
    'not_null',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid),'acl',a.attacl) ORDER BY a.attnum)
    FROM pg_attribute a JOIN target r ON a.attrelid=r.oid LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE a.attnum>0 AND NOT a.attisdropped),
  'constraints',(SELECT jsonb_agg(jsonb_build_object('name',c.conname,'definition',pg_get_constraintdef(c.oid,true),'validated',c.convalidated))
    FROM pg_constraint c,target r WHERE c.conrelid=r.oid),
  'indexes',(SELECT jsonb_agg(pg_get_indexdef(i.indexrelid)) FROM pg_index i,target r WHERE i.indrelid=r.oid),
  'policies',(SELECT jsonb_agg(to_jsonb(p)) FROM pg_policies p WHERE p.schemaname='public' AND p.tablename='messages'),
  'privileges',(SELECT jsonb_agg(jsonb_build_object('role',p.rolname,'privilege',v.name,
    'allowed',has_table_privilege(p.oid,r.oid,v.name))) FROM pg_roles p CROSS JOIN target r
    CROSS JOIN (VALUES('SELECT'),('INSERT'),('UPDATE'),('DELETE')) v(name)
    WHERE p.rolname IN ('anon','authenticated','service_role') AND r.oid IS NOT NULL),
  'column_privileges',(SELECT jsonb_agg(jsonb_build_object('role',p.rolname,'column',a.attname,'privilege',v.name,
    'allowed',has_column_privilege(p.oid,r.oid,a.attnum,v.name))) FROM pg_roles p CROSS JOIN target r
    JOIN pg_attribute a ON a.attrelid=r.oid AND a.attnum>0 AND NOT a.attisdropped
    CROSS JOIN (VALUES('SELECT'),('INSERT'),('UPDATE')) v(name)
    WHERE p.rolname IN ('anon','authenticated','service_role')),
  'triggers',(SELECT jsonb_agg(jsonb_build_object('definition',pg_get_triggerdef(t.oid,true),'enabled',t.tgenabled))
    FROM pg_trigger t,target r WHERE t.tgrelid=r.oid AND NOT t.tgisinternal),
  'functions',(SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid),
    'owner',pg_get_userbyid(p.proowner),'acl',p.proacl,'config',p.proconfig)) FROM pg_proc p JOIN funcs f ON f.oid=p.oid WHERE p.prokind='f'),
  'publications',(SELECT jsonb_agg(to_jsonb(p)) FROM pg_publication_tables p WHERE p.schemaname='public' AND p.tablename='messages')
);
