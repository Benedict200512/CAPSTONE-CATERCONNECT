-- AVAILABILITY VERIFICATION -- PROPOSAL ONLY. NO QUERIES/TESTS EXECUTED.
-- This is a staging checklist and optional metadata script, not test results.
-- No SQL here is approved merely by being stored in the workspace.

/* LATEST USER-REPORTED LIVE DISCOVERY -- not queries executed by this audit
- Original partial unique index definition/metadata match; no tracked index
  dependents found. RPC signature/owner/definer/search_path/ACL match baseline.
- Existing booking/caterer triggers reviewed: no explicit competing same-date
  exclusivity trigger found. Full interaction tests are still outstanding.
- Caterer ownership RLS is usable; staff/admin UPDATE policies also exist.
  anon/authenticated cannot directly UPDATE caterers.user_id, and no reviewed
  public function explicitly changes that field. No new owner bypass is needed.
- No future caterer/date exceeds one committed booking across all five counted
  states; invalid committed caterer/date/infinite-date records = 0. Thus current
  reported data needs no elevated initial limits. Locked preflight/backfill
  remains necessary to handle drift between discovery and approved execution.
These findings resolve the corresponding discovery questions below. Retain the
catalog queries as snapshot/drift tools; do NOT rerun the full live inventory
merely because the historical checklist still describes those checks.
*/

