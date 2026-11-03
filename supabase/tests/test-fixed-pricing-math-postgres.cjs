// Numeric parity/unit checks only. Does NOT install the pricing proposal or
// substitute menu/RLS stubs for missing deployed catalog definitions.
const assert=require('node:assert/strict'),vm=require('node:vm');
const ts=require('../../caterconnect-mobile/node_modules/typescript');
module.exports=async({check,fails,read})=>{
 const module={exports:{}};
 vm.runInNewContext(ts.transpileModule(read('caterconnect-mobile/lib/packagePricing.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module,exports:module.exports});
 const proposal=read('supabase/proposals/fixed_package_pricing_proposal.sql');
 const code=proposal.slice(proposal.indexOf('  base:=p.price+round('),proposal.indexOf('  NEW.total_cost:=total;')).replaceAll('NEW.','candidate.');
 assert.ok(code.includes('IS DISTINCT FROM total')&&code.includes('IS DISTINCT FROM deposit'));
 function block(pkg,guests,addons=[],percent=25,overrides={}){
  const q=module.exports.calculatePackagePricing(pkg,guests,addons,percent);
  return `DO $pricing$ DECLARE p record; candidate record; rate numeric:=${percent}; extras numeric:=${q.addOnTotal}; base numeric; total numeric; deposit numeric;
    BEGIN SELECT ${pkg.price}::numeric AS price,${pkg.guest_capacity}::integer AS guest_capacity INTO p;
      SELECT ${guests}::integer AS guest_count,${overrides.total??q.total}::numeric AS total_cost,${overrides.deposit??q.downpayment}::numeric AS downpayment_amount INTO candidate;
      ${code}
    END $pricing$;`;
 }
 const pkg={price:50000,guest_capacity:100,min_guests:50,max_guests:150};
 check('pricing SQL NUMERIC matches frontend on all supplied fixed/extra-guest examples',[50,80,100,101,120,150].map(n=>block(pkg,n)).join('\n'));
 check('pricing SQL and frontend match fractional rates without rounding intermediate rate',block({price:100,guest_capacity:3,min_guests:1,max_guests:10},5));
 check('pricing SQL and frontend match extra subtotal and fractional downpayment rounding',block({price:'100.01',guest_capacity:3,min_guests:1,max_guests:6},4,[],12.5));
 check('pricing SQL and frontend match menu per-guest/quantity add-on totals',block(pkg,101,[{price_per_guest:'50.10',quantity:2}]));
 check('pricing SQL uses positive half-up cent rounding for tiny fractional rates',block({price:'0.01',guest_capacity:3,min_guests:1,max_guests:10},5,[],50));
 check('actual proposal calculation rejects manipulated total_cost',fails(block(pkg,120,[],25,{total:1}),'23514','submitted totals'));
 check('actual proposal calculation rejects manipulated downpayment_amount',fails(block(pkg,120,[],25,{deposit:1}),'23514','submitted totals'));
};
