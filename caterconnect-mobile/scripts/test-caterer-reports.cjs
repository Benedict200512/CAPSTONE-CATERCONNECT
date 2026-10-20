const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require('typescript');
const root=path.resolve(__dirname,'../..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const range={start:'2026-10-01',end:'2026-10-31'};
const empty=()=>({...range,timezone:'Asia/Manila',date_basis:'booking_created_at',total:0,
  statuses:Object.fromEntries(['pending','confirmed','awaiting_payment','paid','ongoing','completed','rejected','cancelled'].map(s=>[s,0])),
  months:[{month:'2026-10-01',count:0}],packages:[],expected_value:'0.00',refund_obligations:'0.00',
  refund_obligation_count:0,open_refund_disputes:0,undated_bookings:0,actual_payments:null,settled_refunds:null,financial_evidence:'unavailable'});
function fixture(result={data:empty(),error:null}){
  const calls=[],module={exports:{}};
  const compiled=ts.transpileModule(read('caterconnect-mobile/lib/catererReports.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  vm.runInNewContext(compiled,{module,exports:module.exports,require:()=>({supabase:{rpc:async(name,args)=>{calls.push({name,args});return result;}}})});
  return {api:module.exports,calls};
}
test('presets use Manila midnight and correct year/month rollover',()=>{
  const {api}=fixture();
  const before=api.reportRange('This Month',Date.parse('2026-09-30T15:59:59Z'));
  const after=api.reportRange('This Month',Date.parse('2026-09-30T16:00:00Z'));
  assert.equal(before.start,'2026-09-01');assert.equal(after.start,'2026-10-01');
  const previous=api.reportRange('Last Month',Date.parse('2027-01-01T00:00:00Z'));
  assert.equal(previous.start,'2026-12-01');assert.equal(previous.end,'2026-12-31');
  assert.equal(api.reportRange('This Year',Date.parse('2024-02-29T00:00:00Z')).end,'2024-12-31');
});
test('custom dates reject nonexistent dates, reverse ranges and overly long spans',()=>{
  const {api}=fixture();
  for(const r of [{start:'2026-02-30',end:'2026-03-01'},{start:'2026-10-31',end:'2026-10-01'},{start:'2024-01-01',end:'2025-01-01'},{start:'10/01/2026',end:'2026-10-31'}])assert.throws(()=>api.validateReportRange(r));
  assert.doesNotThrow(()=>api.validateReportRange({start:'2024-01-01',end:'2024-12-31'}));
});
test('report RPC has only date arguments, never a client-supplied owner/caterer',async()=>{
  const f=fixture();const r=await f.api.loadCatererReport(range);
  assert.equal(r.total,0);assert.equal(f.calls[0].name,'get_caterer_reports');
  assert.deepEqual(JSON.parse(JSON.stringify(f.calls[0].args)),{p_start:range.start,p_end:range.end});
});
test('unknown data and inconsistent counts never become a zero report',async()=>{
  for(const data of [null,{...empty(),total:1},{...empty(),actual_payments:'1200.00'},{...empty(),date_basis:'event_date'},{...empty(),packages:[{id:'x',name:'Invalid',count:-1}]}]){
    const f=fixture({data,error:null});await assert.rejects(()=>f.api.loadCatererReport(range));
  }
});
test('authorization/setup/network failures remain explicit',async()=>{
  for(const error of [{code:'42501',message:'Denied'},{code:'PGRST202',message:'Missing RPC'},{message:'Network error'}]){
    const f=fixture({data:null,error});await assert.rejects(()=>f.api.loadCatererReport(range));
  }
  const {api}=fixture();assert.match(api.reportError({code:'42501'}),/caterer account/);assert.match(api.reportError({code:'PGRST202'}),/not available yet/);
});
test('money formatting distinguishes zero from unavailable and unsafe amounts',()=>{
  const {api}=fixture();assert.match(api.formatReportMoney('0.00'),/0\.00/);
  assert.match(api.formatReportMoney('12345.67'),/12,345\.67/);
  for(const value of [null,'NaN','Infinity','-1.00','99999999999999999999'])assert.equal(api.formatReportMoney(value),'Unavailable');
});
test('RPC is guarded, owner-bound, read-only, and never uses downpayment estimates as collections',()=>{
  const sql=read('supabase/proposals/caterer_reports_proposal.sql');
  for(const value of ['PROPOSAL ONLY:','STABLE SECURITY DEFINER SET search_path=\'\'','c.user_id=actor',"p.role='caterer'",'b.caterer_id=target',"'actual_payments',NULL", "'settled_refunds',NULL",'AT TIME ZONE \'Asia/Manila\''])assert.ok(sql.includes(value),value);
  assert.ok(!/\b(?:INSERT INTO|UPDATE|DELETE FROM)\s+public\./i.test(sql));
  assert.ok(!/\b(?:ALTER|DROP)\s+(?:POLICY|TRIGGER|TABLE)\b/i.test(sql));
  assert.ok(!sql.includes('downpayment_amount')&&!sql.includes('payment_receipt_url'));
  assert.ok(!sql.includes("publication_status='published'"));
});
test('screen and navigation expose reports without writing booking/payment data',()=>{
  const ui=read('caterconnect-mobile/app/(caterer)/reports.tsx');
  for(const value of ['Reports & Analytics','Popular packages','Monthly booking trends','Actual payments received','Settled refunds','Unavailable','booking-creation cohort','state.identity===identity'])assert.ok(ui.includes(value),value);
  assert.ok(!ui.includes('.update(')&&!ui.includes('.insert('));
  assert.ok(read('caterconnect-mobile/app/(caterer)/_layout.tsx').includes('name="reports" options={{ href: null }}'));
  assert.ok(read('caterconnect-mobile/app/(caterer)/index.tsx').includes("path: '/(caterer)/reports'"));
});