/* COMPATIBILITY CHECKLIST -- resolved discovery above, remaining gates below
1. Exact pg_get_functiondef/get_function_result/proargnames/config/ACL for the
   installed unavailable-dates RPC. The confirmed event_date response is not
   enough to assert RETURNS TABLE(event_date date). Forward deliberately aborts
   on a different shape/argument name. Review original body before replacement.
   OID/owner/ACL/config are captured and checked after CREATE OR REPLACE. Any
   additional original SET configuration makes this draft abort if not retained;
   prepare an exact reviewed declaration instead of dropping/recreating the RPC.
2. All existing booking/caterer columns/types/nullability/defaults, constraints,
   indexes (especially one-booking-per-date UNIQUE/exclusion constraints), RLS,
   grants, rules, partitions, and trigger bodies/order/enablement. Unknown
   alternate availability tables with different names remain possible.
   USER-SUPPLIED LIVE FACT: bookings_unique_active_caterer_date is a standalone
   partial UNIQUE btree index on (caterer_id,event_date) for confirmed/paid/ongoing.
   Forward explicitly captures/validates and replaces ONLY that known index.
   It still stops on OTHER obvious two-key date unique indexes/exclusions.
   Inspect expression indexes, other key combinations and trigger/function-based
   restrictions separately. No other original object is approved for removal.
3. Inspect ALL booking writers including nested invoker/definer functions and
   deployed Edge Functions. Current app directly inserts pending and updates
   confirmed; the new AFTER guard covers both without an app RPC cutover.
   No such explicit competing trigger was found in the latest reported review.
   Unreviewed writers can still forbid >1 commitment. Resolve a
   concrete conflict through separately reviewed SQL; never silently drop them.
   Local search found no direct application reference to the known index or
   date-key ON CONFLICT target. Customer book/[catererId].tsx:186,373 consumes
   the date RPC; its warning at :391 still describes another client booking the
   date. That wording may be imprecise for capacity/blocks; app is unchanged.
   Live function bodies may use ON CONFLICT inference, catch unique_violation /
   SQLSTATE 23505, SELECT INTO STRICT, or EXISTS(bookings on date). These can rely
   on uniqueness without a pg_depend edge or an index-name reference. Inspect
   full bodies and called helpers, deployed webhooks, jobs and external clients.
4. Confirm postgres actually bypasses RLS (preflight requires BYPASSRLS/super).
   Trigger definer mode is for complete counts/locks, not a caller bypass: no
   current_user/service_role exception exists. Booking write authorization stays
   with existing RLS/RPCs. Invalid pre-existing status permissions are not fixed.
5. Verify caterers.user_id ownership integrity and SELECT/UPDATE RLS. Calendar
   helper uses auth.uid + stored owner, not editable metadata/profile roles.
   A caller must not be able to steal user_id first. Capacity guard authorizes
   OLD owner on update. Inspect default/inherited grants and schema CREATE ACLs.
6. READ COMMITTED is REQUIRED for new requests/acquisitions and settings changes.
   Lock then count uses fresh VOLATILE PLpgSQL SQL-command snapshots; plain
   SELECT-count in an old REPEATABLE READ snapshot is unsafe. Other isolation
   levels intentionally fail with 55000 rather than silently overbook. Existing
   unchanged committed status/payment/refund writes skip acquisition checks.
   Review actual API/maintenance isolation and transaction retry behavior.
7. Count statuses confirmed/awaiting_payment/paid/ongoing/completed, for ALL dates when acquiring
   a slot. Completed historical bookings remain untouched/count in historical
   checks. Capacity reductions and initial safe limits use today/future Manila
   dates only: past peaks do not inflate today's capacity or block reductions.
   PROPOSED decision requiring approval: awaiting_payment conservatively keeps
   its reservation. Local evidence: caterconnect-mobile/supabase/functions/
   xendit-webhook/index.ts:140 writes that status for a booking payment. Inspect
   deployed version and status CHECK/enum; it may be unused legacy source.
   Excluding it would release a confirmed slot and could reject a later paid
   transition. This draft neither adds a status nor changes a payment writer.
   Obtain the full deployed status vocabulary; classify every additional state
   before deployment. An unknown reservation state is not safely treated as free.
8. Approve initial default 1 and elevated limits only for existing future peaks.
   Capture/read the initial-capacities snapshot after staging. No booking state,
   dates/prices/guest counts/monthly counters are backfilled or rewritten.
9. Blocked dates may coexist with commitments and pending requests. They prevent
   NEW requests and acquiring confirmations, never paid->ongoing->completed on
   the same caterer/date. Removing a block reopens the day if capacity permits.
   Ordinary unchanged pending edits stay allowed; confirm reevaluates current
   block/capacity. Moving pending dates/caterers counts as a new request.
10. Capacity setting is owner-only (no new app-admin/maintenance bypass). Legacy
    caterer INSERT defaults to 1; custom nondefault INSERT requires owner JWT.
    Ordinary AuthContext subscription-counter updates do not touch capacity.
    Trusted imports/manual setting changes without owner JWT would be denied:
    normal maintenance uses the actual authenticated owner and unchanged RLS.
    Administrative changes without that owner require a separately approved,
    narrowly granted maintenance interface using a verified DB-role boundary,
    explicit actor/target audit, identical locking/count validation and no public
    EXECUTE. None is implemented by this draft. Do not impersonate auth.uid(),
    trust editable metadata/profile roles, disable guards, or add postgres skip.
11. Review AFTER trigger ordering and external side effects. Transactional
    notifications/monthly counter updates roll back if the new guard rejects.
    External HTTP/email actions might not roll back; inspect, don't assume.
    Later AFTER triggers that modify date/caterer/status must be audited. SQL
    rules/disabled triggers/session_replication_role/TRUNCATE can bypass guards;
    clients must not have such privileges. DDL is a trusted maintenance boundary.
12. Same caterer-row lock serializes capacity additions, block/unblock and limit
    updates. Removals need not acquire it: racing cancellation may conservatively
    reject a request/limit reduction, retry after commit. Multi-caterer writes,
    cascade lock order and existing triggers can deadlock: stage-test and retry
    the WHOLE transaction; never claim zero deadlocks or exactly-once retries.
13. App confirmation currently reports success on zero affected rows except its
    cancellation branch. Server rejection returns an error that UI already shows,
    but lost-race zero-row confirmation is a separate future UI reliability fix.
    Query/insert RPC shape remains backwards compatible; error messages are
    clear 23514 exceptions. Do not change notification/payment behavior here.
14. Public date RPC exposes only dates; raw blocked records are owner-only.
    Existing RPC EXECUTE ACL is retained including any inherited/anon access;
    inspect actual intended audience before approval. No new customer SELECT on
    bookings/caterers and no contact/customer/payment data is exposed.
15. Rehearse matching rollback BEFORE client rollout. It refuses saved blocked
    dates or changed capacity settings and function drift. Later dependencies
    must make RESTRICT fail. No CASCADE workaround or history deletion allowed.
    RESTRICT cannot discover every quoted function body/dynamic SQL or mobile
    caller. Snapshot all original catalogs and inventory untracked references.
16. Native FK cascade removes a caterer before deleting its blocked-date children;
    the guard permits DELETE only when that parent is absent in this transaction.
    With a surviving parent, even maintenance callers require the actual owner.
    No auth.uid=NULL/current_user/pg_trigger_depth exemption is introduced.
    Inspect account-management RPCs and auth.users/profiles/caterers DELETE
    triggers for child-first cleanup, soft deletion and custom FK actions. Any
    incompatible child-first path needs separate review, not a broad exemption.
    Existing NO ACTION booking/package FKs may already prevent account deletion.
17. No new booking status-transition authorization is introduced. Existing RLS
    and state-machine triggers must still decide which transitions are legitimate.
    Availability membership/transition matrix below is not payment authorization.
18. Latest reported index metadata matches; retain the full snapshot of
    pg_get_indexdef + predicate + key/opclass/collation/options,
    tablespace, owner, comment, valid/ready/live/replica-identity/cluster flags,
    constraint backing and dependencies of the named index. No tracked index
    dependents were reported. Forward still rejects drift in shape/predicate/casts, special
    usage, ownership or constraint backing instead of guessing. Exact predicate
    comparison currently accepts text-cast/uncast forms only; enum/domain or
    varchar deparse differences require reviewed adaptation, not relaxed checks.
19. Forward holds ACCESS EXCLUSIVE on caterers/bookings for the ENTIRE cutover:
    snapshot index, install guards/RPC, build nonunique lookup index, check guard
    catalog bindings/modes/ACLs and initialized counts, DROP original index
    RESTRICT, COMMIT. The original unique index remains until checks pass; no
    writer can enter the transaction's temporary DDL state. Guard checks verify
    installation, not runtime correctness. Any failure restores original index
    and rolls back all proposed changes. No concurrent index DDL is used.
20. Rollback checks all dates against the ORIGINAL confirmed/paid/ongoing rule
    (not the broader five-status capacity rule), then recreates saved exact index
    DDL/name/comment while guards and locks remain. Multiple active rows cause
    refusal; CREATE UNIQUE INDEX is also a final validity check. It never rewrites
    bookings to force success. Its new OID differs; definition/name/comment/owner
    are checked. Capacity settings/history/drift/dependency refusals still apply.
    A recreated name collision also causes refusal; no IF NOT EXISTS workaround.
    Keep capacity enforcement and use a separately approved forward fix when
    multi-active-booking history makes legacy uniqueness impossible to restore.
*/

