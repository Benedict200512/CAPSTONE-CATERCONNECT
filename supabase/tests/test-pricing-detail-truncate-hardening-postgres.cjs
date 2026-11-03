// Standalone permission tests in the disposable four-export fixture. Does not
// install pricing. No live connection, project secrets, payment or deployment.
const assert=require('node:assert/strict'),crypto=require('node:crypto');
module.exports=async({sql,check,ensure,fails,auth,lit,uid,read,owner,other,customer,cat,oldAccepted})=>{
 assert.equal(sql("SELECT to_regclass('public.menu_items') IS NULL;").trim(),'t','Run separately from --pricing-full');
 sql(read('supabase/tests/fixtures/fixed-pricing-menu-catalog.sql'));
 const proposal=read('supabase/proposals/pricing_detail_truncate_hardening_proposal.sql');
 const execution=read('supabase/proposals/pricing_detail_truncate_hardening_EXECUTE.sql');
 const stop=/DO \$\$ BEGIN\r?\n  RAISE EXCEPTION 'PROPOSAL ONLY: customization TRUNCATE grants require separate approval';\r?\nEND \$\$;\r?\n/;
 assert.equal([...proposal.matchAll(new RegExp(stop.source,'g'))].length,1);
 assert.equal(execution,proposal.replace(stop,''));
 const matrix=()=>sql(`SELECT jsonb_agg(jsonb_build_object('role',r.rolname,'table',t.name,'select',has_table_privilege(r.oid,t.name,'SELECT'),
   'insert',has_table_privilege(r.oid,t.name,'INSERT'),'update',has_table_privilege(r.oid,t.name,'UPDATE'),'delete',has_table_privilege(r.oid,t.name,'DELETE'),
   'truncate',has_table_privilege(r.oid,t.name,'TRUNCATE')) ORDER BY r.rolname,t.name)
   FROM pg_roles r CROSS JOIN (VALUES('public.menu_items'),('public.booking_customizations')) t(name)
   WHERE r.rolname IN ('anon','authenticated','postgres','service_role');`).trim();
 const catalog=()=>sql(`SELECT jsonb_build_object('policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY oid) FROM pg_policy p),
   'triggers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY oid) FROM pg_trigger t WHERE NOT tgisinternal),
   'functions',(SELECT jsonb_agg(jsonb_build_array(oid,pg_get_functiondef(oid),proacl) ORDER BY oid) FROM pg_proc WHERE pronamespace='public'::regnamespace),
   'relations',(SELECT jsonb_agg(jsonb_build_array(oid,relowner,relrowsecurity,relforcerowsecurity) ORDER BY oid) FROM pg_class WHERE oid IN ('public.menu_items'::regclass,'public.booking_customizations'::regclass)),
   'other_acl',(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.relid,a.grantee,a.privilege_type) FROM (SELECT c.oid AS relid,x.* FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) x WHERE c.oid IN ('public.menu_items'::regclass,'public.booking_customizations'::regclass) AND x.privilege_type<>'TRUNCATE') a));`).trim();
 const before=matrix(),unchanged=catalog();
 check('hardening execution matches proposal apart from the single stop',ensure(`${lit(execution)}=${lit(proposal.replace(stop,''))}`,'copy changed'));
 for(const row of JSON.parse(before))for(const p of ['select','insert','update','delete','truncate'])assert.equal(row[p],true,JSON.stringify(row));
 check('all four roles initially have confirmed CRUD and TRUNCATE on both tables',ensure('true','matrix'));
 let error;try{sql(proposal);}catch(e){error=e;}
 assert.ok(String(error?.stderr).includes('PROPOSAL ONLY'));assert.equal(matrix(),before);
 check('review proposal stop preserves original effective permissions',ensure('true','stop'));
 const menu=uid(9400);
 sql(`INSERT INTO public.menu_items(id,caterer_id,category,name) VALUES(${lit(menu)},${lit(cat)},'drink','Local fixture');`);
 check('before hardening anon TRUNCATE bypasses RLS despite hidden customization rows',`${auth(customer)} INSERT INTO public.booking_customizations(booking_id,menu_item_id,price_per_guest) VALUES(${lit(oldAccepted)},${lit(menu)},0); ${auth('','anon')} ${ensure('NOT EXISTS(SELECT 1 FROM public.booking_customizations)','RLS not hiding')} TRUNCATE public.booking_customizations; RESET ROLE; ${ensure('NOT EXISTS(SELECT 1 FROM public.booking_customizations)','truncate blocked')}`);
 for(const client of ['anon','authenticated']){
   sql(`CREATE ROLE cc_test_truncate_parent NOLOGIN; GRANT TRUNCATE ON public.menu_items,public.booking_customizations TO cc_test_truncate_parent; GRANT cc_test_truncate_parent TO ${client};`);
   const inheritedBefore=matrix();let failed;
   try{sql(execution);}catch(e){failed=e;}
   assert.ok(String(failed?.stderr).includes('Client TRUNCATE still inherited'));
   assert.equal(matrix(),inheritedBefore,'failed verification did not roll back REVOKE');
   check(`${client} inherited TRUNCATE aborts entire execution and rolls back direct revocations`,ensure('true','inheritance'));
   sql(`REVOKE cc_test_truncate_parent FROM ${client}; REVOKE ALL ON public.menu_items,public.booking_customizations FROM cc_test_truncate_parent; DROP ROLE cc_test_truncate_parent;`);
 }
 sql('CREATE ROLE cc_test_truncate_root NOLOGIN; CREATE ROLE cc_test_truncate_middle NOLOGIN; GRANT TRUNCATE ON public.booking_customizations TO cc_test_truncate_root; GRANT cc_test_truncate_root TO cc_test_truncate_middle; GRANT cc_test_truncate_middle TO authenticated;');
 let chainError;try{sql(execution);}catch(e){chainError=e;}
 assert.ok(String(chainError?.stderr).includes('Client TRUNCATE still inherited'));assert.equal(matrix(),before);
 check('multi-level inherited TRUNCATE also aborts and rolls back execution',ensure('true','multi-level inheritance'));
 sql('REVOKE cc_test_truncate_middle FROM authenticated; REVOKE cc_test_truncate_root FROM cc_test_truncate_middle; REVOKE ALL ON public.booking_customizations FROM cc_test_truncate_root; DROP ROLE cc_test_truncate_middle; DROP ROLE cc_test_truncate_root;');
 check('non-maintenance role cannot execute the migration',`${auth(customer)} ${fails(execution.replace(/^.*?BEGIN;/s,'').replace(/COMMIT;[\s\S]*$/,''),'P0001','maintenance role')}`);
 // PUBLIC source as well as directly granted client permissions is removed.
 sql('GRANT TRUNCATE ON public.menu_items,public.booking_customizations TO PUBLIC;');
 sql(execution);
 const after=matrix();
 for(const row of JSON.parse(after)){
   for(const p of ['select','insert','update','delete'])assert.equal(row[p],true,JSON.stringify(row));
   assert.equal(row.truncate,['postgres','service_role'].includes(row.role),JSON.stringify(row));
 }
 assert.equal(catalog(),unchanged,'non-TRUNCATE privileges, RLS, trigger or function drift');
 check('after execution only client TRUNCATE changes; owner/service permissions and all RLS/triggers/functions/CRUD remain',ensure('true','preservation'));
 for(const client of ['anon','authenticated'])check(`${client} actual TRUNCATE and cascading TRUNCATE are denied`,`${auth(customer,client)} ${fails('TRUNCATE public.booking_customizations;','42501')} ${fails('TRUNCATE public.menu_items CASCADE;','42501')}`);
 for(const trusted of ['postgres','service_role'])check(`${trusted} retains actual maintenance TRUNCATE`,`${trusted==='postgres'?'':auth(owner,trusted)} TRUNCATE public.menu_items CASCADE;`);
 check('customer detail insert/update/delete retains actual NULL WITH CHECK policy behavior',`${auth(customer)} INSERT INTO public.booking_customizations(booking_id,menu_item_id,price_per_guest) VALUES(${lit(oldAccepted)},${lit(menu)},0); UPDATE public.booking_customizations SET quantity=2 WHERE booking_id=${lit(oldAccepted)}; ${ensure(`(SELECT quantity=2 FROM public.booking_customizations WHERE booking_id=${lit(oldAccepted)})`,'customer update blocked')} DELETE FROM public.booking_customizations WHERE booking_id=${lit(oldAccepted)};`);
 check('caterer menu CRUD and cross-caterer denial remain functional',`${auth(owner)} INSERT INTO public.menu_items(id,caterer_id,category,name) VALUES(${lit(uid(9401))},${lit(cat)},'drink','Own menu'); UPDATE public.menu_items SET name='Edited' WHERE id=${lit(uid(9401))}; ${auth(other)} WITH changed AS (UPDATE public.menu_items SET name='Wrong owner' WHERE id=${lit(uid(9401))} RETURNING id) ${ensure('(SELECT count(*)=0 FROM changed)','RLS weakened')} ${auth(owner)} DELETE FROM public.menu_items WHERE id=${lit(uid(9401))};`);
 const originalAfter=matrix();sql(execution);assert.equal(matrix(),originalAfter);
 check('repeated hardening is permission-idempotent and pricing is not installed',ensure("to_regnamespace('cc_fixed_price1_private') IS NULL AND NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.packages'::regclass AND attname='max_guests' AND NOT attisdropped)",'pricing mixed in'));
 // A NOINHERIT/SET-capable membership is a separate role-escalation exposure:
 // reviewed has_table_privilege verification cannot detect this by itself.
 sql('CREATE ROLE cc_test_set_truncator NOLOGIN; GRANT TRUNCATE ON public.booking_customizations TO cc_test_set_truncator; GRANT cc_test_set_truncator TO authenticated WITH INHERIT FALSE, SET TRUE;');
 sql(execution); // Deliberately demonstrates the reviewed verifier's boundary.
 check('documented limitation: non-inherited SET ROLE capability needs separate membership review',`${auth(customer)} ${ensure("NOT has_table_privilege('authenticated','public.booking_customizations','TRUNCATE')",'unexpected inheritance')} SET LOCAL ROLE cc_test_set_truncator; TRUNCATE public.booking_customizations;`);
 check('read-only membership audit flags the non-inherited TRUNCATE-capable parent',ensure("pg_has_role('authenticated','cc_test_set_truncator','MEMBER') AND has_table_privilege('cc_test_set_truncator','public.booking_customizations','TRUNCATE') AND NOT has_table_privilege('authenticated','public.booking_customizations','TRUNCATE')",'membership audit missed SET ROLE path'));
 sql('REVOKE cc_test_set_truncator FROM authenticated; REVOKE ALL ON public.booking_customizations FROM cc_test_set_truncator; DROP ROLE cc_test_set_truncator;');
 sql(read('supabase/metadata/pricing_detail_truncate_hardening_verify.sql'));
 check('post-install verification SQL executes in READ ONLY transaction',ensure('true','verification'));
 console.log('Hardening effective matrix BEFORE: '+before);
 console.log('Hardening effective matrix AFTER: '+after);
 console.log('Hardening tested execution SHA256: '+crypto.createHash('sha256').update(execution).digest('hex'));
};
