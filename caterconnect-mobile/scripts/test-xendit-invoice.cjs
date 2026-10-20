// Offline provider/database mocks: no network, credentials, SQL or payments.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require('typescript');
const root=path.resolve(__dirname,'../..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const base='caterconnect-mobile/supabase/functions/xendit-webhook/';
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const mod={exports:{}};
vm.runInNewContext(compile(read(base+'verify-booking-invoice.ts')),{exports:mod.exports,module:mod,Date});
const {verifyBookingInvoice,centavos}=mod.exports;
const subscriptionModule={exports:{}};
vm.runInNewContext(compile(read(base+'verify-subscription-payment.ts')),{module:subscriptionModule,exports:subscriptionModule.exports,
 require:()=>({centavos})});
const {verifySubscriptionPayment}=subscriptionModule.exports;
const id='00000000-0000-0000-0000-000000000031';
const invoice=()=>({id:'invoice_test_1',external_id:`booking_${id}_123`,status:'PAID',currency:'PHP',amount:35000,paid_amount:35000,
  metadata:{type:'booking',booking_id:id,customer_id:'customer',user_id:'customer'}});
function fixture(options={}){
 const row={id,customer_id:'customer',caterer_id:'caterer',status:'confirmed',downpayment_amount:35000,payment_reference:null,
  payment_receipt_url:null,payment_verified_at:null,payment_submitted_at:null,refund_status:'none',...options.row};
 const writes=[];
 const client={from(table){assert.equal(table,'bookings');let patch;const filters=[];const q={
  eq(k,v){filters.push([k,v]);return q;},is(k,v){filters.push([k,v]);return q;},update(p){patch=p;return q;},
  async maybeSingle(){return{data:options.missing?null:{...row},error:options.readError?{code:'READ_ERROR'}:null};},
  select(){if(!patch)return q;if(options.race)options.race(row);if(options.writeError)return Promise.resolve({data:null,error:{code:'23514'}});
   const matches=filters.every(([k,v])=>row[k]===v);if(matches){writes.push(patch);Object.assign(row,patch);}return Promise.resolve({data:matches?[{id}]:[],error:null});},
 };return q;}};
 return{row,writes,client};
}
function webhook(options={}){
 const f=fixture(options);let handler;const gets=[],logs=[];let clientUses=0;
 vm.runInNewContext(compile(read(base+'index.ts')),{exports:{},Response,AbortSignal,btoa,Date,
  console:{log:(...args)=>logs.push(args),error:(...args)=>logs.push(args)},
  Deno:{env:{get:key=>options.missingSecret===key?'':key==='XENDIT_WEBHOOK_TOKEN'?'test-token':'test-configuration'}},
  fetch:async(url,init)=>{gets.push({url,init});if(options.networkError)throw Error('offline');return new Response(JSON.stringify(options.invoice??invoice()),{status:options.providerStatus??200});},
  require:name=>name.includes('verify-booking-invoice')?{verifyBookingInvoice}:name.includes('verify-subscription-payment')?{verifySubscriptionPayment}:
   name.includes('server.ts')?{serve:fn=>{handler=fn;}}:{createClient:()=>{clientUses++;return f.client;}},
 });
 return{...f,gets,logs,clientUses:()=>clientUses,run:(body=invoice(),token='test-token')=>handler(new Request('https://example.test',{method:'POST',headers:{'x-callback-token':token},body:JSON.stringify(body)}))};
}
test('PAID invoice is independently fetched and credits the exact booking once',async()=>{
 const f=webhook();assert.equal((await f.run()).status,200);assert.equal(f.row.status,'paid');assert.equal(f.writes.length,1);
 assert.equal(f.row.payment_reference,invoice().id);assert.ok(f.row.payment_verified_at);
 assert.equal(f.gets[0].url,'https://api.xendit.co/v2/invoices/invoice_test_1');assert.match(f.gets[0].init.headers.Authorization,/^Basic /);
 assert.deepEqual(Object.keys(f.writes[0]).sort(),['payment_receipt_url','payment_reference','payment_submitted_at','payment_verified_at','status']);
 assert.equal((await f.run()).status,200);assert.equal(f.writes.length,1);
});
test('wrapped PAID invoice needs no eWallet event/type',async()=>{
 const f=webhook();assert.equal((await f.run({data:invoice()})).status,200);assert.equal(f.row.status,'paid');
});
test('invalid/empty tokens and missing token configuration never fetch or write',async()=>{
 for(const options of [{},{missingSecret:'XENDIT_WEBHOOK_TOKEN'}]){const f=webhook(options);assert.equal((await f.run(invoice(),'')).status,options.missingSecret?503:401);assert.equal(f.gets.length,0);assert.equal(f.writes.length,0);}
 const f=webhook();assert.equal((await f.run(invoice(),'wrong')).status,401);
});
test('unpaid/expired/failed invoice callbacks never credit a booking',async()=>{
 for(const status of ['PENDING','EXPIRED','FAILED','CANCELLED']){const f=webhook();assert.equal((await f.run({...invoice(),status})).status,200);assert.equal(f.writes.length,0);assert.equal(f.gets.length,0);}
});
test('provider state overrides callback PAID, including false success payloads',async()=>{
 for(const status of ['PENDING','EXPIRED','FAILED']){const f=webhook({invoice:{...invoice(),status}});assert.equal((await f.run()).status,422);assert.equal(f.writes.length,0);}
});
test('wrong amount, currency, partial payment and nonfinite values fail closed',async()=>{
 for(const patch of [{amount:1},{paid_amount:1},{currency:'USD'},{amount:'NaN'},{paid_amount:null},{amount:35000.001},{refunded_amount:35000}]){
  const f=webhook({invoice:{...invoice(),...patch}});assert.equal((await f.run()).status,422);assert.equal(f.writes.length,0);
 }
});
test('wrong invoice ID, external ID and conflicting booking/customer metadata are rejected',async()=>{
 for(const patch of [{id:'another'},{external_id:`booking_${id}_456`},{metadata:null},{metadata:{type:'subscription'}},{metadata:{...invoice().metadata,user_id:'other'}},{metadata:{...invoice().metadata,customer_id:'other'}},{metadata:{...invoice().metadata,booking_id:'other'}}]){
  const f=webhook({invoice:{...invoice(),...patch}});assert.equal((await f.run()).status,422);assert.equal(f.writes.length,0);
 }
 const f=webhook({missing:true});assert.equal((await f.run()).status,422);
});
test('concurrent duplicate deliveries produce one payment transition',async()=>{
 const f=fixture();const results=await Promise.all([verifyBookingInvoice(f.client,invoice()),verifyBookingInvoice(f.client,invoice())]);
 assert.equal(f.writes.length,1);assert.equal(results.filter(r=>r.outcome==='processed').length,1);
 assert.equal((await verifyBookingInvoice(f.client,invoice())).outcome,'ignored');
});
test('protected statuses and refunds cannot be reopened by a payment event',async()=>{
 for(const status of ['pending','rejected','cancelled']){const f=webhook({row:{status}});assert.equal((await f.run()).status,200);assert.equal(f.writes.length,0);}
 for(const status of ['paid','ongoing','completed']){const f=webhook({row:{status}});assert.equal((await f.run()).status,422);assert.equal(f.writes.length,0);}
 const f=webhook({row:{refund_status:'pending'}});assert.equal((await f.run()).status,200);assert.equal(f.writes.length,0);
});
test('eWallet SUCCEEDED is independently verified and marks the exact booking Paid without manual review',async()=>{
 const p={...invoice(),id:'ewc_test_1',reference_id:invoice().external_id,status:'SUCCEEDED',charge_amount:35000,capture_amount:35000};
 delete p.external_id;
 const f=webhook({invoice:p});assert.equal((await f.run(p)).status,200);
 assert.ok(f.gets[0].url.includes('/ewallets/charges/'));assert.equal(f.row.status,'paid');assert.equal(f.writes.length,1);
 assert.equal((await f.run(p)).status,200);assert.equal(f.writes.length,1);
});
test('eWallet pending, failed, under-captured and unbound payments never mark Paid',async()=>{
 const p={...invoice(),id:'ewc_test_2',reference_id:invoice().external_id,status:'SUCCEEDED',charge_amount:35000,capture_amount:35000};delete p.external_id;
 for(const status of ['PENDING','FAILED']){const f=webhook({invoice:p});assert.equal((await f.run({...p,status})).status,200);assert.equal(f.gets.length,0);assert.equal(f.writes.length,0);}
 for(const patch of [{status:'PENDING'},{capture_amount:34999},{currency:'USD'},{metadata:{type:'booking'}}]){
  const f=webhook({invoice:{...p,...patch}});assert.equal((await f.run(p)).status,422);assert.equal(f.writes.length,0);
 }
});
test('legacy payment.succeeded notification without status still requires a successful provider lookup',async()=>{
 const p={...invoice(),id:'ewc_test_legacy',reference_id:invoice().external_id,status:'SUCCEEDED',charge_amount:35000,capture_amount:35000};delete p.external_id;
 const callback={event:'payment.succeeded',data:{id:p.id,reference_id:p.reference_id}};
 const ok=webhook({invoice:p});assert.equal((await ok.run(callback)).status,200);assert.equal(ok.row.status,'paid');
 const pending=webhook({invoice:{...p,status:'PENDING'}});assert.equal((await pending.run(callback)).status,422);assert.equal(pending.writes.length,0);
});
test('stale verified evidence cannot be silently acknowledged or replaced',async()=>{
 const f=webhook({row:{payment_verified_at:'verified'}});assert.equal((await f.run()).status,422);assert.equal(f.writes.length,0);
});
test('receipt/reference conflicts require review and cannot be overwritten',async()=>{
 for(const row of [{payment_receipt_url:'another'},{payment_reference:'another'},{status:'paid',payment_verified_at:'verified',payment_reference:'another'}]){const f=webhook({row});assert.equal((await f.run()).status,422);assert.equal(f.writes.length,0);}
 const f=webhook({row:{status:'awaiting_payment',payment_receipt_url:invoice().id}});assert.equal((await f.run()).status,200);assert.equal(f.row.status,'paid');
});
test('malformed booking callbacks fail explicitly without privileged database access',async()=>{
 for(const body of [null,[],{...invoice(),external_id:undefined},{...invoice(),id:'../invalid'}]){
  const f=webhook();assert.equal((await f.run(body)).status,400);assert.equal(f.clientUses(),0);assert.equal(f.gets.length,0);
 }
 for(const options of [{networkError:true},{providerStatus:500},{invoice:{...invoice(),id:'other'}}]){
  const f=webhook(options);assert.notEqual((await f.run()).status,200);assert.equal(f.clientUses(),0);assert.equal(f.writes.length,0);
 }
});
test('database/provider failures and CAS races return retry responses without writes',async()=>{
 for(const options of [{readError:true},{writeError:true},{providerStatus:401},{networkError:true},{missingSecret:'XENDIT_SECRET_KEY'},
  {race:r=>{r.status='cancelled';}},{race:r=>{r.downpayment_amount=99;}},{race:r=>{r.payment_receipt_url='other';}}]){
  const f=webhook(options);assert.equal((await f.run()).status,503);assert.equal(f.writes.length,0);
 }
});
test('money validation uses exact cents and logs omit customer/payment payloads',async()=>{
 assert.equal(centavos('35000.00'),3500000);for(const value of [0,-1,NaN,Infinity,null,'1.001'])assert.equal(centavos(value),null);
 const f=webhook();await f.run();const logs=JSON.stringify(f.logs);assert.ok(!logs.includes('customer'));assert.ok(!logs.includes('test-token'));assert.ok(!logs.includes('35000'));
});
test('refresh hook is read-only, focus/foreground scoped, serialized and cleaned up',()=>{
 const source=read('caterconnect-mobile/hooks/useBookingRefresh.ts');
 for(const value of ['useFocusEffect','AppState.currentState','running','15000','clearInterval','listener.remove()'])assert.ok(source.includes(value),value);
 for(const screen of ['(tabs)','(caterer)'])assert.ok(read(`caterconnect-mobile/app/${screen}/bookings.tsx`).includes('useBookingRefresh('));
 assert.ok(!source.includes('.update(')&&!source.includes('.insert('));
});
test('refresh lifecycle polls only while focused/active and serializes in-flight reads',async()=>{
 let focus,tick,foreground,removed=false,cleared=false,resolve,calls=0;
 const state={currentState:'active',addEventListener:(_,fn)=>{foreground=fn;return{remove:()=>{removed=true;}};}};
 const module={exports:{}};
 vm.runInNewContext(compile(read('caterconnect-mobile/hooks/useBookingRefresh.ts')),{module,exports:module.exports,console,
  setInterval:fn=>{tick=fn;return 1;},clearInterval:()=>{cleared=true;},require:name=>name==='react'?{useRef:v=>({current:v}),useCallback:fn=>fn}:
   name==='expo-router'?{useFocusEffect:fn=>{focus=fn;}}:{AppState:state}});
 module.exports.useBookingRefresh('owner:all',()=>{calls++;return new Promise(r=>{resolve=r;});});
 const cleanup=focus();assert.equal(calls,1);tick();assert.equal(calls,1);resolve();await new Promise(setImmediate);
 state.currentState='background';tick();assert.equal(calls,1);
 state.currentState='active';foreground('active');assert.equal(calls,2);resolve();await new Promise(setImmediate);
 cleanup();assert.ok(removed&&cleared);tick();foreground('active');assert.equal(calls,2);
});
