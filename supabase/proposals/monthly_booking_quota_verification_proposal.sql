-- MONTHLY QUOTA VERIFICATION -- REVIEW ONLY. NO SQL/TESTS EXECUTED.
-- Forward and rollback are separately guarded. Daily Availability/app unchanged.
/* EXECUTION BLOCKERS -- resolve before removing either forward safety gate
1. Exact original handle_new_booking_count() definition/owner/config/ACL and
   on_booking_created_increment_count definition/comment/enabled state. User
   confirmed it only increments on INSERT; capture exact restoration metadata.
2. Trusted subscription_plan/expiry is a security prerequisite. Inspect effective
   column grants/RLS, all plan writers, staff_correct_subscription_plan, renewal
   jobs and deployed webhook. Client self-upgrades must be impossible. Current
   AuthContext writes plan expiry/downgrades and zero counters; local webhook
   resets counters, returns HTTP 200 after logged errors, and may repeat resets.
   New cache projection ignores submitted counter zeros and preserves legacy
   reset timestamps, but does NOT authorize plan changes
   or make subscription payment processing idempotent. No blanket postgres skip.
3. Legacy committed rows need a reviewed quota-month map with evidence. No
   confirmation timestamp is invented. Current status/event_date/created_at and
   old INSERT counter do not establish acceptance month. Unknown mappings block
   this draft, even if daily-capacity legacy data was already validated. Provide
   concrete approved mapping INSERTs at the marked forward location, or revise
   with a separately approved grandfather/opening-balance design. No silent zero.
4. Confirm types/defaults/nullability/status vocabulary, constraints and all
   booking/caterer triggers. Proposed assumptions: UUID IDs; timestamptz expiry/
   reset; int/bigint counter. New quota_month date is genuinely new, not deployed.
   Backfill booking UPDATE and cache UPDATE invoke existing triggers: prove no
   unrelated payment/refund/notification side effects. Later BEFORE triggers
   must not rewrite quota_month/cache fields; later AFTER writers must be audited.
5. Approved reconfirmation assigns CURRENT Manila month, including after a prior
   cancellation in an older month. Old released episodes are not an audit ledger;
   one quota_month field keeps only the latest assigned episode. If complete
   episode audit history is required, use a separate ledger instead.
6. Deletion/reassignment policy remains unresolved. Draft refuses caterer/identity
   reassignment after an assignment. Physical deletion removes data-derived usage;
   parent-absent native cascades remain permitted. If completed quota must survive
   deletion of its booking, a retained ledger is REQUIRED before execution. Do
   not silently change account cascades or introduce new NO ACTION restrictions.
7. Paid plan with NULL expiry, unknown plan, perpetual/manual entitlement needs
   verified semantics. Draft fails closed for those paid/unknown cases; expired
   paid entitlement uses Free=5 without changing stored plan/expiry. Same-key
   committed status transitions remain allowed after expiry/downgrade. Upgrades
   alter ceiling, never reset usage. Reconcile these rules with subscription APIs.
8. Default/inherited function/table/schema grants, postgres RLS bypass, booking
   status authorization and effective API isolation must be verified. Internal
   functions are definer, empty search_path, no anon/authenticated EXECUTE. RLS
   and existing RPCs still authorize actions; quota checks grant no status powers.
   Identify any old monthly-limit INSERT policy/guard that would still deny
   pending requests at the ceiling. Such a restriction needs an exact separately
   reviewed adjustment; this draft never blanket-drops existing RLS or triggers.
9. Only monthly_booking_count is a projection, never quota authority. The legacy
   booking_count_reset_at remains unchanged by quota installation/accounting;
   existing authorized AuthContext/subscription writers retain their timestamp
   payloads. Inspect its actual consumers before any separate semantic change.
   All quota decisions read period-tagged bookings. A new month needs no history
   deletion. Without subsequent writes, persisted cache can be stale; AuthContext
   still assigns optimistic local zeros using device time. Future narrow read-only
   display refresh/projection access is required for trustworthy month-roll UI.
10. Drain writers/coordinate bounded maintenance lock timeouts; monthly and daily
    guards take the SAME caterer NO KEY UPDATE lock. Booking UPDATE locks its
    row first; multi-row/cascade/other helper lock orders can deadlock. Never
    automatically replay payments or HTTP side effects on an uncertain outcome.
11. Rollback is unused-installation only. Any post-install booking INSERT/UPDATE/
    DELETE leaves a transactional marker (no FK deletion escape), causing refusal.
    Cache/assignment/definition drift also refuses. Do not replay stale snapshots
    after usage. RESTRICT covers tracked dependencies, not all quoted bodies.
12. Direct legacy backfill runs BEFORE tracker attachment. Cache initialization
    runs AFTER attachment; cutover refuses any resulting booking activity and
    rolls the installation back. Never clear/suppress tracker rows to install.
    Review existing callbacks for indirect booking writes during backfill too;
    an empty tracker does not prove that earlier untracked callbacks were safe.
    Deferred callbacks require separate inspection: a successful cutover check
    alone cannot certify that no deferred event will write bookings at commit.
13. Rollback's FULL JOIN intentionally permits existing unmapped rows when both
    quota_month values are NULL. A missing mapped booking, changed/cleared mapped
    month or non-NULL unmapped month still refuses. Do not replace this with a
    blanket m.booking_id IS NULL rejection: legacy pending/rejected/cancelled
    rows have no mapping. The independent activity-marker refusal stays strict.
14. check_booking updates the parent cache; guard_cache only SELECTs bookings
    and assigns NEW, so these two functions do not recursively UPDATE parents.
    The local Availability capacity guard returns on unchanged capacity. Full
    deployed caterer trigger bodies/order remain required: any nested booking
    UPDATE or parent UPDATE may cause recursion, tuple-modified errors, new
    accounting events or lock inversions. Include UPDATE OF column triggers,
    statement/constraint triggers and indirect function callers in that audit.
    Cancellation/deletion count after the booking change; reconfirmation locks
    the parent before assigning the new month. Same-key committed transitions
    skip accounting and do not repair a stale month-roll display cache.
15. Trigger type assertions match the declarations: ROW=1, BEFORE=2, INSERT=4,
    DELETE=8, UPDATE=16, AFTER=0. Stamp BEFORE I/U/D ROW=31; check AFTER I/U/D
    ROW=29; cache BEFORE I/U ROW=23; original AFTER INSERT ROW=5. Keep event
    bits distinct from deferral, enabled state, WHEN and UPDATE OF attributes.
*/
BEGIN;
DO $$ BEGIN
  RAISE EXCEPTION 'PROPOSAL ONLY: monthly metadata SELECTs require explicit read-only SQL approval';