/* REMAINING GATES / EXACT PRIORITIZED STAGING SEQUENCE -- NOT EXECUTED
P0-1 Use an isolated staging database with matching schema/trigger definitions,
     disposable customer/caterer/admin actors and Xendit test integrations only.
     Save baseline RPC/index/catalog definitions, quota settings/counters and
     booking aggregates. Establish baseline quota acceptance/rejection first.
     Use separately approved executable copies; repository safety stops stay.
P0-2 Run guarded-forward rehearsal T01/T02/T31/T32/T34/T35. Check default 1,
     unchanged existing rows and quota objects, exact RPC ACL, enabled guards,
     nonunique lookup index and original unique index removed only at cutover.
     Force before/after-drop failures in separate restored staging copies.
P0-3 Before creating feature settings, rehearse successful empty rollback
     T20/T37, then reapply in a fresh reviewed staging copy. Check exact original
     index/RPC restoration and transactional refusal on dependency/drift errors.
P0-4 Exercise real authenticated RLS/guard access T03/T04/T15/T22/T25:
     owner succeeds, unrelated customer/caterer/anon fails, staff/admin policy
     does not bypass owner-only capacity/block writes. Ordinary staff/admin edits
     with capacity unchanged remain compatible; no new maintenance exemption.
P0-5 Execute T06/T07/T26/T28/T39 at capacities 1, 2, 3 with N+1 contenders,
     both commit/abort lock-release cases, direct committed INSERT, date/caterer
     moves, multi-row statements and actual API READ COMMITTED sessions. Check
     final counts; catalog verification is not evidence of runtime enforcement.
P0-6 Execute T08/T16/T24/T27/T40/T41: reduction/block/unblock/cascade/quota-lock
     races in both orders; capture lock waits, SQLSTATEs and atomic rollback.
     The common parent lock serializes DIFFERENT event dates too. Assess latency.
     Forward/rollback lock caterers before bookings; an in-flight booking writer
     may lock bookings then need caterers, creating a maintenance deadlock cycle.
     Drain writers, choose bounded maintenance lock/statement timeouts in the
     approved runbook, and abort/retry whole maintenance transactions on timeout.
     Do not add generic automatic retries around payments or external effects.
P0-7 Execute T09/T10/T17/T19/T29/T30/T40 using deployed-equivalent payment,
     cancellation/refund and monthly-quota paths. A normal same-key transition
     within all five committed statuses skips capacity checks, including blocked
     dates. No recalculation of prices, refunds or quota rules is authorized.
     Transactional trigger effects must roll back on availability rejection;
     external effects require their own verified delivery/idempotency behavior.
P0-8 Execute T21/T33/T36/T38 after multiple active bookings and saved settings:
     rollback must refuse without removing guards/index lookup or editing data.
P1-9 Execute T11/T12/T13/T14/T18/T23 plus old-client date RPC/error handling,
     Manila boundaries, account cascades and unchanged signup/subscription edits.
     Record all results, failures and retry/latency observations before approval.

MONTHLY QUOTA COMPATIBILITY (source-level finding, not runtime certification)
The proposal neither changes subscription_plans nor monthly_booking_count /
booking_count_reset_at, nor replaces existing quota functions/triggers/RLS.
The caterer AFTER capacity guard returns immediately if capacity is unchanged;
ordinary counter resets/increments therefore do not acquire a new capacity gate.
Local AuthContext.tsx:74-94 resets monthly counters; the legacy webhook :97-98
also writes them. Customer booking INSERT errors are thrown before client success
(book/[catererId].tsx:418-420). No client quota increment is added here.
All existing caterer UPDATE triggers still run for a capacity-only UPDATE: test
that they do not reset/rebill/recount subscriptions on unrelated field changes.
A rejected booking must not consume monthly quota via a transactional trigger.
If an existing counter update occurs through a separate transaction, HTTP call
or scheduled process, its consistency is not guaranteed by this migration.
Do not claim monthly quotas are enforced server-side without that evidence.

ADDITIONAL LIVE READ-ONLY CHECKS -- only if not already retained/reviewed
1. Complete monthly-quota enforcement/increment/reset trigger/function bodies and
   called helpers; relevant status/column guards and external side effects.
   Reuse existing trigger review outputs. The metadata SELECTs below already
   retrieve booking/caterer trigger bodies and candidate functions; no duplicate
   index/RPC/data-discovery round is needed on unchanged metadata.
2. Relevant API role/database/function isolation SET configuration, if unknown;
   SQL Editor's isolation alone does not establish authenticated API isolation.
   Actual isolation and lock behavior must be observed in staging as well.
3. Only previously unreviewed deployed Edge Functions/jobs/alternate writers:
   determine actual awaiting_payment/downgrade-to-pending transitions, conflict
   inference and nontransactional quota/notification effects. Deployed code
   inspection, rather than broad live user-data queries, is appropriate here.
Postgres bypass/default/inherited ACL and schema CREATE checks remain needed if
not included in retained metadata. Recheck drift just before approved execution.

PRODUCT/OPERATIONS DECISIONS STILL REQUIRED
Owner identity is the calendar authorization boundary; these guards add no
active-status/profile-role gate. Decide separately if suspended owners should
lose calendar access. Admin maintenance of capacity remains owner-only until a
separate narrow interface is approved. No profile-security work is performed.
Confirm the five-status reservation set, future-only reduction policy, blocked
pending-confirmation behavior, writer-drain window and retry/error handling.
*/

