// Runs only in the disposable metadata-based fixture; never a live connection.
const assert=require('node:assert/strict');
module.exports=async({sql,check,ensure,fails,auth,lit,uid,owner,other,customer,outsider,cat,pack,booking,read})=>{
  const proposal=read('supabase/proposals/caterer_reports_proposal.sql');
  const stop=/DO \$\$ BEGIN\r?\n  RAISE EXCEPTION 'PROPOSAL ONLY: caterer reports require separate installation approval';\r?\nEND \$\$;\r?\n/;
  assert.ok(stop.test(proposal));let error;
  try{sql(proposal);}catch(e){error=e;}
  assert.ok(String(error?.stderr).includes('PROPOSAL ONLY'));
  check('reports proposal stop rolls back before creating RPC',ensure("to_regprocedure('public.get_caterer_reports(date,date)') IS NULL",'unguarded install'));
  sql(proposal.replace(stop,''));
  const call=(start='2040-03-01',end='2040-03-31')=>`public.get_caterer_reports(${lit(start)},${lit(end)})`;
  const seed=()=>{
    let s=`UPDATE public.caterers SET subscription_plan='premium',subscription_expires_at=now()+interval '1 year' WHERE id=${lit(cat)};`;
    const statuses=['pending','confirmed','awaiting_payment','paid','ongoing','completed','rejected','cancelled'];
    statuses.forEach((status,i)=>s+=booking(uid(8000+i),status,300+i));
    s+=`UPDATE public.bookings SET created_at='2040-03-15T00:00:00Z' WHERE id IN (${statuses.map((_,i)=>lit(uid(8000+i))).join(',')});`;
    return s;
  };
  check('empty reports have zero counts, empty rankings and unavailable cash metrics',`${auth(owner)} ${ensure(`(${call()}->>'total')::int=0 AND ${call()}->'packages'='[]'::jsonb AND ${call()}->'actual_payments'='null'::jsonb AND ${call()}->>'expected_value'='0.00'`,'empty report')}`);
  check('all eight statuses counted once; committed expected value is not collected money',`${seed()} ${auth(owner)} ${ensure(`(${call()}->>'total')::int=8 AND (${call()}->>'expected_value')::numeric=60000 AND NOT EXISTS(SELECT 1 FROM jsonb_each_text(${call()}->'statuses') s WHERE s.value::int<>1) AND ${call()}->'actual_payments'='null'::jsonb`,'mixed status report')}`);
  check('package ranking includes archived historical packages without multiplying bookings',`${seed()} UPDATE public.packages SET publication_status='archived' WHERE id=${lit(pack)}; ${auth(owner)} ${ensure(`(${call()}->'packages'->0->>'count')::int=8 AND ${call()}->'packages'->0->>'id'=${lit(pack)}`,'history ranking')}`);
  for(const actor of [customer,outsider])check('customer cannot access financial aggregate RPC',`${auth(actor)} ${fails(`SELECT ${call()};`,'42501')}`);
  check('another caterer gets only their own empty report, not the first caterer cohort',`${seed()} ${auth(other)} ${ensure(`(${call()}->>'total')::int=0`,'cross-caterer leak')} ${fails(`SELECT public.get_caterer_reports('2040-03-01'::date,'2040-03-31'::date,${lit(cat)}::uuid);`,'42883')}`);
  check('anonymous users cannot execute reports',`${auth('','anon')} ${fails(`SELECT ${call()};`,'42501')}`);
  check('staff cannot use private caterer financial reports',`UPDATE public.profiles SET role='staff' WHERE id=${lit(outsider)}; ${auth(outsider)} ${fails(`SELECT ${call()};`,'42501')}`);
  check('invalid SQL date ranges fail explicitly',`${auth(owner)} ${fails(`SELECT ${call('2040-03-31','2040-03-01')};`,'22023')} ${fails(`SELECT ${call('2040-01-01','2041-01-01')};`,'22023')} ${fails("SELECT public.get_caterer_reports(NULL,'2040-03-31');",'22023')}`);
  check('Manila date bounds include midnight and exclude following midnight',`${booking(uid(8101),'pending',321)} ${booking(uid(8102),'pending',322)} ${booking(uid(8103),'pending',323)} UPDATE public.bookings SET created_at=CASE id WHEN ${lit(uid(8101))}::uuid THEN '2040-02-29T15:59:59Z'::timestamptz WHEN ${lit(uid(8102))}::uuid THEN '2040-02-29T16:00:00Z'::timestamptz ELSE '2040-03-31T16:00:00Z'::timestamptz END WHERE id IN (${lit(uid(8101))},${lit(uid(8102))},${lit(uid(8103))}); ${auth(owner)} ${ensure(`(${call()}->>'total')::int=1`,'Manila boundary')}`);
  check('monthly trends zero-fill gaps and use creation date rather than event date',`${booking(uid(8104),'pending',324)} UPDATE public.bookings SET created_at='2040-02-29T16:00:00Z' WHERE id=${lit(uid(8104))}; ${auth(owner)} ${ensure(`jsonb_array_length(${call('2040-02-01','2040-04-30')}->'months')=3 AND (${call('2040-02-01','2040-04-30')}->'months'->1->>'count')::int=1 AND (${call('2040-02-01','2040-04-30')}->'months'->0->>'count')::int=0`,'month trend')}`);
  check('refund obligations exclude processed refunds and identify active disputes separately',`${booking(uid(8105),'cancelled',325)} ${booking(uid(8106),'cancelled',326)} SELECT set_config('request.jwt.claim.role','service_role',true); UPDATE public.bookings SET created_at='2040-03-15T00:00:00Z',refund_status=CASE WHEN id=${lit(uid(8105))}::uuid THEN 'pending' ELSE 'processed' END,refund_amount=CASE WHEN id=${lit(uid(8105))}::uuid THEN 1200 ELSE 2500 END WHERE id IN (${lit(uid(8105))},${lit(uid(8106))}); INSERT INTO public.refund_disputes(booking_id,customer_id,reason) VALUES (${lit(uid(8105))},${lit(customer)},'Fixture refund investigation'); ${auth(owner)} ${ensure(`(${call()}->>'refund_obligations')::numeric=1200 AND (${call()}->>'refund_obligation_count')::int=1 AND (${call()}->>'open_refund_disputes')::int=1 AND ${call()}->'settled_refunds'='null'::jsonb`,'refund definitions')}`);
  check('repeated payment references and receipt state cannot inflate collections',`${seed()} SELECT set_config('request.jwt.claim.role','service_role',true); UPDATE public.bookings SET payment_reference='duplicate-callback-reference',payment_verified_at=now() WHERE id IN (${lit(uid(8003))},${lit(uid(8004))}); ${auth(owner)} ${ensure(`(${call()}->>'total')::int=8 AND ${call()}->'actual_payments'='null'::jsonb AND (${call()}->>'expected_value')::numeric=60000`,'guessed collection')}`);
  check('invalid stored estimates are unavailable instead of guessed',`${seed()} SELECT set_config('request.jwt.claim.role','service_role',true); UPDATE public.bookings SET total_cost=-1 WHERE id=${lit(uid(8001))}; ${auth(owner)} ${ensure(`${call()}->'expected_value'='null'::jsonb`,'invalid estimate')}`);
  check('NULL creation dates are excluded with an explicit count',`${booking(uid(8107),'pending',327)} UPDATE public.bookings SET created_at=NULL WHERE id=${lit(uid(8107))}; ${auth(owner)} ${ensure(`(${call()}->>'total')::int=0 AND (${call()}->>'undated_bookings')::int=1`,'undated count')}`);
  check('report works inside a read-only transaction',`SET TRANSACTION READ ONLY; ${auth(owner)} SELECT ${call()};`);
};