END $$;
SELECT version(),current_user,current_setting('transaction_isolation');
SELECT p.oid::regprocedure,pg_get_userbyid(p.proowner),p.prosecdef,p.proconfig,p.proacl,pg_get_functiondef(p.oid)
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.prokind='f' AND
  (p.proname IN ('handle_new_booking_count','staff_correct_subscription_plan')
   OR p.prosrc ILIKE '%monthly_booking_count%' OR p.prosrc ILIKE '%booking_count_reset_at%'
   OR p.prosrc ILIKE '%subscription_plan%' OR p.prosrc ILIKE '%quota_month%');
SELECT tgrelid::regclass,tgname,tgtype,tgenabled,tgisinternal,tgconstraint,
  tgdeferrable,tginitdeferred,tgattr,pg_get_triggerdef(oid,true),
  obj_description(oid,'pg_trigger'),pg_get_functiondef(tgfoid)
FROM pg_trigger WHERE tgrelid IN ('public.bookings'::regclass,'public.caterers'::regclass);
SELECT * FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('bookings','caterers');
SELECT conrelid::regclass,conname,pg_get_constraintdef(oid,true) FROM pg_constraint
WHERE conrelid IN ('public.bookings'::regclass,'public.caterers'::regclass)
  OR confrelid IN ('public.bookings'::regclass,'public.caterers'::regclass);
SELECT * FROM pg_policies WHERE schemaname='public' AND tablename IN ('bookings','caterers');
SELECT r.rolname,a.attname,has_column_privilege(r.oid,c.oid,a.attnum,'UPDATE') AS effective_update
FROM pg_roles r CROSS JOIN pg_class c JOIN pg_attribute a ON a.attrelid=c.oid
WHERE c.oid='public.caterers'::regclass AND r.rolname IN ('anon','authenticated','service_role')
  AND a.attname IN ('subscription_plan','subscription_expires_at','monthly_booking_count','booking_count_reset_at');
SELECT defaclrole::regrole,defaclnamespace::regnamespace,defaclobjtype,defaclacl FROM pg_default_acl;
COMMIT;