/* CONCURRENCY ARGUMENT -- static reasoning, NOT a completed staging test
Assumptions: READ COMMITTED; ordinary enabled non-deferred AFTER ROW guards on
every booking acquisition/move; all capacity and block writes use these guards;
postgres helpers see all booking rows; no unsafe writer disables/bypasses guards;
existing triggers/rules do not invalidate final row semantics. Verify these.

At capacity 1, T1 and T2 UPDATE different pending bookings to confirmed. Their
uncommitted versions are initially invisible to each other. T1 obtains the
caterer NO KEY UPDATE lock; T2's same lock conflicts and waits. T1's separate
count sees its own row plus committed rows, and either rejects or commits while
holding the lock. After T1 commits, T2 obtains the lock. Its subsequent count
query in this VOLATILE PLpgSQL function takes a fresh READ COMMITTED snapshot:
it sees T1's committed row plus its own row (count 2), and raises 23514. T2's
entire statement/transaction cannot commit that over-capacity acquisition.
If T1 aborts, T2 may succeed. For limit N, the same serialized check permits only
acquisitions whose resulting committed membership is <= N. No extra +1 is used:
AFTER triggers already see their own statement's changed rows.

Capacity UPDATE locks the same parent before its AFTER count. If it wins first,
a later confirmation reads the new limit; if confirmation wins, reduction's
fresh count sees it and rejects an unsafe reduction. Block INSERT locks that
parent before insertion; requests/confirmations serialize against that lock.
A later block may coexist with existing commitments; it never cancels them.
Releases/deletes do not need the parent lock to protect the upper bound: stale
visibility can only overcount them. Rejections may require retry after commit.

Multi-row statements: AFTER ROW events see statement changes, including other
rows changed by the statement. A batch exceeding capacity fails atomically;
even early events can reject using the final batch count. Date/caterer moves
validate destination; leaving a source only releases capacity. Swaps involving
multiple caterers can deadlock (different parent-lock order); PostgreSQL aborts
one transaction. Retry whole transactions only after checking side effects.
A batch creating pending requests and filling their date can be conservatively
rejected, even if a different statement order would succeed. Do not claim all
otherwise valid bulk import/reassignment sequences are accepted.

Separate lock and count statements and VOLATILE are essential. Do not combine
them in a CTE or mark guards STABLE. REPEATABLE READ/SERIALIZABLE acquisitions
and capacity/block writes are rejected, rather than relying on stale snapshots.
References: https://www.postgresql.org/docs/current/xfunc-volatility.html
https://www.postgresql.org/docs/current/explicit-locking.html
https://www.postgresql.org/docs/current/trigger-definition.html

TRANSITION MATRIX (existing state authorization still applies)
- New/moved pending or transition INTO pending: check blocked/full, reserve zero.
  Thus reverting a commitment to pending on a blocked/full date can be denied;
  inspect whether any deployed workflow needs such a transition before approval.
- New/moved committed (confirmed/awaiting_payment/paid/ongoing/completed), or
  entry from pending/cancelled/rejected/NULL: check blocked + resulting count.
- Committed -> committed, same caterer/date: no new acquisition; keep slot.
  Existing payment/completion updates survive blocks and legacy full dates.
- -> cancelled/rejected or DELETE: releases slot; no capacity/block check.
- Unchanged pending and ordinary unchanged-key edits: preserve existing behavior.
- Past-date acquisitions count historical completed rows; reductions check only
  today/future (transaction-start Asia/Manila date). No historical data rewritten.
*/
BEGIN;
DO $$ BEGIN
  RAISE EXCEPTION 'PROPOSAL ONLY: read-only availability metadata requires separate SQL approval';
