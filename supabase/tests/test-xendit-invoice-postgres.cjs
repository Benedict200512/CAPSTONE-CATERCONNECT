// Replays the actual invoice helper's generated conditional UPDATE against the
// disposable catalog fixture with all imported constraints/triggers enabled.
// Provider responses are synthetic; no hosted connection or Xendit call exists.
const assert=require('node:assert/strict');
const vm=require('node:vm');
const ts=require('../../caterconnect-mobile/node_modules/typescript');
module.exports=async({sql,check,ensure,fails,auth,lit,owner,customer,cat,pack,oldAccepted,read})=>{
  const module={exports:{}};
  const source=read('caterconnect-mobile/supabase/functions/xendit-webhook/verify-booking-invoice.ts');
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,
    {module,exports:module.exports,Date});
  const {verifyBookingInvoice}=module.exports;
  const row=JSON.parse(sql(`SELECT row_to_json(b) FROM public.bookings b WHERE id=${lit(oldAccepted)};`).trim());
  const invoice={id:'local_verified_invoice',external_id:`booking_${oldAccepted}_123`,status:'PAID',currency:'PHP',
    amount:row.downpayment_amount,paid_amount:row.downpayment_amount,
    metadata:{type:'booking',booking_id:oldAccepted,customer_id:customer,user_id:customer}};
  // Capture exactly the helper's patch and all filters, rather than maintaining
  // an independent implementation of the guarded transition in this test.
  async function capture(observed){
    let patch;const filters=[];
    const q={eq(k,v){filters.push(`${k}=${lit(v)}`);return q;},is(k,v){assert.equal(v,null);filters.push(`${k} IS NULL`);return q;},
      update(p){patch=p;return q;},select(){return patch?Promise.resolve({data:[{id:oldAccepted}],error:null}):q;},
      maybeSingle:async()=>({data:observed,error:null})};
    assert.equal((await verifyBookingInvoice({from:table=>{assert.equal(table,'bookings');return q;}},invoice)).outcome,'processed');
    // The initial read's ID filter and the update's ID filter are both safe to
    // retain: they reference the same exact fixture booking.
    return {patch,statement:`UPDATE public.bookings SET ${Object.entries(patch).map(([k,v])=>`${k}=${lit(v)}`).join(',')}
      WHERE ${filters.join(' AND ')} RETURNING id`};
  }
  const captured=await capture(row);
  const service=auth(owner,'service_role');
  const changed=(statement,n)=>`WITH changed AS (${statement}) ${ensure(`(SELECT count(*)=${n} FROM changed)`,'invoice CAS row count')}`;
  const applied=changed(captured.statement,1);
  const paid=ensure(`(SELECT status='paid' AND payment_reference=${lit(invoice.id)} AND payment_receipt_url=${lit(invoice.id)}
    AND payment_verified_at=${lit(captured.patch.payment_verified_at)}::timestamptz
    AND payment_submitted_at=${lit(captured.patch.payment_submitted_at)}::timestamptz
    AND total_cost=12000 AND downpayment_amount=1200 AND refund_status='none'
    FROM public.bookings WHERE id=${lit(oldAccepted)})`,'invoice fields inconsistent');
  const counts=ensure(`(SELECT monthly_booking_count=2 FROM public.caterers WHERE id=${lit(cat)})`,'payment recounted quota');
  const notifications=ensure(`(SELECT count(*)=2 FROM public.notifications WHERE booking_id=${lit(oldAccepted)}
    AND type IN ('payment_verified','downpayment_paid'))`,'invoice notification duplication/loss');
  check('invoice helper UPDATE satisfies all collected triggers/constraints, including hidden package history',
    `UPDATE public.packages SET publication_status='archived' WHERE id=${lit(pack)}; ${service} ${applied} ${paid} ${counts} ${notifications}`);
  check('duplicate invoice SQL affects zero rows and sends no second paid notifications',
    `${service} ${applied} ${changed(captured.statement,0)} ${paid} ${counts} ${notifications}`);
  const submitted='2020-01-01T00:00:00+00:00';
  const awaiting=await capture({...row,status:'awaiting_payment',payment_receipt_url:invoice.id,payment_submitted_at:submitted});
  check('awaiting-payment verification retains original submission time and stamps verified time',
    `${service} UPDATE public.bookings SET status='awaiting_payment',payment_receipt_url=${lit(invoice.id)},payment_submitted_at=${lit(submitted)} WHERE id=${lit(oldAccepted)};
    ${changed(awaiting.statement,1)} ${ensure(`(SELECT status='paid' AND payment_submitted_at=${lit(submitted)}::timestamptz
      AND payment_verified_at=${lit(awaiting.patch.payment_verified_at)}::timestamptz FROM public.bookings WHERE id=${lit(oldAccepted)})`,'submission timestamp lost')}
    ${counts} ${notifications}`);
  check('ordinary customer/caterer still cannot execute invoice Paid transition',
    `${auth(customer)} ${fails(captured.statement+';','P0001','Only verified server-side payments')}
    RESET ROLE; ${auth(owner)} ${fails(captured.statement+';','P0001','Only verified server-side payments')}`);
  check('cancellation racing verified invoice prevents stale payment UPDATE',
    `${service} UPDATE public.bookings SET status='cancelled' WHERE id=${lit(oldAccepted)};
    ${changed(captured.statement,0)} ${ensure(`(SELECT status='cancelled' AND payment_verified_at IS NULL AND payment_reference IS NULL
      FROM public.bookings WHERE id=${lit(oldAccepted)})`,'cancelled booking reopened')}`);
  check('existing monthly quota projection preserves committed usage under subscription activation reset payload',
    `${service} UPDATE public.caterers SET subscription_plan='basic',subscription_expires_at=now()+interval '30 days',
      monthly_booking_count=0,booking_count_reset_at=now() WHERE id=${lit(cat)};
    ${ensure(`(SELECT subscription_plan='basic' AND subscription_expires_at=now()+interval '30 days'
      AND monthly_booking_count=(SELECT count(*) FROM public.bookings WHERE caterer_id=${lit(cat)}
        AND quota_month=date_trunc('month',clock_timestamp() AT TIME ZONE 'Asia/Manila')::date
        AND status IN ('confirmed','awaiting_payment','paid','ongoing','completed')) FROM public.caterers WHERE id=${lit(cat)})`,
      'subscription reset bypassed quota projection')}`);
};
