// Offline arithmetic and source contracts; no SQL, payment or hosted calls.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const root=path.resolve(__dirname,'../..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
function load(file,dependencies={}){const module={exports:{}};vm.runInNewContext(ts.transpileModule(read('caterconnect-mobile/lib/'+file),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module,exports:module.exports,require:name=>dependencies[name]});return module.exports;}
const pricing=load('packagePricing.ts');
const pkg={price:50000,guest_capacity:100,min_guests:50,max_guests:150};
test('fixed package examples and inclusive minimum/capacity/maximum boundaries',()=>{
 for(const [guests,total] of [[50,50000],[80,50000],[100,50000],[101,50500],[120,60000],[150,75000]]){
  const q=pricing.calculatePackagePricing(pkg,guests);assert.equal(q.total,total);assert.equal(q.pricePerGuest,500);
 }
 for(const guests of [0,49,151,-1,100.1,NaN,Infinity])assert.throws(()=>pricing.calculatePackagePricing(pkg,guests));
});
test('fractional per-guest rate is not rounded before multiplying extras',()=>{
 const p={price:100,guest_capacity:3,min_guests:1,max_guests:10};
 const q=pricing.calculatePackagePricing(p,5);assert.equal(q.pricePerGuest,33.33);assert.equal(q.extraGuestTotal,66.67);assert.equal(q.total,166.67);
 assert.equal(pricing.calculatePackagePricing(p,10).total,333.33);
 assert.equal(pricing.calculatePackagePricing({...p,price:0.01},5).total,0.02);
});
test('add-ons stay per guest and quantity; downpayment uses final rounded total',()=>{
 const q=pricing.calculatePackagePricing(pkg,101,[{price_per_guest:'50.10',quantity:2}],25);
 assert.equal(q.baseTotal,50500);assert.equal(q.addOnTotal,10120.2);assert.equal(q.total,60620.2);assert.equal(q.downpayment,15155.05);
 const free=pricing.calculatePackagePricing(pkg,101,[{price_per_guest:0,quantity:1}],25);
 assert.equal(free.addOnTotal,0);assert.equal(free.total,50500);assert.equal(free.downpayment,12625);
 const fractional=pricing.calculatePackagePricing({price:'100.01',guest_capacity:3,min_guests:1,max_guests:6},4,[],12.5);
 assert.equal(fractional.total,133.35);assert.equal(fractional.downpayment,16.67);
});
test('invalid money, menu quantities, percentages and guest configurations fail closed',()=>{
 for(const p of [{...pkg,max_guests:99},{...pkg,max_guests:undefined},{...pkg,min_guests:101},{...pkg,guest_capacity:0},{...pkg,price:'1.001'},{...pkg,price:-1}])assert.throws(()=>pricing.calculatePackagePricing(p,100));
 for(const quantity of [0,-1,1.5,NaN])assert.throws(()=>pricing.calculatePackagePricing(pkg,100,[{price_per_guest:10,quantity}]));
 for(const percent of [-1,101,'1.001',Infinity])assert.throws(()=>pricing.calculatePackagePricing(pkg,100,[],percent));
 assert.equal(String(pricing.moneyCents('900719925474.09')),'90071992547409');
 assert.throws(()=>pricing.moneyCents('900719925474.10'));
});
test('caller-supplied totals and manual fee properties cannot control calculation',()=>{
 const q=pricing.calculatePackagePricing({...pkg,total_cost:1,downpayment_amount:1,extra_guest_fee:0},120,[],25);
 assert.equal(q.total,60000);assert.equal(q.downpayment,15000);
});
test('Budget Matcher shares pricing and excludes guests outside bounds',()=>{
 const search=load('catererSearch.ts',{'./packagePricing':pricing});
 assert.equal(search.packageTotal(pkg,101),50500);assert.equal(search.packageTotal(pkg,null),50000);
 assert.equal(search.packageTotal(pkg,49),null);assert.equal(search.packageTotal(pkg,151),null);
});
test('SQL computes trusted prices and rejects manipulated totals before insertion',()=>{
 const sql=read('supabase/proposals/fixed_package_pricing_proposal.sql');
 for(const value of ['PROPOSAL ONLY:','m.price_per_guest','m.caterer_id=NEW.caterer_id','NEW.customer_id IS DISTINCT FROM auth.uid()',
  'round(p.price*greatest(NEW.guest_count-p.guest_capacity,0)/p.guest_capacity,2)','NEW.total_cost IS DISTINCT FROM total',
  'NEW.downpayment_amount IS DISTINCT FROM deposit','NEW.total_cost:=total','NEW.downpayment_amount:=deposit','Duplicate menu selection',
  "NEW.status IS DISTINCT FROM 'pending'",'original IS DISTINCT FROM snapshot'])assert.ok(sql.includes(value),value);
 assert.ok(sql.includes('total*100>90071992547409'));
 assert.ok(!sql.includes("item->>'price_per_guest'"));
 assert.ok(!/CREATE\s+POLICY|ALTER\s+POLICY|DISABLE\s+TRIGGER|DROP\s+COLUMN/i.test(sql));
});
test('migration adds only max_guests to packages and preserves the fee collision for review',()=>{
 const sql=read('supabase/proposals/fixed_package_pricing_proposal.sql');
 const adds=[...sql.matchAll(/ALTER TABLE public\.packages ADD COLUMN ([a-z_]+)/g)].map(m=>m[1]);assert.deepEqual(adds,['max_guests']);
 assert.ok(sql.includes('UPDATE public.packages SET max_guests=guest_capacity'));
 assert.ok(sql.includes("('max_guests','extra_guest_fee')"));
 assert.ok(!/UPDATE public\.bookings/i.test(sql));
});
test('wizard, package form and discovery use maxima without manual fee input',()=>{
 const wizard=read('caterconnect-mobile/app/(tabs)/book/[catererId].tsx'),form=read('caterconnect-mobile/app/(caterer)/packages.tsx');
 assert.ok(wizard.includes('calculatePackagePricing(selectedPkg, guests'));
 assert.ok(!wizard.includes('packageMultiplier')&&!wizard.includes('Math.ceil('));
 assert.ok(wizard.includes('Fixed package price')&&wizard.includes('Extra guests'));
 assert.ok(form.includes('max_guests: limits.max_guests')&&form.includes('Maximum Guests'));
 assert.ok(!form.includes('extra_guest_fee'));
 assert.ok(read('caterconnect-mobile/constants/colors.ts').includes("orange: '#F97316'"));
 for(const f of ['caterers.ts','packageComparison.ts','packageBookmarks.ts'])assert.ok(read('caterconnect-mobile/lib/'+f).includes('max_guests'));
});
test('new customization detail guard preserves canonical inserts and serializes duplicates',()=>{
 const sql=read('supabase/proposals/fixed_package_pricing_proposal.sql');
 for(const text of ['cc_fixed_price1_detail BEFORE INSERT OR UPDATE OR DELETE','WHERE b.id=parent_id FOR UPDATE',
  'Customization details must match the saved authoritative quote','Duplicate quote customization detail',
  'Saved quote customization details are immutable','IF NOT protected THEN'])assert.ok(sql.includes(text),text);
 assert.ok(!/ALTER\s+POLICY|CREATE\s+POLICY/i.test(sql));
});
test('TRUNCATE hardening is a separate guarded proposal preserving CRUD and RLS',()=>{
 const sql=read('supabase/proposals/pricing_detail_truncate_hardening_proposal.sql');
 assert.ok(sql.includes('PROPOSAL ONLY: customization TRUNCATE grants require separate approval'));
 assert.ok(sql.includes('REVOKE TRUNCATE ON public.menu_items,public.booking_customizations FROM PUBLIC,anon,authenticated'));
 assert.ok(!/REVOKE\s+(ALL|SELECT|INSERT|UPDATE|DELETE)|CREATE\s+POLICY|ALTER\s+POLICY/i.test(sql));
});