END $$;
SELECT version(),current_user,current_setting('transaction_isolation');
SELECT p.oid::regprocedure,pg_get_userbyid(p.proowner),p.prosecdef,p.proconfig,p.proacl,
       pg_get_function_result(p.oid),p.proargnames,pg_get_functiondef(p.oid)
FROM pg_proc p WHERE p.oid='public.get_caterer_unavailable_dates(uuid)'::regprocedure;
SELECT * FROM information_schema.columns WHERE table_schema='public'
  AND table_name IN ('bookings','caterers','caterer_blocked_dates');
SELECT * FROM pg_policies WHERE schemaname='public'
  AND tablename IN ('bookings','caterers','caterer_blocked_dates');
SELECT conrelid::regclass,conname,pg_get_constraintdef(oid,true) FROM pg_constraint
WHERE conrelid IN ('public.bookings'::regclass,'public.caterers'::regclass)
   OR confrelid IN ('public.bookings'::regclass,'public.caterers'::regclass);
SELECT * FROM pg_indexes WHERE schemaname='public' AND tablename IN ('bookings','caterers');
-- Named standalone index (pre-forward). No rows after successful cutover.
SELECT c.oid::regclass,c.relowner::regrole,c.relkind,c.reltablespace,c.reloptions,
       am.amname,x.indisunique,x.indisvalid,x.indisready,x.indislive,
       x.indisprimary,x.indisreplident,x.indisclustered,x.indnkeyatts,x.indnatts,
       x.indkey,x.indclass,x.indcollation,x.indoption,
       pg_get_indexdef(c.oid),pg_get_expr(x.indpred,x.indrelid),
       obj_description(c.oid,'pg_class') AS index_comment
