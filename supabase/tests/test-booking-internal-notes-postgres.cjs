// Invoked only inside the four-export disposable PostgreSQL fixture.
// node supabase/tests/test-package-publication-postgres.cjs --internal-notes
const assert = require('node:assert/strict');
module.exports = async ({ sql, check, race, ensure, fails, auth, lit, uid, owner, other, customer,
  outsider, cat, cat2, oldAccepted, oldCompleted, booking, read }) => {
  const proposal = read('supabase/proposals/booking_internal_notes_proposal.sql');
  const stop = /DO \$\$ BEGIN\r?\n  RAISE EXCEPTION 'PROPOSAL ONLY: internal booking notes require separate installation approval';\r?\nEND \$\$;\r?\n/;
  assert.ok(stop.test(proposal));
  let error;
  try { sql(proposal); } catch (e) { error = e; }
  assert.ok(String(error?.stderr).includes('PROPOSAL ONLY'));
  check('internal notes proposal stop leaves no private schema', ensure("to_regnamespace('cc_booking_notes1_private') IS NULL",'proposal installed'));
  sql(proposal.replace(stop,'')); // local test memory only; no execution file.
  const get = id => `SELECT * FROM public.get_booking_internal_notes(${lit(id)});`;
  const save = (id,note,rev) => `SELECT * FROM public.save_booking_internal_notes(${lit(id)},${lit(note)},${rev});`;
  check('owner gets empty internal note revision zero', `${auth(owner)} ${ensure(`(SELECT note='' AND revision=0 FROM public.get_booking_internal_notes(${lit(oldAccepted)}))`,'initial note')}`);
  check('owner adds/edits/clears private notes with revisions', `${auth(owner)} ${save(oldAccepted,'Setup: private staffing plan',0)} ${save(oldAccepted,'Updated staffing plan',1)} ${ensure(`(SELECT note='Updated staffing plan' AND revision=2 FROM public.get_booking_internal_notes(${lit(oldAccepted)}))`,'edit')} ${save(oldAccepted,'',2)} ${ensure(`(SELECT note='' AND revision=3 FROM public.get_booking_internal_notes(${lit(oldAccepted)}))`,'clear')}`);
  for (const [name,actor] of [['customer',customer],['different caterer',other],['unrelated customer',outsider]]) {
    check(`${name} cannot read or write another caterer's internal notes`, `${auth(actor)} ${fails(get(oldAccepted),'42501')} ${fails(save(oldAccepted,'Unauthorized',0),'42501')}`);
    check(`${name} cannot query private storage directly`, `${auth(actor)} ${fails('SELECT * FROM cc_booking_notes1_private.notes;','42501')} ${fails('SELECT to_jsonb(n) FROM cc_booking_notes1_private.notes n;','42501')}`);
  }
  check('anonymous role has no internal note RPC access', `${auth('','anon')} ${fails(get(oldAccepted),'42501')} ${fails(save(oldAccepted,'Unauthorized',0),'42501')}`);
  for (const profileRole of ['staff','admin']) {
    check(`${profileRole} booking visibility does not grant internal note access`, `UPDATE public.profiles SET role=${lit(profileRole)} WHERE id=${lit(outsider)}; ${auth(outsider)} ${fails(get(oldAccepted),'42501')} ${fails(save(oldAccepted,'Unauthorized',0),'42501')}`);
  }
  check('customer cannot insert or update private storage directly', `${auth(customer)} ${fails(`INSERT INTO cc_booking_notes1_private.notes(booking_id,note,revision) VALUES (${lit(oldAccepted)},'Unauthorized',1);`,'42501')} ${fails("UPDATE cc_booking_notes1_private.notes SET note='Unauthorized';",'42501')}`);
  check('nonexistent booking gives the same authorization denial', `${auth(owner)} ${fails(get(uid(9901)),'42501')} ${fails(save(uid(9901),'Unknown',0),'42501')}`);
  check('customer retains SELECT * and authorized existing booking fields without private text', `${auth(owner)} ${save(oldAccepted,'SECRET_INTERNAL_SENTINEL',0)} ${auth(customer)} ${ensure(`EXISTS(SELECT 1 FROM public.bookings WHERE id=${lit(oldAccepted)} AND total_cost=12000 AND package_id IS NOT NULL)`,'lost public fields')} ${ensure(`NOT EXISTS(SELECT 1 FROM public.bookings b WHERE b.id=${lit(oldAccepted)} AND to_jsonb(b)::text LIKE '%SECRET_INTERNAL_SENTINEL%')`,'private note leaked via row JSON')} SELECT * FROM public.bookings WHERE id=${lit(oldAccepted)};`);
  check('saving internal notes changes no booking fields, quota cache or notifications', `CREATE TEMP TABLE before_booking AS SELECT to_jsonb(b) AS row FROM public.bookings b WHERE id=${lit(oldAccepted)}; CREATE TEMP TABLE before_cache AS SELECT monthly_booking_count FROM public.caterers WHERE id=${lit(cat)}; CREATE TEMP TABLE before_notifications AS SELECT count(*) AS n FROM public.notifications; ${auth(owner)} ${save(oldAccepted,'Operations only',0)} RESET ROLE; ${ensure(`(SELECT row FROM before_booking)=(SELECT to_jsonb(b) FROM public.bookings b WHERE id=${lit(oldAccepted)})`,'booking mutated')} ${ensure(`(SELECT monthly_booking_count FROM before_cache)=(SELECT monthly_booking_count FROM public.caterers WHERE id=${lit(cat)})`,'quota cache mutated')} ${ensure('(SELECT n FROM before_notifications)=(SELECT count(*) FROM public.notifications)','notification side effect')}`);
  check('completed bookings still allow private note edits without touching history', `${auth(owner)} ${save(oldCompleted,'Historical operations note',0)} ${ensure(`(SELECT note='Historical operations note' FROM public.get_booking_internal_notes(${lit(oldCompleted)}))`,'completed note')}`);
  check('note bounds and stale revision reject atomically', `${auth(owner)} ${save(oldAccepted,'New note',0)} ${fails(save(oldAccepted,'Stale overwrite',0),'40001')} ${fails(`SELECT * FROM public.save_booking_internal_notes(${lit(oldAccepted)},repeat('x',5001),1);`,'22023')} ${ensure(`(SELECT note='New note' AND revision=1 FROM public.get_booking_internal_notes(${lit(oldAccepted)}))`,'failed write changed saved note')}`);
  check('private note authorization follows current assigned caterer', `${booking(uid(9902))} ${auth(owner)} ${save(uid(9902),'Original assignment',0)} RESET ROLE; UPDATE public.bookings SET caterer_id=${lit(cat2)},package_id=${lit(uid(22))} WHERE id=${lit(uid(9902))}; ${auth(owner)} ${fails(get(uid(9902)),'42501')} ${auth(other)} ${ensure(`(SELECT note='Original assignment' FROM public.get_booking_internal_notes(${lit(uid(9902))}))`,'assigned owner unavailable')}`);
  await race('simultaneous internal note saves reject stale overwrite', `${auth(owner)} ${save(oldAccepted,'Race winner',0)}`, `${auth(owner)} ${save(oldAccepted,'Race loser',0)}`, /changed elsewhere/);
  check('winning private note retained after concurrent conflict', `${auth(owner)} ${ensure(`(SELECT note='Race winner' AND revision=1 FROM public.get_booking_internal_notes(${lit(oldAccepted)}))`,'lost winning note')}`);
};
