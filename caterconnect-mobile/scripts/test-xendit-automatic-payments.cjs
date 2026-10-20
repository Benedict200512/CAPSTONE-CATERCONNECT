// Offline provider/database mocks. Never performs a payment or hosted request.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const root=path.resolve(__dirname,'../..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const base='caterconnect-mobile/supabase/functions/';
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
function load(file,deps={}){const module={exports:{}};vm.runInNewContext(compile(read(base+file)),{module,exports:module.exports,Date,require:n=>{assert.ok(n in deps,n);return deps[n];}});return module.exports;}
const booking=load('xendit-webhook/verify-booking-invoice.ts');
const subscription=load('xendit-webhook/verify-subscription-payment.ts',{'./verify-booking-invoice.ts':booking});
const checkout=load('xendit-payment/create-checkout.ts',{'../xendit-webhook/verify-booking-invoice.ts':booking,'../xendit-webhook/verify-subscription-payment.ts':subscription});
const id='00000000-0000-0000-0000-000000000031',cat='00000000-0000-0000-0000-000000000011';
function client(rows={},options={}){const calls=[];return{calls,auth:{getUser:async()=>({data:{user:options.noUser?null:{id:'owner'}},error:null})},from(table){calls.push(table);const filters=[];const q={select:()=>q,eq:(k,v)=>{filters.push([k,v]);return q;},maybeSingle:async()=>({data:filters.every(([k,v])=>rows[table]?.[k]===v)?rows[table]:null,error:options.error?{code:'XX000'}:null})};return q;}};}
const subPayment=()=>({id:'invoice_sub_1',external_id:`sub_${cat}_basic_123`,status:'PAID',currency:'PHP',amount:299,paid_amount:299,metadata:{type:'subscription',caterer_id:cat,plan_id:'basic',user_id:'owner'}});
test('subscription PAID is validated against authoritative caterer ownership and plan price',async()=>{
 const c=activationFixture();
 const result=await subscription.verifySubscriptionPayment(c,subPayment());
 assert.equal(result.outcome,'processed');assert.equal(result.code,'SUBSCRIPTION_ACTIVATED');assert.equal(c.rpcCalls.length,1);
 assert.equal(c.rpcCalls[0].name,'activate_paid_subscription');assert.equal(c.rpcCalls[0].args.p_payment_method,'online');
});
// Stateful mock of the supplied RPC contract, not a claimed copy of its SQL.
// It serializes activation and models an atomic receipt/plan commit. Actual
// deployed function concurrency still requires its original catalog export.
function activationFixture(options={}){
 const now=new Date().toISOString(),expiry=new Date(Date.parse(now)+30*86400000).toISOString();
 const rows={caterers:{id:cat,user_id:'owner',subscription_plan:'free',subscription_expires_at:null,monthly_booking_count:7},
   subscription_plans:{id:'basic',price:299},subscription_payments:null,...options.rows};
 const rpcCalls=[];let queue=Promise.resolve();
 const c={rows,rpcCalls,from(table){const filters=[];const q={select:()=>q,eq:(k,v)=>{filters.push([k,v]);return q;},order:()=>q,limit:()=>q,
  async maybeSingle(){if(options.readError===table)return{data:null,error:{code:'XX000'}};
   const candidates=table==='subscription_payments'&&Array.isArray(rows[table])?rows[table]:[rows[table]];
   const row=candidates.find(r=>r&&filters.every(([k,v])=>r[k]===v));return{data:row?{...row}:null,error:null};}};return q;},
  rpc(name,args){rpcCalls.push({name,args});const result=queue.then(()=>{
   if(options.rpcError)return{data:null,error:{code:options.rpcError}};
   if(options.beforeRpc)options.beforeRpc(rows);
   if(rows.subscription_payments)return{data:'already_processed',error:null};
   if(options.unexpectedResult)return{data:'unknown',error:null};
   if(!options.missingCommit){rows.subscription_payments={id:'receipt',caterer_id:args.p_caterer_id,plan_id:args.p_plan_id,amount:args.p_amount,payment_reference:args.p_payment_reference,payment_method:args.p_payment_method,status:'confirmed',confirmed_at:now};
    rows.caterers={...rows.caterers,subscription_plan:args.p_plan_id,subscription_expires_at:expiry};}
   return{data:'activated',error:null};});queue=result.then(()=>{});return result;}};
 return c;
}
function receipt(overrides={}){return{id:'receipt',caterer_id:cat,plan_id:'basic',amount:299,payment_reference:'invoice_sub_1',status:'confirmed',confirmed_at:'2026-10-20T00:00:00Z',...overrides};}
test('provider payment channels are normalized and passed to the existing activation RPC',async()=>{
 for(const [fields,expected] of [
  [{payment_method:'EWALLET',ewallet_type:'GCASH'},'gcash'],
  [{payment_method:'EWALLET',payment_channel:'PAYMAYA'},'maya'],
  [{channel_code:'PH_GCASH'},'gcash'],[{channel_code:'PH_PAYMAYA'},'maya'],
  [{payment_method:'credit-card'},'card'],[{payment_method:'DEBIT_CARD'},'card'],
  [{payment_method:'BANK_TRANSFER',bank_code:'BPI'},'bank_transfer'],
  [{payment_channel:'PNB_ONLINE_BANKING'},'bank_transfer'],
  [{payment_method:'VIRTUAL_ACCOUNT'},'bank_transfer'],[{},'online'],
  [{payment_method:'EWALLET'},'online'],[{payment_method:null,payment_channel:42},'online'],
  [{payment_method:'EWALLET',payment_channel:'GRABPAY'},'grabpay'],
 ]){
  const c=activationFixture();assert.equal((await subscription.verifySubscriptionPayment(c,{...subPayment(),...fields})).outcome,'processed');
  assert.equal(c.rpcCalls[0].args.p_payment_method,expected);assert.equal(c.rows.subscription_payments.payment_method,expected);
 }
});
test('metadata preferences and available methods never identify the actual payment channel',async()=>{
 const payment={...subPayment(),metadata:{...subPayment().metadata,payment_method:'gcash'},available_ewallets:[{ewallet_type:'GCASH'}]};
 const c=activationFixture();await subscription.verifySubscriptionPayment(c,payment);assert.equal(c.rpcCalls[0].args.p_payment_method,'online');
 const card=activationFixture();await subscription.verifySubscriptionPayment(card,{...payment,payment_method:'CREDIT_CARD'});assert.equal(card.rpcCalls[0].args.p_payment_method,'card');
});
test('duplicate and concurrent deliveries retain the originally recorded method and subscription term',async()=>{
 const c=activationFixture(),p={...subPayment(),payment_channel:'GCASH'};
 await Promise.all([subscription.verifySubscriptionPayment(c,p),subscription.verifySubscriptionPayment(c,p)]);
 const calls=c.rpcCalls.length,expiry=c.rows.caterers.subscription_expires_at;
 assert.equal((await subscription.verifySubscriptionPayment(c,{...p,payment_channel:'PAYMAYA'})).outcome,'ignored');
 assert.equal(c.rows.subscription_payments.payment_method,'gcash');assert.equal(c.rpcCalls.length,calls);assert.equal(c.rows.caterers.subscription_expires_at,expiry);
 const historical=activationFixture({rows:{subscription_payments:receipt({payment_method:'online'}),caterers:{id:cat,user_id:'owner',subscription_plan:'basic',subscription_expires_at:'2026-11-19T00:00:00Z'}}});
 await subscription.verifySubscriptionPayment(historical,p);assert.equal(historical.rpcCalls.length,0);assert.equal(historical.rows.subscription_payments.payment_method,'online');
});
test('duplicate and concurrent subscription deliveries activate once without extending expiry',async()=>{
 const c=activationFixture();const results=await Promise.all([subscription.verifySubscriptionPayment(c,subPayment()),subscription.verifySubscriptionPayment(c,subPayment())]);
 assert.equal(results.filter(r=>r.outcome==='processed').length,1);assert.equal(results.filter(r=>r.outcome==='ignored').length,1);
 const expiry=c.rows.caterers.subscription_expires_at,usage=c.rows.caterers.monthly_booking_count;
 assert.equal((await subscription.verifySubscriptionPayment(c,subPayment())).code,'SUBSCRIPTION_ALREADY_PROCESSED');
 assert.equal(c.rows.caterers.subscription_expires_at,expiry);assert.equal(c.rows.caterers.monthly_booking_count,usage);
});
test('existing reference must belong to this caterer/plan/amount and be confirmed',async()=>{
 for(const patch of [{caterer_id:'other'},{plan_id:'premium'},{amount:1},{status:'pending'},{status:'rejected'}]){
  const c=activationFixture({rows:{subscription_payments:receipt(patch)}});assert.equal((await subscription.verifySubscriptionPayment(c,subPayment())).code,'SUBSCRIPTION_RECEIPT_CONFLICT');assert.equal(c.rpcCalls.length,0);
 }
});
test('already_processed RPC result is never accepted without matching committed receipt and entitlement',async()=>{
 for(const patch of [{caterer_id:'other'},{plan_id:'premium'},{amount:1},{status:'pending'}]){
  const c=activationFixture({beforeRpc:r=>{r.subscription_payments=receipt(patch);}});
  assert.equal((await subscription.verifySubscriptionPayment(c,subPayment())).outcome,'rejected');
 }
 const c=activationFixture({beforeRpc:r=>{r.subscription_payments=receipt();}});
 assert.equal((await subscription.verifySubscriptionPayment(c,subPayment())).code,'SUBSCRIPTION_ENTITLEMENT_MISMATCH');
});
test('expired duplicate does not activate a new period or reset usage',async()=>{
 const c=activationFixture({rows:{subscription_payments:receipt({confirmed_at:'2000-01-01T00:00:00Z'}),
  caterers:{id:cat,user_id:'owner',subscription_plan:'basic',subscription_expires_at:'2000-01-31T00:00:00Z',monthly_booking_count:7}}});
 assert.equal((await subscription.verifySubscriptionPayment(c,subPayment())).code,'SUBSCRIPTION_ALREADY_PROCESSED_EXPIRED');assert.equal(c.rpcCalls.length,0);assert.equal(c.rows.caterers.monthly_booking_count,7);
});
test('historical duplicate respects a later confirmed subscription without downgrading it',async()=>{
 const c=activationFixture({rows:{subscription_payments:[receipt(),receipt({id:'later',payment_reference:'later_invoice',plan_id:'premium',amount:999,confirmed_at:'2026-10-21T00:00:00Z'})].reverse(),
  caterers:{id:cat,user_id:'owner',subscription_plan:'premium',subscription_expires_at:'2026-11-20T00:00:00Z'}}});
 assert.equal((await subscription.verifySubscriptionPayment(c,subPayment())).code,'SUBSCRIPTION_ALREADY_PROCESSED_SUPERSEDED');assert.equal(c.rpcCalls.length,0);
});
test('RPC failures, missing commits and unexpected results are retryable rather than acknowledged',async()=>{
 for(const code of ['23505','23514','42501','PGRST202','XX000']){
  const c=activationFixture({rpcError:code});assert.equal((await subscription.verifySubscriptionPayment(c,subPayment())).outcome,'retry');assert.equal(c.rows.caterers.subscription_plan,'free');assert.equal(c.rows.subscription_payments,null);
 }
 for(const options of [{missingCommit:true},{unexpectedResult:true},{readError:'subscription_payments'}])assert.equal((await subscription.verifySubscriptionPayment(activationFixture(options),subPayment())).outcome,'retry');
});
test('all three purchased paid plans reach the existing RPC with their exact authoritative amount',async()=>{
 for(const [plan,amount] of [['basic',299],['standard',499],['premium',999]]){
  const c=activationFixture({rows:{subscription_plans:{id:plan,price:amount}}});
  const payment={...subPayment(),external_id:`sub_${cat}_${plan}_123`,amount,paid_amount:amount,metadata:{...subPayment().metadata,plan_id:plan}};
  assert.equal((await subscription.verifySubscriptionPayment(c,payment)).code,'SUBSCRIPTION_ACTIVATED');
  assert.equal(c.rpcCalls[0].args.p_plan_id,plan);assert.equal(c.rpcCalls[0].args.p_amount,amount);assert.equal(c.rows.caterers.subscription_plan,plan);
  assert.ok(Math.abs(Date.parse(c.rows.caterers.subscription_expires_at)-Date.parse(c.rows.subscription_payments.confirmed_at)-30*86400000)<1);
 }
});
test('older owner-bound invoice metadata can use the verified reference; conflicting duplicated bindings are rejected',async()=>{
 const payment={...subPayment(),metadata:{type:'subscription',user_id:'owner'}};
 assert.equal((await subscription.verifySubscriptionPayment(activationFixture(),payment)).code,'SUBSCRIPTION_ACTIVATED');
 for(const patch of [{caterer_id:'another'},{plan_id:'premium'},{user_id:'another'}]){
  const c=activationFixture();assert.equal((await subscription.verifySubscriptionPayment(c,{...payment,metadata:{...payment.metadata,...patch}})).outcome,'rejected');assert.equal(c.rpcCalls.length,0);
 }
});
function subscriptionWebhook(c,provider,options={}){
 let handler;const gets=[],logs=[];vm.runInNewContext(compile(read(base+'xendit-webhook/index.ts')),{exports:{},Response,AbortSignal,btoa,Date,
  console:{log:(...args)=>logs.push(args),error:(...args)=>logs.push(args)},Deno:{env:{get:key=>key==='XENDIT_WEBHOOK_TOKEN'?'test-token':'test-config'}},
  fetch:async url=>{gets.push(url);if(options.networkError)throw Error('offline');return new Response(JSON.stringify(provider),{status:options.providerStatus??200});},
  require:n=>n.includes('verify-booking-invoice')?booking:n.includes('verify-subscription-payment')?subscription:n.includes('server.ts')?{serve:fn=>{handler=fn;}}:{createClient:()=>c}});
 return{gets,logs,run:(body=provider,token='test-token')=>handler(new Request('https://example.test',{method:'POST',headers:{'x-callback-token':token},body:JSON.stringify(body)}))};
}
test('authenticated PAID subscription webhook fetches provider and commits activation before HTTP 200',async()=>{
 const c=activationFixture(),f=subscriptionWebhook(c,subPayment());assert.equal((await f.run()).status,200);
 assert.ok(f.gets[0].includes('/v2/invoices/'));assert.equal(c.rows.caterers.subscription_plan,'basic');
 const before=c.rows.caterers.subscription_expires_at;assert.equal((await f.run()).status,200);assert.equal(c.rpcCalls.length,1);assert.equal(c.rows.caterers.subscription_expires_at,before);
 assert.ok(!JSON.stringify(f.logs).includes('owner')&&!JSON.stringify(f.logs).includes('test-token'));
});
test('webhook records independently fetched channel rather than callback preference',async()=>{
 const c=activationFixture(),f=subscriptionWebhook(c,{...subPayment(),payment_method:'EWALLET',payment_channel:'PAYMAYA'});
 assert.equal((await f.run({...subPayment(),payment_channel:'GCASH'})).status,200);
 assert.equal(c.rows.subscription_payments.payment_method,'maya');
 assert.equal((await f.run()).status,200);assert.equal(c.rpcCalls.length,1);
});
test('subscription webhook rejects forged callbacks and wrong provider state and retries database/provider failures',async()=>{
 const c=activationFixture(),f=subscriptionWebhook(c,subPayment());assert.equal((await f.run(subPayment(),'wrong')).status,401);assert.equal(f.gets.length,0);assert.equal(c.rpcCalls.length,0);
 for(const status of ['PENDING','FAILED','EXPIRED'])assert.equal((await subscriptionWebhook(activationFixture(),subPayment()).run({...subPayment(),status})).status,200);
 const failed=activationFixture({rpcError:'23514'});assert.equal((await subscriptionWebhook(failed,subPayment()).run()).status,503);assert.equal(failed.rows.caterers.subscription_plan,'free');
 assert.equal((await subscriptionWebhook(activationFixture(),{...subPayment(),paid_amount:1}).run()).status,422);
 assert.equal((await subscriptionWebhook(activationFixture(),{...subPayment(),status:'PENDING'}).run(subPayment())).status,422);
 assert.equal((await subscriptionWebhook(activationFixture(),subPayment(),{networkError:true}).run()).status,503);
});
test('verified subscription eWallet capture also reaches the same atomic activation RPC',async()=>{
 const p={...subPayment(),reference_id:subPayment().external_id,id:'ewc_subscription',status:'SUCCEEDED',charge_amount:299,capture_amount:299,channel_code:'PH_GCASH'};delete p.external_id;
 const c=activationFixture(),f=subscriptionWebhook(c,p);assert.equal((await f.run()).status,200);assert.ok(f.gets[0].includes('/ewallets/charges/'));assert.equal(c.rpcCalls[0].args.p_payment_reference,p.id);assert.equal(c.rows.subscription_payments.payment_method,'gcash');
});
test('subscription pending, failed, wrong currency, amount, owner and reference are rejected without writes',async()=>{
 const rows={caterers:{id:cat,user_id:'owner'},subscription_plans:{id:'basic',price:299}};
 for(const patch of [{status:'PENDING'},{status:'FAILED'},{paid_amount:298},{currency:'USD'},
  {external_id:`sub_${cat}_premium_123`},{metadata:{...subPayment().metadata,user_id:'another'}}]){
  assert.equal((await subscription.verifySubscriptionPayment(client(rows),{...subPayment(),...patch})).outcome,'rejected');
 }
 assert.equal((await subscription.verifySubscriptionPayment(client({...rows,subscription_plans:{id:'basic',price:300}}),subPayment())).code,'SUBSCRIPTION_AMOUNT_MISMATCH');
 assert.equal((await subscription.verifySubscriptionPayment(client(rows,{error:true}),subPayment())).outcome,'retry');
});
test('booking checkout ignores client identities and generates a bound invoice using trusted downpayment',async()=>{
 const c=client({bookings:{id,customer_id:'owner',status:'confirmed',downpayment_amount:35000,payment_verified_at:null,payment_reference:null,payment_receipt_url:null,refund_status:'none'}});
 const q=await checkout.checkoutQuote(c,'owner',{type:'booking',referenceId:`booking_${id}_123`,amount:35000,customerName:'forged',customerEmail:'forged@example.test'});
 assert.equal(q.amount,35000);assert.equal(q.currency,'PHP');assert.equal(q.metadata.customer_id,'owner');assert.equal(q.metadata.booking_id,id);
 assert.ok(!JSON.stringify(q).includes('forged'));assert.match(q.external_id,booking.bookingReference);
 await assert.rejects(checkout.checkoutQuote(c,'owner',{type:'booking',referenceId:`booking_${id}_123`,amount:1}),/STALE_AMOUNT/);
 await assert.rejects(checkout.checkoutQuote(c,'another',{type:'booking',referenceId:`booking_${id}_123`,amount:35000}),/NOT_PAYABLE/);
});
test('subscription checkout uses authoritative plan price and owner-bound metadata',async()=>{
 const c=client({caterers:{id:cat,user_id:'owner'},subscription_plans:{id:'basic',price:299}});
 const q=await checkout.checkoutQuote(c,'owner',{type:'subscription',referenceId:`sub_${cat}_basic_123`,amount:299,paymentMethod:'maya'});
 assert.equal(q.metadata.caterer_id,cat);assert.equal(q.metadata.plan_id,'basic');assert.equal(q.metadata.user_id,'owner');assert.equal(q.amount,299);
 await assert.rejects(checkout.checkoutQuote(c,'owner',{type:'subscription',referenceId:`sub_${cat}_basic_123`,amount:1}),/STALE_AMOUNT/);
 await assert.rejects(checkout.checkoutQuote(c,'another',{type:'subscription',referenceId:`sub_${cat}_basic_123`,amount:299}),/OWNER_MISMATCH/);
});
function statusHandler(c,provider){let handler;const gets=[];vm.runInNewContext(compile(read(base+'xendit-check-status/index.ts')),{exports:{},Response,AbortSignal,btoa,Date,console,
 Deno:{env:{get:()=> 'test-config'}},fetch:async url=>{gets.push(url);return new Response(JSON.stringify(provider));},
 require:n=>n.includes('verify-booking-invoice')?booking:n.includes('verify-subscription-payment')?subscription:n.includes('server.ts')?{serve:fn=>{handler=fn;}}:{createClient:()=>c}});
 return{gets,run:()=>handler(new Request('https://example.test',{method:'POST',headers:{authorization:'Bearer test'},body:JSON.stringify({chargeId:provider.id})}))};}