FROM pg_class c JOIN pg_index x ON x.indexrelid=c.oid JOIN pg_am am ON am.oid=c.relam
WHERE c.oid=to_regclass('public.bookings_unique_active_caterer_date');
SELECT conname,contype,pg_get_constraintdef(oid,true) FROM pg_constraint
WHERE conindid=to_regclass('public.bookings_unique_active_caterer_date');
SELECT d.deptype,pg_describe_object(d.classid,d.objid,d.objsubid) AS dependent_object
FROM pg_depend d WHERE d.refclassid='pg_class'::regclass
  AND d.refobjid=to_regclass('public.bookings_unique_active_caterer_date');
SELECT tgrelid::regclass,tgname,tgenabled,pg_get_triggerdef(oid,true),pg_get_functiondef(tgfoid)
FROM pg_trigger WHERE tgrelid IN ('public.bookings'::regclass,'public.caterers'::regclass,
  'public.profiles'::regclass,'auth.users'::regclass,to_regclass('public.caterer_blocked_dates'));
SELECT * FROM information_schema.table_privileges WHERE table_schema='public'
  AND table_name IN ('bookings','caterers','caterer_blocked_dates');
SELECT * FROM information_schema.column_privileges WHERE table_schema='public'
  AND table_name IN ('bookings','caterers','caterer_blocked_dates');
SELECT p.oid::regprocedure,pg_get_userbyid(p.proowner),p.prosecdef,p.proconfig,p.proacl,pg_get_functiondef(p.oid)
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.prokind='f'
  AND n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname !~ '^pg_'
  AND (p.prosecdef OR p.prosrc ILIKE '%bookings%' OR p.prosrc ILIKE '%caterers%');
-- Status CHECKs are included above; also inspect enum labels if status is enum.
SELECT t.typnamespace::regnamespace,t.typname,e.enumlabel,e.enumsortorder
FROM pg_attribute a JOIN pg_type t ON t.oid=a.atttypid
JOIN pg_enum e ON e.enumtypid=t.oid
WHERE a.attrelid='public.bookings'::regclass AND a.attname='status'
ORDER BY e.enumsortorder;
SELECT defaclrole::regrole,defaclnamespace::regnamespace,defaclobjtype,defaclacl FROM pg_default_acl;
SELECT rolname,rolsuper,rolbypassrls,rolinherit FROM pg_roles
WHERE rolname IN ('postgres','anon','authenticated','service_role');
SELECT roleid::regrole,member::regrole,admin_option FROM pg_auth_members;
SELECT schemaname,tablename,rulename,definition FROM pg_rules
WHERE schemaname='public' AND tablename IN ('bookings','caterers');
SELECT oid::regclass,relkind,relrowsecurity,relforcerowsecurity,relispartition
FROM pg_class WHERE oid IN ('public.bookings'::regclass,'public.caterers'::regclass);
-- Post-forward tracked dependencies; also inspect quoted bodies/app callers.
SELECT p.oid::regprocedure,d.deptype,pg_describe_object(d.classid,d.objid,d.objsubid)
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
JOIN pg_depend d ON d.refclassid='pg_proc'::regclass AND d.refobjid=p.oid
WHERE n.nspname='public' AND starts_with(p.proname,'cc_availability1_');
COMMIT;

