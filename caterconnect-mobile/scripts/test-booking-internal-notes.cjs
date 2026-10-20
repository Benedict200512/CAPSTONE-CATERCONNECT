const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname,'../..');
const read = name => fs.readFileSync(path.join(root,name),'utf8');
function helper(result={data:[{note:'Private',revision:1}],error:null}) {
  const calls=[];const module={exports:{}};
  vm.runInNewContext(ts.transpileModule(read('caterconnect-mobile/lib/bookingInternalNotes.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,
    { module,exports:module.exports,require:()=>({supabase:{rpc:async(name,args)=>{calls.push({name,args});return result;}}}) });
  return { api:module.exports,calls };
}
test('notes use narrow read RPC, never the public caterer_notes column',async()=>{
  const h=helper();assert.equal((await h.api.loadInternalNote('booking')).note,'Private');
  assert.equal(h.calls[0].name,'get_booking_internal_notes');assert.equal(h.calls[0].args.p_booking_id,'booking');
});
test('save and clear send only note, booking ID and expected revision',async()=>{
  const h=helper();await h.api.saveInternalNote('booking','',2);
  assert.equal(h.calls[0].name,'save_booking_internal_notes');
  assert.deepEqual(JSON.parse(JSON.stringify(h.calls[0].args)),{p_booking_id:'booking',p_note:'',p_expected_revision:2});
});
test('malformed result and denied reads fail closed',async()=>{
  for(const result of [{data:[],error:null},{data:[{note:null,revision:0}],error:null},{data:null,error:{code:'42501',message:'Denied'}}]){
    const h=helper(result);await assert.rejects(()=>h.api.loadInternalNote('booking'));
  }
});
test('invalid lengths and revisions never call server',async()=>{
  const h=helper();await assert.rejects(()=>h.api.saveInternalNote('booking','x'.repeat(5001),0));
  await assert.rejects(()=>h.api.saveInternalNote('booking','draft',-1));assert.equal(h.calls.length,0);
});
test('setup and concurrent-edit errors are explicit',()=>{
  const h=helper();assert.match(h.api.internalNotesError({code:'PGRST202'}),/not installed/);
  assert.match(h.api.internalNotesError({code:'40001'}),/draft is kept/);
});
test('private UI includes save/clear, identity isolation, guarded reload and no log output',()=>{
  const ui=read('caterconnect-mobile/components/BookingInternalNotes.tsx');
  for(const fragment of ['Private — Only visible to your catering team.','Internal Notes','Save Notes','Clear','Keep draft','current.current === identity','state.identity === identity'])assert.ok(ui.includes(fragment));
  assert.ok(!ui.includes('console.'));assert.ok(!ui.includes('caterer_notes'));
});
test('SQL stays guarded, locks and authorizes writes without changing booking fields or grants',()=>{
  const sql=read('supabase/proposals/booking_internal_notes_proposal.sql');
  for(const fragment of ['PROPOSAL ONLY:','FOR UPDATE','FOR SHARE','c.user_id=actor',"USING ERRCODE='40001'",'FORCE ROW LEVEL SECURITY','REVOKE ALL ON SCHEMA','SET search_path=\'\''])assert.ok(sql.includes(fragment),fragment);
  assert.ok(!/\bUPDATE\s+public\.bookings\b/i.test(sql));assert.ok(!/\b(?:ALTER|DROP)\s+POLICY\b/i.test(sql));
  assert.ok(!/\bGRANT\b[^;]*\bON\s+(?:TABLE\s+)?public\.bookings\b/i.test(sql));
});
