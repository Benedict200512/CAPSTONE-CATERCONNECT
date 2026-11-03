# CaterConnect staff provisioning deployment runbook

**Documentation only. No live deployment is authorized by this file.**

Use the existing CaterConnect Supabase project. Do not create another project, rerun `profiles_role_protection_EXECUTE.sql`, or install any Phase 1/Phase 2 migration. Preserve all existing accounts, role protections, profile-edit permissions and unrelated features.

## Package references

- Guarded SQL: `supabase/proposals/staff_provisioning_proposal.sql`.
- Edge Function: `caterconnect-mobile/supabase/functions/create-staff-account/index.ts` and `handler.ts`.
- CLI configuration: `caterconnect-mobile/supabase/config.toml`, with `verify_jwt = true`.
- Existing frontend: Platform Settings calls `create-staff-account` with full name, email and password. Confirmation stays in the form. Staff use the existing portal login and Staff Dashboard.

The SQL patch restricts `cc_profile_role1_assign_staff_role(uuid,text)` to active-admin-authorized changes between existing staff/admin accounts. Customer/caterer targets, customer destinations and self-role changes are denied. Its signature, owner, security configuration and privileges are preserved. The new finalizer is service-only; public signup metadata cannot assign privileged roles.

## 1. Read-only prerequisite verification

Obtain read-only access to the correct project. Inspect metadata without calling provisioning functions, creating users or exposing credentials/customer information.

- Compare the installed `public.cc_profile_role1_assign_staff_role(uuid,text)` body with the proposal's `$expected$` body. Only CRLF-to-LF normalization is accepted; do not collapse arbitrary whitespace or bypass drift failures.
- Verify argument names/types, `RETURNS TABLE(id uuid, role text)`, owner `postgres`, SECURITY DEFINER, VOLATILE, and configuration `search_path=""`. Record the exact function definition and ACL for comparison after installation. Confirm the maintenance role has the required RLS bypass and DDL privileges.
- Verify `auth.users.banned_until` exists as `timestamp with time zone`. Inspect the existing Auth trigger and profile defaults to establish that a newly created Auth identity receives an active customer profile before trusted finalization. A NULL/non-active profile status causes finalization to refuse; do not change defaults speculatively.
- Verify the installed signup safeguards and profile INSERT/UPDATE restrictions remain present. Confirm ordinary clients cannot write `profiles.role` or trusted Auth app metadata. Check effective/inherited grants and publicly reachable privileged wrappers relevant to these operations.
- Confirm `cc_staff_provision1_private` and `cc_staff_provision1_finalize(uuid,uuid,uuid)` do not already exist. If they do, inspect their state instead of dropping/replacing them blindly.
- Confirm the existing legitimate administrator remains active. Do not change their account or run `seed_staff_accounts()`.
- Verify the intended project reference, CLI authentication, current Edge inventory, gateway JWT compatibility and configuration availability. Check secret names/presence without printing their values. The finalizer cannot be proven operational through metadata inspection alone.

Stop on any mismatch. The proposal's actual preflight checks must remain intact. No unrelated policies, grants, triggers or functions should be adjusted to make installation pass.

## 2. Obtain separate SQL execution approval

Present the guarded SQL proposal and prerequisite findings to the owner. The proposal intentionally raises `PROPOSAL ONLY` and is not directly executable as stored.

After separate explicit approval, prepare a reviewed execution copy removing only that deliberate stop. Preserve the guarded original, complete `BEGIN`-to-`COMMIT` transaction, maintenance lock, exact RPC baseline comparison, Auth column check, backup snapshots, privilege restrictions and post-replacement checks. Do not remove real preflight failures.

Run the entire approved staff-only transaction as the verified maintenance role during an agreed maintenance window. Its profile-table lock may wait for or block ordinary profile writes. An error must roll back the transaction; do not continue from the failed statement or manually apply fragments.

**Never rerun the already installed profile-role protection migration.** Do not use `supabase db push` or run the monthly quota proposal as part of this task.

## 3. Verify SQL installation before deploying the endpoint

Use read-only catalog inspection:

- Confirm `public.cc_staff_provision1_finalize(uuid,uuid,uuid)` exists, returns UUID, is owned by `postgres`, is SECURITY DEFINER/VOLATILE and uses an empty search path.
- Confirm effective EXECUTE is available to `service_role` and unavailable to `anon`/`authenticated`, including inherited grants. Confirm its body checks service-role authorization and active-admin status.
- Confirm finalization checks matching actor/nonce in server-controlled Auth app metadata, creation within ten minutes, no previous sign-in, a future Auth ban, an active eligible profile and no caterer business record.
- Compare the existing role RPC with the reviewed replacement. Its OID/signature/owner/ACL/config should be preserved; customer/caterer promotion must now be rejected by its body.
- Confirm the original RPC snapshot exists in `cc_staff_provision1_private.original_rpc`; profile policies/column privileges and signup safeguards are unchanged.

Do not invoke the finalizer or seed function merely to inspect their existence. If verification fails, stop before Edge deployment and use a reviewed forward fix.

## 4. Configure server-side environment

Required runtime names:

| Name | Purpose |
| --- | --- |
| `SUPABASE_URL` | Existing project's API URL. |
| `SUPABASE_ANON_KEY` | Auth client used to verify the caller through `getUser(token)`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Auth Admin and service-only RPC access. |
| `STAFF_PORTAL_ORIGIN` | Exact trusted browser origin used by the endpoint's CORS check. |