/* STAGING TEST CHECKLIST -- disposable fixtures, real API actors, NOT RUN
T01 Empty legacy caterer gets 1; future peak 3 gets 3; past-only peak remains 1.
T02 Initial future count includes completed; all existing booking values intact.
T03 Owner reads/adds/removes blocks; customer/unrelated caterer/anon cannot write.
T04 Owner capacity positive integer; 0/negative/NULL invalid; nonowner denied.
T05 Owner cannot reduce below any today/future commitment; rejected change leaves
    old capacity unchanged. Historical completed rows do not block future limit.
T06 Pending requests reserve no slots; multiple pending at capacity 1 allowed
    while committed count is 0. No pending INSERT when day already full/blocked.
T07 Independent API transactions confirm same day at cap 1: exactly one commits.
    At cap 2 exactly two; cap 3 exactly three. N+1 must fail. Confirm the original
    unique index is absent first, so tests exercise capacity guards, not legacy
    23505 enforcement. Verify actual rows, not UI alerts.
T08 Parallel confirmation vs reduction/block: result follows lock order; committed
    records are never auto-cancelled. A block added after a confirmation persists
    alongside it, and denies later acquisitions/requests.
T09 Existing confirmed->paid->ongoing->completed succeeds on blocked/legacy full
    dates; no second slot counted. Normal field/payment/refund edits preserved.
T10 Cancel/reject releases committed membership; no refund/payment logic changed.
T11 Direct INSERT committed/date move/caterer move/reentry from cancelled into
    committed is checked. Existing transition authorization must still reject
    unauthorized status changes; guard adds capacity, not blanket authorization.
T12 Completed historical row unchanged stays intact; a NEW historical acquisition
    counts existing completed rows and rejects above capacity. No historical
    booking deletion or retroactive status rewrite occurs.
T13 RPC returns unique dates at count>=capacity plus blocked dates; open days
    omitted. Same existing event_date response for old app clients.
T14 Cebu midnight vs database UTC: date boundary uses Asia/Manila consistently.
T15 RLS-hidden other customers' commitments still included by definer guard/RPC;
    date RPC leaks no bookings/customer details. Owner helper reveals boolean only.
T16 READ COMMITTED concurrent tests; REPEATABLE READ acquisition/settings fails
    55000; ordinary unchanged committed updates still compatible. Deadlock retry.
T17 New signup/legacy caterer creation default 1; monthly plan limit/counter reset
    and package/guest/payment calculations unchanged. Existing notifications once.
T18 Customer/Caterer Auth delete and FK cascade preserve pre-existing behavior;
    block DELETE skip only when parent absent. Existing booking/package NO ACTION
    restrictions remain. Deleting a package does not alter daily counts directly.
T19 SQL error rolls back booking, database notification, monthly counter and
    capacity settings atomically. Inspect external-trigger side effects separately.
T20 Forward + unchanged-empty-settings rollback restores original RPC definition/
    ACL/owner, original index DDL/name/comment/owner and original policies/triggers.
    Nonunique lookup index is removed. No booking data removed.
T21 Rollback refuses blocks, changed capacity, RPC drift, or external dependencies.
    Compare complete original catalogs and booking aggregates after rollback.
T22 Account switch/direct API writes/untrusted metadata/unsafe definer RPCs cannot
    configure another caterer's calendar/capacity. Test ownership-column integrity.
T23 Native caterer DELETE with blocked rows under reviewed maintenance context
    and NULL auth.uid succeeds in disposable staging if existing FKs permit.
    Repeat full Auth->profiles->caterers cascade and owner-initiated deletion.
    With parent present, nonowner/NULL-actor blocked DELETE and INSERT fail;
    manual child-first administrative cleanup remains denied pending design.
T24 Concurrent blocked DELETE vs parent/account DELETE: permit complete cascade
    or atomic deadlock victim rollback, never partial deletion or leaked rows.
    Child-first/custom DELETE triggers and soft-delete paths must be inventoried.
T25 Ordinary owner capacity UPDATE succeeds and unrelated owner is denied;
    admin/postgres NULL-actor change also fails. Unchanged-capacity admin edits
    stay compatible. Ownership transfer + capacity change in one UPDATE denied.
T26 Two separate SQL Editor sessions, READ COMMITTED, no sleep-based claims:
    hold T1 confirmation uncommitted; T2 confirmation must wait on parent; commit
    T1, then T2 must fail at capacity 1. Repeat T1 rollback; T2 may succeed.
    Repeat with N slots/N+1 contenders, direct INSERT committed and date moves.
    Record final committed count/statuses and actual lock/wait/error outcomes.
T27 Reduction vs confirmation in both lock orders; increase vs confirmation;
    block vs confirmation/request and unblock vs confirmation. Changes are
    atomic, existing commitments intact; document permitted conservative retry.
T28 Single multi-row UPDATE confirming >limit rejects the whole batch. Fitting
    batch succeeds. Same-day swaps and cross-caterer moves, mixed pending +
    committed batch, cancellations + confirmations and opposite lock order:
    no overbooking, atomic failure/deadlock retry, no duplicate side effects.
T29 confirmed->awaiting_payment->paid->ongoing->completed on same key keeps one
    slot and survives blocks; legacy initial peak/RPC/reduction counts include it.
    pending->awaiting_payment acquires a slot; cancelled/rejected reentry checks
    again. Run only transitions actually permitted by the deployed workflow;
    compare every deployed status to the membership matrix before execution.
T30 Same-status date/caterer changes for pending and each committed state validate
    destination; unchanged fields do not reacquire. Date move into blocked/full
    fails atomically, source preserved. Existing transitions out of committed
    remain authorized only by old rules. Inspect any downgrade-to-pending path.
T31 Exact named partial index is snapshotted and removed only at checked cutover.
    A changed predicate/key/type/name or constraint-backed/specially used index
    causes refusal. OTHER unique/exclusion objects are never removed automatically.
    Confirm no deployed function/trigger still enforces one booking per date or
    relies on its unique-violation/ON CONFLICT behavior; resolve separately.
T32 RPC OID/signature/output/owner/ACL/config preserved. Different shape/name/SET
    config aborts whole forward transaction. Rollback reproduces original body
    exactly; drift or a tracked external dependency aborts whole rollback.
    Verify untracked SQL/PLpgSQL callers manually and all original catalogs.
T33 Settings-bearing rollback refuses. Forward-fix rehearsal retains blocks and
    capacities/bookings; no history deletion, CASCADE or disabled-trigger escape.
T34 Capture named index definition/comment/owner and all original catalogs before
    forward. During approved staging cutover verify a second connection cannot
    write while ACCESS EXCLUSIVE is held. After commit verify original absent,
    new guards enabled and lookup index valid. Existing booking rows unchanged.
T35 Force a staging failure BEFORE the drop and separately AFTER the drop before
    COMMIT: whole transaction aborts; original unique index remains/restores and
    no partial guard/settings schema persists. Do not remove execution stops in
    repository files to make these rehearsals run; approve isolated copies only.
T36 At capacity 2 and 3 create multiple confirmed/paid/ongoing rows for a date.
    Rollback must explicitly refuse uniqueness restoration, leave all booking
    values intact, keep capacity guards/RPC/lookup index, and leave original index
    absent. Test past dates too: rollback conflict checking has no future filter.
T37 With no uniqueness conflicts and unchanged/empty settings, rollback restores
    the exact old partial predicate and index name/comment/owner (different OID).
    Awaiting_payment/completed rows alone are not conflicts under the OLD index;
    existing settings refusals still apply. Verify original uniqueness behavior
    afterward, without changing payments or booking statuses to force rollback.
T38 A tracked dependent object makes DROP INDEX RESTRICT fail with the whole
    forward transaction undone. A later failure after rollback index recreation
    undoes the whole rollback. Test index-name/owner drift refusals separately.
T39 At each limit 1/2/3, mix confirmed/awaiting_payment/paid/ongoing/completed in
    the FIVE-state count: no extra slot appears when payment/completion changes
    membership within that set. Compare unavailable RPC and guard results.
T40 Monthly quota baseline regression: at an available date, a request below the
    existing monthly limit succeeds with exactly the baseline counter effect;
    at the monthly limit, old quota denial remains even with free daily slots.
    Availability-rejected INSERT consumes no transactional monthly count and
    sends no committed database notification. Concurrent daily rejection vs
    quota increment/reset leaves consistent counters. Capacity-only and block
    changes do not reset counters, renew plans or alter limits. Compare across
    the configured plans; preserve whatever unlimited sentinel schema uses.
T41 Maintenance lock acquisition with an already-running booking writer; parent
    lock contention across distinct dates, quota-trigger locks, refund/status
    writes and cascade/bulk moves. Capture deadlock/timeout rollback and retry
    behavior. No duplicate payment/refund/external effect may be induced by a
    retry. If safe bounded operational behavior cannot be demonstrated, stop
    staging approval and revise only the demonstrated conflicting lock path.
No production writes, fixtures, deletes, SQL execution, or app tests performed.
*/