test('status lookup reports success only when the matching booking is verified in the database',async()=>{
 const payment={id:'invoice_1',external_id:`booking_${id}_123`,status:'PAID'};
 for(const verified of [null,'2026-10-20T00:00:00Z']){
  const c=client({bookings:{id,customer_id:'owner',status:verified?'paid':'confirmed',payment_verified_at:verified,payment_reference:verified?'invoice_1':null}});
  const f=statusHandler(c,payment),res=await f.run();assert.equal(res.status,200);assert.equal((await res.json()).databaseConfirmed,!!verified);assert.ok(f.gets[0].includes('/v2/invoices/'));
 }
});
test('status lookup refuses another customer and database failures without exposing metadata',async()=>{
 const payment={id:'invoice_1',external_id:`booking_${id}_123`,status:'PAID',metadata:{private:'must not return'}};
 assert.equal((await statusHandler(client({bookings:{id,customer_id:'other'}}),payment).run()).status,403);
 assert.equal((await statusHandler(client({},{error:true}),payment).run()).status,503);
 assert.equal((await statusHandler(client({},{noUser:true}),payment).run()).status,401);
});
test('subscription status lookup requires both confirmed payment receipt and active matching entitlement',async()=>{
 for(const confirmed of [false,true]){
  const c=client({caterers:{id:cat,user_id:'owner',subscription_plan:confirmed?'basic':'free',subscription_expires_at:'2099-01-01'},subscription_payments:{caterer_id:cat,payment_reference:'invoice_sub_1',status:'confirmed',plan_id:'basic',amount:299,confirmed_at:'2098-12-02T00:00:00Z'}});
  const res=await statusHandler(c,subPayment()).run();assert.equal(res.status,200);assert.equal((await res.json()).databaseConfirmed,confirmed);
 }
});
test('subscription status cannot report an unactivated or mismatched receipt as confirmed',async()=>{
 const baseReceipt={caterer_id:cat,payment_reference:'invoice_sub_1',status:'confirmed',plan_id:'basic',amount:299,confirmed_at:'2098-12-02T00:00:00Z'};
 for(const patch of [{amount:1},{plan_id:'premium'},{confirmed_at:'2098-12-01T00:00:00Z'},{confirmed_at:null}]){
  const c=client({caterers:{id:cat,user_id:'owner',subscription_plan:'basic',subscription_expires_at:'2099-01-01'},subscription_payments:{...baseReceipt,...patch}});
  assert.equal((await(await statusHandler(c,subPayment()).run()).json()).databaseConfirmed,false);
 }
});
test('mobile confirmation requires databaseConfirmed and both billing screens refresh read-only',()=>{
 assert.ok(read('caterconnect-mobile/lib/xendit.ts').includes('data.databaseConfirmed === true'));
 for(const file of ['PaymentScreen.tsx','SubscriptionScreen.tsx'])assert.ok(read('caterconnect-mobile/screens/auth/'+file).includes('useBookingRefresh('));
 const source=read(base+'xendit-check-status/index.ts');assert.ok(!source.includes('.update(')&&!source.includes('.insert(')&&!source.includes('.rpc('));
});