Supabase normally supplies the first three in the hosted Edge runtime; verify their availability. Configure the custom origin through the project's Edge Function secrets. Use the actual HTTPS production origin, including a non-default port if present, with no path or trailing slash. For example, `https://portal.example.com`, not `https://portal.example.com/admin/`.

The implementation supports one allowed origin at a time. Do not add a wildcard or silently disable origin/JWT checks. Never put a service-role key in Vite variables, the browser, source control, runbook examples or command history. Disable request-body capture in diagnostics because the request contains a password.

This workflow uses administrator-set passwords and `email_confirm=true`; it does not independently verify recipient email ownership. The owner must accept administrator-attested provisioning and communicate credentials privately. No invitation email, SMTP or recovery redirect is needed for normal creation.

## 5. Deploy only the approved function

After separate deployment approval, run from the repository root in PowerShell:

```powershell
supabase functions deploy create-staff-account --project-ref <EXISTING_PROJECT_REF> --workdir .\caterconnect-mobile --use-api
```

Replace the placeholder with the existing CaterConnect project reference. This command is an instruction only and has not been executed as part of restoring this document.

Keep `verify_jwt = true` in the existing local function configuration and verify it in the deployed gateway configuration. Do not add `--no-verify-jwt`. If this project's JWT signing configuration is incompatible with gateway verification, stop for a separately reviewed resolution. The endpoint also verifies JWTs through Auth and checks the database administrator status; these checks must remain.

Verify the named function is deployed to the correct project and boots without missing-variable/import errors. Inspect sanitized logs without recording tokens, passwords, Auth objects or secret values. Do not deploy other functions or push project-wide configuration/migrations.

## 6. Approved disposable-account verification

Obtain explicit approval for each live test identity and any test fixtures needed to hold/fail provisioning stages. Do not test against existing administrator, staff or customer accounts. Do not disable production guards or add a public test bypass.

1. Missing/invalid JWT, customer, staff and suspended-admin callers must not create accounts. An unrelated browser origin must be rejected.
2. Duplicate profile/Auth emails, including existing customer/caterer identities and unconfirmed Auth identities, must be rejected without modifying the existing account. Concurrent same-email attempts must produce at most one new Auth identity.
3. In a separately approved controlled fixture, hold after Auth creation. Verify a future `banned_until` and rejection of password sign-in. Hold after profile finalization and confirm the ban remains until activation.
4. Successful provisioning must follow banned creation → staff finalization → activation. Verify only the newly returned user ID is unbanned, the profile is staff, and the endpoint returns no password or service key.
5. Fail finalization and confirm activation is never called. Fail/lose the activation response and inspect the actual Auth ban rather than assuming the account is still banned. Verify no automatic retries or deletions.
6. Confirm the admin form reports success and refreshes the staff table. Test a table-refresh failure separately: it must not prompt another account creation.
7. Sign in as the approved new staff identity through the existing web login. Confirm Staff Dashboard access and denial of admin-only routes. Verify authorized staff/admin role management and normal profile editing remain functional, without altering the existing administrator account.

Release the matching frontend only after backend verification passes. Offline checks available before live approval are web TypeScript, `node scripts/test-profile-roles.cjs`, and `node scripts/test-staff-provisioning.cjs` from `caterconnect-web`. Mock tests do not prove hosted Auth ban enforcement or SQL runtime behavior.

## 7. Manual recovery for partial failures

Auth creation, database finalization and Auth activation are separate transactions. They cannot be committed atomically together. No automatic account deletion, customer conversion or uncertain-operation retry is permitted.

| Endpoint result | Meaning and required manual action |
| --- | --- |
| Duplicate-email rejection | Leave the existing identity unchanged. Do not promote it or resubmit with its ID. |
| `CREATION_UNCONFIRMED` | Creation may have committed despite a lost response. Read-only inspect Auth/profile state before any retry. A new banned identity may exist. |
| `FINALIZATION_UNCONFIRMED` | A new banned identity was confirmed by creation; this request did not attempt activation. SQL may have rolled back or committed without a response. Inspect both role and ban state. |
| `ACTIVATION_UNCONFIRMED` | Staff finalization succeeded, but unban may have committed despite an error. The account may be banned or usable. Inspect its actual state; do not blindly retry creation or unban. |
| Lost final HTTP response | The entire operation may have succeeded. Check the table and Auth state before taking action. |

For recovery, obtain separate owner authorization. Establish the exact new identity from trusted Auth/profile records and the known request's email; verify creation time, server-created actor/nonce metadata, no caterer association, current role, ban and relevant logs. Reconfirm administrator authorization before any privileged recovery action. Do not expose credentials while inspecting.

- If finalization genuinely failed, retain the ban. Complete provisioning only through a separately reviewed trusted operation that meets the finalizer's checks.
- If staff finalization is confirmed but the identity remains banned, an operator may activate that exact new identity only after explicit approval and review. Never unban another account by email alone.
- If activation already succeeded, do not replay provisioning. Verify staff login/access through the approved test procedure.
- If identity eligibility is uncertain, or the ten-minute/no-sign-in checks no longer pass, stop. Do not rewrite timestamps, metadata or roles to bypass them; request a reviewed maintenance decision.
- Never automatically delete partial identities. Retain snapshots and evidence. Any cleanup needs separate explicit approval.

The nonce is not treated as secret from the identity owner; the service-only privilege boundary and server-only metadata writes are essential. Ordinary finalizer replay fails after role assignment; this implementation does not claim a permanent nonce ledger.

If deployment is faulty, disable provisioning entry points first and preserve account history. Prefer a forward fix. Restoring the old role RPC reopens customer promotion and requires separate approval. Do not restore broad role UPDATE grants or remove signup safeguards.
