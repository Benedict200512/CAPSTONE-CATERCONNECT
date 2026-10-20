// Offline helper/source checks. No hosted database, user records or SQL execution.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const root=path.resolve(__dirname,'../..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
function load(file,result){
 const calls=[],module={exports:{}};
 const query={update(value){calls.push(['update',value]);return this;},eq(...args){calls.push(['eq',...args]);return this;},or(...args){calls.push(['or',...args]);return this;},select:async(...args)=>{calls.push(['select',...args]);return result;}};
 const supabase={from:table=>{calls.push(['from',table]);return query;},rpc:async(...args)=>{calls.push(['rpc',...args]);return result;}};
 vm.runInNewContext(ts.transpileModule(read('caterconnect-mobile/lib/'+file),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,
  {module,exports:module.exports,require:()=>({supabase})});return{api:module.exports,calls};
}
const customer={id:'customer',full_name:'Test Customer',avatar_url:null,phone_number:null,address:null,email:null};
test('reaction add/change/remove uses one value per actor and retains other actors',()=>{
 const {api}=load('messageReactions.ts');const before={other:'🔥'};
 const added=api.nextReactions(before,'me','❤️');assert.equal(added.me,'❤️');assert.equal(added.other,'🔥');assert.equal(before.me,undefined);
 const changed=api.nextReactions(added,'me','👍');assert.equal(changed.me,'👍');assert.equal(Object.keys(changed).length,2);
 const cleared=api.nextReactions(changed,'me','👍');assert.equal(cleared.me,undefined);assert.equal(cleared.other,'🔥');
});
test('reaction persistence binds booking/message/participant and confirms returned row',async()=>{
 const f=load('messageReactions.ts',{data:[{id:'message',reactions:{me:'👍'}}],error:null});
 assert.equal((await f.api.persistMessageReactions('booking','message','me',{me:'👍'})).me,'👍');
 assert.ok(f.calls.some(c=>c[0]==='eq'&&c[1]==='booking_id'&&c[2]==='booking'));
 assert.ok(f.calls.some(c=>c[0]==='eq'&&c[1]==='id'&&c[2]==='message'));
 assert.ok(f.calls.some(c=>c[0]==='or'&&c[1]==='sender_id.eq.me,receiver_id.eq.me'));
});
test('denied/zero-row/malformed reaction writes never report success',async()=>{
 for(const result of [{data:[],error:null},{data:null,error:{code:'42501'}},{data:[{id:'wrong',reactions:{}}],error:null},{data:[{id:'message',reactions:[]}],error:null}]){
  const f=load('messageReactions.ts',result);await assert.rejects(()=>f.api.persistMessageReactions('booking','message','me',{}));
 }
});
test('reaction errors expose safe SQL diagnostic classes without private payloads',()=>{
 const {api}=load('messageReactions.ts');
 assert.match(api.reactionError({code:'42501',details:'PRIVATE MESSAGE'}),/42501/);
 assert.match(api.reactionError({code:'42703'}),/database setup/);
 assert.match(api.reactionError({code:'23514'}),/format/);
 assert.ok(!api.reactionError({details:'PRIVATE MESSAGE'}).includes('PRIVATE MESSAGE'));
});
test('customer lookup derives identity through a booking-scoped RPC only',async()=>{
 const f=load('bookingConversationProfile.ts',{data:[customer],error:null});
 assert.equal((await f.api.loadConversationCustomer('booking','customer')).full_name,'Test Customer');
 assert.equal(f.calls.length,1);assert.equal(f.calls[0][1],'get_booking_conversation_customer');
 assert.deepEqual(JSON.parse(JSON.stringify(f.calls[0][2])),{p_booking_id:'booking'});
});
test('wrong customer, denied lookup and malformed profile data fail closed without fallback',async()=>{
 for(const result of [{data:[{...customer,id:'other'}],error:null},{data:[],error:null},{data:[{...customer,address:123}],error:null},{data:null,error:{code:'42501'}}]){
  const f=load('bookingConversationProfile.ts',result);await assert.rejects(()=>f.api.loadConversationCustomer('booking','customer'));
  assert.ok(!f.calls.some(c=>c[0]==='from'));
 }
});
test('missing profile values and setup/authorization failures are explicit',async()=>{
 const f=load('bookingConversationProfile.ts',{data:[customer],error:null});const p=await f.api.loadConversationCustomer('booking','customer');
 for(const field of ['phone_number','address','email','avatar_url'])assert.equal(f.api.profileField(p[field]),'Not provided');
 assert.equal(f.api.profileField('   '),'Not provided');assert.equal(f.api.profileField(' Test '),'Test');
 assert.match(f.api.conversationProfileError({code:'PGRST202'}),/approved messaging/);
 assert.match(f.api.conversationProfileError({code:'42501'}),/participants/);
});
test('profile SQL is guarded and actor-bound; existing grants/RLS stay unchanged',()=>{
 const sql=read('supabase/proposals/booking_conversation_customer_proposal.sql');
 for(const value of ['PROPOSAL ONLY:','STABLE SECURITY DEFINER SET search_path=\'\'','p.id=b.customer_id','b.id=p_booking_id','b.customer_id=auth.uid() OR c.user_id=auth.uid()',"ERRCODE='42501'",'FROM PUBLIC,anon,authenticated,service_role'])assert.ok(sql.includes(value),value);
 assert.ok(!/\b(?:ALTER TABLE|CREATE POLICY|ALTER POLICY|DROP POLICY|UPDATE public\.)/i.test(sql));
});
test('chat/modal preserve workflow, immediate reactions, safe retries and identity isolation',()=>{
 const chat=read('caterconnect-mobile/screens/auth/ChatScreen.tsx'),modal=read('caterconnect-mobile/components/ConversationCustomerProfile.tsx');
 for(const value of ['UserRound','View customer profile avatar','View customer profile for','ConversationCustomerProfile','reacting.current.has(key)','reactions: next','reactions: restored','currentThread.current !== activeThread'])assert.ok(chat.includes(value),value);
 for(const value of ['Phone','MapPin','Mail','current.current === identity','active = false','Try again','ActivityIndicator','Not provided'])assert.ok((modal+read('caterconnect-mobile/lib/bookingConversationProfile.ts')).includes(value),value);
 assert.ok(!chat.includes("'Failed to react to message'"));
 assert.ok(chat.includes('markIncomingRead')&&chat.includes('handleSend')&&chat.includes('refreshBookingDetails'));
});
