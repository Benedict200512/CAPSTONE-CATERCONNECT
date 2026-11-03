// Imports the original live catalog export, never a reconstructed activation
// function. Runs only through the disposable PostgreSQL harness. Plan/payment
// records below are synthetic fixtures, not exported customer/payment data.
const assert=require('node:assert/strict'),vm=require('node:vm'),crypto=require('node:crypto');
const ts=require('../../caterconnect-mobile/node_modules/typescript');
module.exports=async({sql,check,race,ensure,fails,auth,lit,uid,read,owner,other,customer,cat,cat2})=>{
 const raw=read('supabase/metadata/xendit_subscription_catalog_export.txt');
 const parsed=JSON.parse(raw.slice(raw.indexOf('{'),raw.lastIndexOf('}')+1));
 const data=JSON.parse(JSON.stringify(parsed),(k,v)=>typeof v==='string'?v.replace(/\\r/g,'\r').replace(/\\n/g,'\n'):v);
 const ident=s=>'"'+s.replaceAll('"','""')+'"';
 const letters={a:'INSERT',r:'SELECT',w:'UPDATE',d:'DELETE',D:'TRUNCATE',x:'REFERENCES',t:'TRIGGER',m:'MAINTAIN',X:'EXECUTE'};
 const acl=(kind,name,values)=>{
  let s=`REVOKE ALL ON ${kind} ${name} FROM PUBLIC,anon,authenticated,service_role;`;
  for(const value of values){const [,who,rights]=value.match(/^(.*?)=([^/]*)\//);assert.ok(!rights.includes('*'),'Review grant options');
   for(const ch of rights){assert.ok(letters[ch]);s+=`GRANT ${letters[ch]} ON ${kind} ${name} TO ${who?ident(who):'PUBLIC'};`;}}
  return s;
 };
 const pay=data.tables.find(t=>t.table.replace('public.','')==='subscription_payments');
 assert.ok(pay&&!pay.triggers);assert.equal(pay.owner,'postgres');
 sql(`CREATE TABLE public.subscription_payments(${pay.columns.map(c=>`${ident(c.name)} ${c.type}${c.default?' DEFAULT '+c.default:''}${c.not_null?' NOT NULL':''}`).join(',')});
   ${pay.constraints.map(c=>`ALTER TABLE public.subscription_payments ADD ${c};`).join('\n')}
   ${pay.indexes.filter(x=>!x.includes('subscription_payments_pkey')).map(x=>x+';').join('\n')}`);
 for(const table of data.tables){const name=table.table.replace('public.','');
  const actualColumns=JSON.parse(sql(`SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=${lit('public.'+name)}::regclass AND a.attnum>0 AND NOT a.attisdropped;`).trim());
  assert.deepEqual(actualColumns,table.columns,'original column/default definitions differ: '+name);
  sql(`${acl('TABLE','public.'+ident(name),table.acl)} ALTER TABLE public.${ident(name)} ${table.rls?'ENABLE':'DISABLE'} ROW LEVEL SECURITY;
    ALTER TABLE public.${ident(name)} ${table.force_rls?'FORCE':'NO FORCE'} ROW LEVEL SECURITY;`);
  assert.equal(sql(`SELECT count(*) FROM pg_policy WHERE polrelid=${lit('public.'+name)}::regclass;`).trim(),'0');
  for(const p of table.policies??[])sql(`CREATE POLICY ${ident(p.policyname)} ON public.${ident(name)} AS ${p.permissive} FOR ${p.cmd}
    TO ${p.roles.map(r=>r==='public'?'PUBLIC':ident(r)).join(',')}${p.qual?' USING ('+p.qual+')':''}${p.with_check?' WITH CHECK ('+p.with_check+')':''};`);
 }
 for(const f of data.activation_functions){assert.equal(f.owner,'postgres');sql(f.definition+';');
  sql(`ALTER FUNCTION public.${f.signature} OWNER TO postgres; ${acl('FUNCTION','public.'+f.signature,f.acl)}`);
 }
 const fn=data.activation_functions.find(f=>f.signature.startsWith('activate_paid_subscription('));
 const body=fn.definition.split('AS $function$')[1].split('$function$')[0];
 assert.equal(sql("SELECT prosrc FROM pg_proc WHERE oid='public.activate_paid_subscription(uuid,text,numeric,text,text)'::regprocedure;").trim(),body.trim());
 check('original activation body, SECURITY DEFINER, owner, search path and exact EXECUTE ACL imported',ensure(`(SELECT prosecdef AND proowner='postgres'::regrole AND proconfig=ARRAY['search_path=""'] AND proacl::text=${lit('{'+fn.acl.join(',')+'}')}::text FROM pg_proc WHERE oid='public.activate_paid_subscription(uuid,text,numeric,text,text)'::regprocedure)`,'activation catalog mismatch'));
 check('original payment policies/RLS and unique reference index imported',ensure("(SELECT relrowsecurity AND NOT relforcerowsecurity FROM pg_class WHERE oid='public.subscription_payments'::regclass) AND (SELECT count(*)=3 FROM pg_policy WHERE polrelid='public.subscription_payments'::regclass) AND EXISTS(SELECT 1 FROM pg_indexes WHERE indexname='subscription_payments_unique_reference' AND indexdef LIKE '%WHERE (payment_reference IS NOT NULL)%')",'payment catalog mismatch'));
 const service=auth(owner,'service_role');
 const call=(ref='cc_subscription_sql',c=cat,plan='basic',amount=299)=>`public.activate_paid_subscription(${lit(c)},${lit(plan)},${amount},${lit(ref)},'online')`;
 sql("UPDATE public.subscription_plans SET price=CASE id WHEN 'basic' THEN 299 WHEN 'standard' THEN 499 WHEN 'premium' THEN 999 ELSE 0 END;");
 for(const role of ['anon','authenticated','postgres','service_role']){
  check(`exact subscription payment grants retained for ${role}`,ensure(`has_table_privilege(${lit(role)},'public.subscription_payments','SELECT') AND has_table_privilege(${lit(role)},'public.subscription_payments','TRUNCATE') AND has_table_privilege(${lit(role)},'public.subscription_payments','TRIGGER') AND has_table_privilege(${lit(role)},'public.subscription_payments','REFERENCES') AND has_table_privilege(${lit(role)},'public.subscription_payments','INSERT')=${['postgres','service_role'].includes(role)} AND has_table_privilege(${lit(role)},'public.subscription_payments','UPDATE')=${['postgres','service_role'].includes(role)} AND has_table_privilege(${lit(role)},'public.subscription_payments','DELETE')=${['postgres','service_role'].includes(role)}`,'payment grants changed'));
 }
 for(const actor of [owner,other,customer])check('ordinary authenticated user cannot activate subscriptions or insert confirmed receipts',`${auth(actor)} ${fails(`SELECT ${call()};`,'42501')} ${fails(`INSERT INTO public.subscription_payments(caterer_id,plan_id,amount,status) VALUES(${lit(cat)},'basic',299,'confirmed');`,'42501')}`);
 check('anonymous role cannot execute paid activation',`${auth('','anon')} ${fails(`SELECT ${call()};`,'42501')}`);
 for(const [plan,amount] of [['basic',299],['standard',499],['premium',999]]){
  check(`original RPC activates ${plan} atomically with exact 30-day expiry and projected usage`,`${service} ${ensure(`${call('cc_subscription_sql',cat,plan,amount)}='activated'`,'activation result')}
   ${ensure(`(SELECT subscription_plan=${lit(plan)} AND subscription_expires_at=now()+interval '30 days' AND monthly_booking_count=(SELECT count(*) FROM public.bookings WHERE caterer_id=${lit(cat)} AND quota_month=date_trunc('month',clock_timestamp() AT TIME ZONE 'Asia/Manila')::date AND status IN ('confirmed','awaiting_payment','paid','ongoing','completed')) FROM public.caterers WHERE id=${lit(cat)})`,'activation expiry/quota')}
   ${ensure(`(SELECT count(*)=1 FROM public.subscription_payments WHERE payment_reference='cc_subscription_sql' AND status='confirmed' AND confirmed_at=now() AND amount=${amount})`,'receipt missing')}`);
 }
 check('original RPC rejects wrong prices, free plan and unknown caterer without inserting receipt',`${service} ${fails(`SELECT ${call('bad_amount',cat,'basic',1)};`,'P0001','amount mismatch')} ${fails(`SELECT ${call('bad_plan',cat,'free',0)};`,'P0001','Invalid paid')} ${fails(`SELECT ${call('bad_owner',uid(99999))};`,'P0001','Caterer not found')} ${ensure("NOT EXISTS(SELECT 1 FROM public.subscription_payments)",'invalid receipt inserted')}`);
 check('original RPC duplicate does not extend expiry or insert twice',`${service} SELECT ${call()}; UPDATE public.caterers SET subscription_expires_at='2040-01-01' WHERE id=${lit(cat)}; ${ensure(`${call()}='already_processed'`,'duplicate result')} ${ensure(`(SELECT subscription_expires_at='2040-01-01' FROM public.caterers WHERE id=${lit(cat)}) AND (SELECT count(*)=1 FROM public.subscription_payments WHERE payment_reference='cc_subscription_sql')`,'duplicate changed entitlement')}`);
 check('original existing-reference shortcut accepts a foreign receipt; webhook ownership checks are essential',`INSERT INTO public.subscription_payments(caterer_id,plan_id,amount,payment_reference,status,confirmed_at) VALUES(${lit(cat2)},'premium',999,'cc_foreign','confirmed',now()); ${service} ${ensure(`${call('cc_foreign')}='already_processed'`,'shortcut differs')} ${ensure(`NOT EXISTS(SELECT 1 FROM public.subscription_payments WHERE caterer_id=${lit(cat)})`,'foreign receipt used to activate')}`);
 // Actual transaction failure proves the inserted receipt rolls back if the
 // later caterer write is rejected. Fault injection exists only in test schema.
 sql(`CREATE FUNCTION test.reject_subscription_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test injected failure' USING ERRCODE='23514'; END $$;`);
 check('original activation rolls back payment INSERT when entitlement UPDATE fails',`CREATE TRIGGER test_reject_subscription BEFORE UPDATE ON public.caterers FOR EACH ROW EXECUTE FUNCTION test.reject_subscription_update(); ${service} ${fails(`SELECT ${call()};`,'23514','test injected failure')} ${ensure("NOT EXISTS(SELECT 1 FROM public.subscription_payments)",'partial subscription committed')}`);
 // Real overlapping sessions exercise the original lock and unique index.
 await race('original RPC concurrent callbacks serialize and create one payment',`${service} SELECT ${call('cc_concurrent')};`,`${service} SELECT ${call('cc_concurrent')};`);
 check('original concurrent activation produced one confirmed receipt and matching expiry',ensure(`(SELECT count(*)=1 FROM public.subscription_payments WHERE payment_reference='cc_concurrent') AND (SELECT c.subscription_expires_at=p.confirmed_at+interval '30 days' FROM public.caterers c JOIN public.subscription_payments p ON p.caterer_id=c.id WHERE p.payment_reference='cc_concurrent')`,'duplicate commit'));
 sql("DELETE FROM public.subscription_payments WHERE payment_reference='cc_concurrent';");
 // Run the actual TypeScript verification helper against real PostgreSQL reads
 // and RPC calls, not a fake activation implementation.
 const transpile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 const bmod={exports:{}};vm.runInNewContext(transpile(read('caterconnect-mobile/supabase/functions/xendit-webhook/verify-booking-invoice.ts')),{module:bmod,exports:bmod.exports,Date});
 const mod={exports:{}};vm.runInNewContext(transpile(read('caterconnect-mobile/supabase/functions/xendit-webhook/verify-subscription-payment.ts')),{module:mod,exports:mod.exports,Date,require:()=>bmod.exports});
 const readJSON=statement=>{const out=sql(`BEGIN; ${service} ${statement} COMMIT;`).trim().split(/\r?\n/);return JSON.parse(out[out.length-1]);};
 const client={from(table){assert.ok(['caterers','subscription_payments','subscription_plans'].includes(table));let columns,sort='',limit='';const filters=[];
  const q={select:s=>{assert.ok(/^[a-z_,]+$/.test(s));columns=s;return q;},eq:(k,v)=>{filters.push(`${ident(k)}=${lit(v)}`);return q;},order:(k,o)=>{sort=` ORDER BY ${ident(k)} ${o.ascending?'ASC':'DESC'}`;return q;},limit:n=>{assert.equal(n,1);limit=' LIMIT 1';return q;},
   async maybeSingle(){try{return{data:readJSON(`SELECT coalesce((SELECT row_to_json(r)::text FROM(SELECT ${columns} FROM public.${ident(table)} WHERE ${filters.join(' AND ')}${sort}${limit}) r),'null');`),error:null};}catch{return{data:null,error:{code:'TEST_READ_FAILED'}};}}};return q;},
  async rpc(name,args){assert.equal(name,'activate_paid_subscription');try{return{data:readJSON(`SELECT to_json(public.activate_paid_subscription(${lit(args.p_caterer_id)},${lit(args.p_plan_id)},${Number(args.p_amount)},${lit(args.p_payment_reference)},${lit(args.p_payment_method)}));`),error:null};}catch{return{data:null,error:{code:'TEST_RPC_FAILED'}};}}};
 const payment=(id='cc_helper',extra={})=>({id,external_id:`sub_${cat}_basic_123`,status:'PAID',currency:'PHP',amount:299,paid_amount:299,metadata:{type:'subscription',user_id:owner,caterer_id:cat,plan_id:'basic'},...extra});
 const verify=p=>mod.exports.verifySubscriptionPayment(client,p);
 assert.equal((await verify(payment())).code,'SUBSCRIPTION_ACTIVATED');
 const expiry=sql(`SELECT subscription_expires_at FROM public.caterers WHERE id=${lit(cat)};`).trim();
 assert.equal((await verify(payment())).code,'SUBSCRIPTION_ALREADY_PROCESSED');
 check('actual webhook helper calls original RPC and confirms committed activation/duplicate safely',ensure(`(SELECT count(*)=1 FROM public.subscription_payments WHERE payment_reference='cc_helper') AND (SELECT subscription_expires_at=${lit(expiry)}::timestamptz FROM public.caterers WHERE id=${lit(cat)})`,'helper duplicate changed term'));
 sql(`INSERT INTO public.subscription_payments(caterer_id,plan_id,amount,payment_reference,status,confirmed_at) VALUES(${lit(cat2)},'basic',299,'cc_foreign_helper','confirmed',now()),(${lit(cat)},'basic',299,'cc_pending_helper','pending',NULL);`);
 assert.equal((await verify(payment('cc_foreign_helper'))).code,'SUBSCRIPTION_RECEIPT_CONFLICT');
 assert.equal((await verify(payment('cc_pending_helper'))).code,'SUBSCRIPTION_RECEIPT_CONFLICT');
 check('actual helper rejects foreign/pending original-table references instead of trusting already_processed',ensure(`NOT EXISTS(SELECT 1 FROM public.subscription_payments WHERE payment_reference='cc_foreign_helper' AND caterer_id=${lit(cat)}) AND (SELECT status='pending' FROM public.subscription_payments WHERE payment_reference='cc_pending_helper')`,'reference reused'));
 sql(`UPDATE public.subscription_payments SET confirmed_at='2000-01-01' WHERE payment_reference='cc_helper'; UPDATE public.caterers SET subscription_expires_at='2000-01-31',subscription_plan='basic' WHERE id=${lit(cat)};`);
 assert.equal((await verify(payment())).code,'SUBSCRIPTION_ALREADY_PROCESSED_EXPIRED');
 check('actual helper expired duplicate does not reactivate or reset quota',ensure(`(SELECT subscription_expires_at='2000-01-31' FROM public.caterers WHERE id=${lit(cat)})`,'expired renewal'));
 assert.equal((await verify(payment('cc_wrong_amount',{amount:1,paid_amount:1}))).code,'SUBSCRIPTION_AMOUNT_MISMATCH');
 check('actual helper rejects wrong authoritative plan price without a receipt',ensure("NOT EXISTS(SELECT 1 FROM public.subscription_payments WHERE payment_reference='cc_wrong_amount')",'wrong amount inserted'));
 sql('CREATE TRIGGER test_reject_subscription BEFORE UPDATE ON public.caterers FOR EACH ROW EXECUTE FUNCTION test.reject_subscription_update();');
 try{assert.equal((await verify(payment('cc_failed_commit'))).outcome,'retry');}finally{sql('DROP TRIGGER test_reject_subscription ON public.caterers;');}
 check('actual helper returns retry on original RPC failure and no partial receipt survives',ensure("NOT EXISTS(SELECT 1 FROM public.subscription_payments WHERE payment_reference='cc_failed_commit')",'partial commit'));
 for(const [method,fields] of [['gcash',{payment_method:'EWALLET',ewallet_type:'GCASH'}],['maya',{payment_channel:'PAYMAYA'}],['card',{payment_method:'CREDIT_CARD'}],['bank_transfer',{payment_method:'BANK_TRANSFER',bank_code:'BPI'}],['online',{}]]){
  const ref='cc_channel_'+method;
  assert.equal((await verify(payment(ref,fields))).code,'SUBSCRIPTION_ACTIVATED');
  const savedExpiry=sql(`SELECT subscription_expires_at FROM public.caterers WHERE id=${lit(cat)};`).trim();
  assert.equal((await verify(payment(ref,{payment_channel:'GCASH'}))).code,'SUBSCRIPTION_ALREADY_PROCESSED');
  check(`actual original RPC stores verified ${method} and duplicate leaves receipt/expiry unchanged`,ensure(`(SELECT count(*)=1 AND bool_and(payment_method=${lit(method)}) FROM public.subscription_payments WHERE payment_reference=${lit(ref)}) AND (SELECT subscription_expires_at=${lit(savedExpiry)}::timestamptz FROM public.caterers WHERE id=${lit(cat)})`,'payment method or duplicate changed'));
 }
 console.log('Original activation function SHA256: '+crypto.createHash('sha256').update(fn.definition).digest('hex'));
};
