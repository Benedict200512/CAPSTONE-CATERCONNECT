-- Read-only targeted catalog export. No payments/customer rows or secrets.
SELECT jsonb_build_object(
  'tables',(SELECT jsonb_agg(jsonb_build_object(
    'table',c.oid::regclass::text,'owner',pg_get_userbyid(c.relowner),
    'acl',c.relacl,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,
    'columns',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
      'not_null',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum)
      FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
      WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
    'constraints',(SELECT jsonb_agg(pg_get_constraintdef(k.oid)) FROM pg_constraint k WHERE k.conrelid=c.oid),
    'indexes',(SELECT jsonb_agg(indexdef) FROM pg_indexes WHERE schemaname='public' AND tablename=c.relname),
    'policies',(SELECT jsonb_agg(to_jsonb(p)) FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=c.relname),
    'triggers',(SELECT jsonb_agg(jsonb_build_object('definition',pg_get_triggerdef(t.oid),'enabled',t.tgenabled,
      'function',pg_get_functiondef(t.tgfoid))) FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal)
  )) FROM pg_class c WHERE c.oid IN (to_regclass('public.subscription_payments'),to_regclass('public.subscription_plans'))),
  'activation_functions',(SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,
    'owner',pg_get_userbyid(p.proowner),'acl',p.proacl,'definition',pg_get_functiondef(p.oid)))
    FROM pg_proc p WHERE p.pronamespace='public'::regnamespace
      AND p.proname IN ('activate_paid_subscription','staff_correct_subscription_plan'))
);