/* PRIORITIZED ISOLATED STAGING TESTS -- real API actors; NOT RUN
T01 Snapshot originals; unresolved dependencies/mapping/type mismatch abort whole
    forward. Complete evidence-based mapping; preserve all booking/payment values.
T02 Many pending INSERTs, rejection and pending cancellation use zero monthly
    quota. Old INSERT increment trigger absent after cutover; original function
    and all unrelated triggers/policies/grants remain unchanged.
T03 Free/Basic/Standard allow exactly 5/20/50 current-month committed bookings;
    N+1 fails; Premium has no ceiling. Spread dates to isolate MONTHLY checks.
T04 At N-1, T1 confirms and holds transaction open; T2 confirms a different
    booking and waits on caterer lock. T1 commit => T2 count sees N+1 and fails;
    T1 abort => T2 may commit. Repeat at daily limits 1/2/3 and with bulk UPDATE.
T05 confirmed->awaiting_payment->paid->ongoing->completed counts once, including
    across month rollover. Completion never moves period or rechecks old limits.
T06 Cancellation removes original month's usage, never decrements an unrelated
    current month. Reconfirm in same/later month assigns current period and checks
    capacity/plan anew. Full current month denies reconfirmation atomically.
T07 Midnight Manila vs UTC, lock wait spanning midnight, cancellation/confirmation
    races and count/cache snapshots. Assigned month is sampled AFTER parent wait.
T08 Upgrade retains usage; downgrade below usage preserves old commitments and
    denies NEW acquisitions. Expired Premium uses Free=5 on new acquisition;
    normal paid/ongoing/completed transitions still work. NULL/unknown fails closed.
T09 Old AuthContext and webhook zero/reset payloads cannot erase authoritative
    usage/numeric cache; their legacy reset timestamps are not rewritten by the
    quota guard. Verify installation, confirmation and cancellation preserve
    reset_at exactly, and activation retains its submitted timestamp. Duplicate
    subscription callback must not grant unauthorized
    entitlement/expiry; audit separate deployed activation idempotency. Record
    existing local display inaccuracies; do not misreport them as enforcement.
T10 Daily blocked/full rejection, monthly rejection and transactional notification
    failure each roll back assignment/cache/activity with booking. No payment,
    refund, price, monthly history or external side effect is duplicated.
T11 Direct client metadata/identity/previously-counted-caterer rewrites fail;
    ordinary edits remain allowed. Service-role/definer acquisitions still meet
    quota; existing authorization must separately reject forged payment/status.
T12 Multi-caterer writes, capacity updates, cancellation, quota-cache UPDATE and
    account cascades: document lock order/deadlocks/whole-transaction rollback.
    Resolve completed-booking deletion retention policy before enabling writes.
T13 Existing over-limit mapped commitments survive; only new acquisitions denied.
    Backfill/cache normalization creates no unwanted payment/notification events.
T14 Unused forward+rollback restores exact old trigger definition/comment/enabled
    state and original caches; original function owner/config/ACL unchanged.
    Guards detached before functions; drop callers before limit helper. Existing
    Availability schema/RPC/index/guards and booking/payment rows stay intact.
    Assert tracker empty immediately after installation. In a separate fixture,
    make an existing cache UPDATE callback write a booking: cutover must abort
    the whole installation; never clear markers or exempt the installer. Inspect
    deferred trigger callbacks before claiming unused rollback is guaranteed.
T15 Post-install pending/committed/payment/cancellation/delete activity, snapshot
    drift or external dependency makes rollback refuse atomically. Retain quota
    month/history and use forward fix; never clear markers to force rollback.
T16 Unused rollback with mixed legacy mapped commitments and UNMAPPED pending,
    rejected and cancelled rows succeeds; also test a wholly unmapped set of
    bookings and an empty bookings table. In separate approved drift fixtures,
    changed/cleared mapped month, non-NULL unmapped month and missing mapped
    booking each refuse. Ordinary post-install writes refuse via markers even
    when quota_month remains NULL or is unchanged. Failed transactions leave
    no committed marker; never clear committed markers to enable rollback.
T17 Same/later-month cancellation and direct committed DELETE recalculate the
    current numeric cache from surviving current-month commitments. Uncommitted
    DELETE uses no quota; parent-absent native cascade skips parent cache UPDATE.
    Reconfirm assigns current month and checks the final count. Verify mixed
    cancellation/confirmation multi-row statements in both row orders, multiple
    cancellations and bulk deletions; all cache values match authoritative rows.
T18 Trace actual deployed caterer triggers during cache UPDATE, subscription
    changes and rollback cache restoration: no unexpected recursive UPDATE,
    booking mutation or tuple-modified error. Hold cancellation/confirmation
    transactions in each lock order, race direct parent settings/subscription
    UPDATE with bookings and test opposite multi-caterer orders. Deadlock victims
    roll back the whole transaction; do not automatically replay payment effects.
    Confirm final enabled trigger types 31/29/23 (legacy restored type 5), and
    that a cache-only UPDATE leaves daily capacity and reset timestamps intact.
No live queries, staging fixtures, migrations, network calls or app tests run.
*/
