# Environment DB Restore Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Owners can restore their environment's Postgres from a manual, scheduled or safety dump in vetra.io, with nightly dumps on by default.

**Architecture:** Backend in `vetra-cloud-package` (worktree `../vetra-cloud-package-restore`, branch `feat/env-db-restore` off `origin/main`): doc-model `backupSchedule` + `SET_BACKUP_SCHEDULE`, processor projects it, observability subgraph gets dump `source`, retention, a schedule runner and a tracked multi-step restore driven by the existing 10s dump watcher. Frontend in `vetra.io` flips the restore flag and shows restore progress. Infra: bucket lifecycle 1 → 30 days.

**Tech Stack:** TypeScript, Kysely (PGlite in tests), vitest, @kubernetes/client-node, Powerhouse doc models (`pnpm generate`), Next.js.

**Spec:** `docs/superpowers/specs/2026-10-27-environment-db-restore-design.md`

## Global Constraints

- Retention: MANUAL newest 5, SCHEDULED newest N (1–30, default 7), PRE_RESTORE newest 3; `expiresAt = requestedAt + 30d`; deleting a dump deletes S3 object and row.
- Default schedule when none set: enabled, DAILY, retention 7.
- Restore connects to `${tenantNs}-pg-rw`, never the pooler.
- Restore SQL runs in one transaction: drop app-owned non-system schemas, then `pg_restore --no-owner --no-acl` output.
- Auth for every new query/mutation: `authorizeDump` (owner, or org OWNER/ADMIN).
- Scheduled dumps: at most 5 scheduled Jobs in flight cluster-wide; only `status = READY` envs with SWITCHBOARD enabled and a tenantId.
- Commits: small, conventional, no AI attribution trailer.

## Review Focus

1. Backend crash mid-restore → on restart the watcher must still scale Switchboard back up (replica count persisted on the row).
2. Restore requested while a dump is already in flight for that tenant → the safety dump can't be created; must fail cleanly with `DUMP_IN_PROGRESS`, nothing stopped.
3. Restore of a dump belonging to a different tenant → `FORBIDDEN`/`DUMP_NOT_FOUND`, never cross-tenant.
4. Retention delete when S3 object is already gone (lifecycle) → row still deleted, no throw.
5. Env deleted/stopped between scheduling and firing → runner skips, no FAILED spam.

---

### Task 1: Doc model `backupSchedule` + `SET_BACKUP_SCHEDULE`

**Files:** `document-models/vetra-cloud-environment/vetra-cloud-environment.json`, `v1/schema.graphql` (generated), `v1/src/reducers/data-management.ts`, `v1/tests/data-management.test.ts`, regenerated `v1/gen/**`.

- [ ] Add to state schema: `backupSchedule: BackupSchedule`, `type BackupSchedule { enabled: Boolean! cadence: BackupCadence! retention: Int! }`, `enum BackupCadence { HOURLY DAILY WEEKLY }`; initialValue `"backupSchedule": null`; op `SET_BACKUP_SCHEDULE` (input `SetBackupScheduleInput`, same fields) in the data-management module (copy from `fc47257`).
- [ ] `pnpm generate`; revert any clobbered test files (`git checkout -- '**/tests/*.test.ts'` except the one you edit).
- [ ] Reducer `setBackupScheduleOperation`: `assertOwner`, retention outside [1,30] → `INVALID_RETENTION`, set state, no `markPendingIfDeployed`.
- [ ] Tests: sets schedule; rejects retention 0 and 31; rejects non-owner. Run `npx vitest run document-models/vetra-cloud-environment`. Commit.

### Task 2: Processor projects `backupSchedule`

**Files:** `processors/vetra-cloud-environment/{migrations.ts,processor.ts,schema.ts}`, read-model test.

- [ ] Migration adds `backupSchedule text` (try/catch pattern like `autoUpdateChannel`); row gets `backupSchedule: state.backupSchedule ? JSON.stringify(state.backupSchedule) : null`; schema type `backupSchedule: string | null`.
- [ ] Test in `read-model.test.ts` asserting the column round-trips. Commit.

### Task 3: Dump `source`, 30-day expiry, retention, S3 delete

**Files:** `subgraphs/vetra-cloud-observability/{db/migrations.ts,db/schema.ts,dumps/repo.ts,dumps/s3.ts,dumps/resolvers.ts,schema.ts}`, tests `dumps-repo`, `dumps-s3`, `dumps-resolvers`, `db-migrations`.

**Produces:**
- `type DumpSource = "MANUAL" | "SCHEDULED" | "PRE_RESTORE"`; `DatabaseDumps.source: DumpSource`
- `DumpsRepo.create(input: CreateInput & { source?: DumpSource })` (default MANUAL), `TTL_HOURS = 24 * 30`
- `DumpsRepo.listBySource(tenantId, source): Promise<DatabaseDumps[]>` oldest-first
- `DumpsRepo.deleteById(id): Promise<void>`
- `DumpsRepo.countInFlightBySource(source): Promise<number>`
- `DumpsRepo.lastRequestedAt(tenantId, source): Promise<Date | null>`
- `S3Helper.deleteObject(key): Promise<void>` (404 swallowed)
- `RETENTION: Record<DumpSource, number>` = `{ MANUAL: 5, SCHEDULED: 7, PRE_RESTORE: 3 }` and `applyRetention(repo, deleteObject, tenantId, source, keep): Promise<string[]>` in `dumps/retention.ts` — deletes oldest beyond `keep`, never in-flight rows, S3 first then row, S3 failure is logged and the row still goes.
- GraphQL `enum DumpSource`, `DatabaseDump.source: DumpSource!`.

- [ ] Migration: `alter table database_dumps add column source varchar(32) not null default 'MANUAL'` (try/catch). Test old rows read as MANUAL.
- [ ] Repo + retention tests: keep=2 with 4 READY rows deletes 2 oldest and calls deleteObject for their keys; in-flight row never deleted; deleteObject throwing still deletes row.
- [ ] `requestEnvironmentDump` applies MANUAL retention after create; row pruner uses `expiresAt < now` instead of 7-day requestedAt. Commit.

### Task 4: Scheduled backups runner

**Files:** create `dumps/backup-schedule-runner.ts`, `__tests__/backup-schedule-runner.test.ts`; modify `index.ts`.

**Consumes:** Task 3 repo/retention. **Produces:** `runBackupScheduleTick(envs: BackupEnvSnapshot[], deps: { repo, fire, deleteObject, maxInFlight: number }, now: Date): Promise<{ fired: string[]; deleted: string[] }>`; `DEFAULT_SCHEDULE = { enabled: true, cadence: "DAILY", retention: 7 }`; `jitterMs(tenantId: string, cadenceMs: number): number` (stable hash, < cadence/… capped at 6h for DAILY/WEEKLY, 30m for HOURLY).

- [ ] Tests: null schedule → treated as default; disabled → skip; due = `last == null ? now >= epochAlignedStart + jitter : now >= last + cadence`; in-flight cap 5 stops firing; tenant with any in-flight dump skipped; retention applied with N from schedule.
- [ ] `index.ts`: 60s interval with re-entrancy guard; envs from `environments` where `status = 'READY'`, `tenantId is not null`, services JSON has enabled SWITCHBOARD; `fire` = create SCHEDULED row + Job (extract `createDumpAndJob` from the resolver into `dumps/service.ts` and reuse). Env `VETRA_BACKUP_SCHEDULER_ENABLED !== "false"`. Commit.

### Task 5: Tracked restore

**Files:** create `dumps/restore-repo.ts`, `dumps/restore.ts`; modify `db/migrations.ts`, `db/schema.ts`, `dumps/job-spec.ts`, `dumps/k8s-client.ts`, `dumps/resolvers.ts`, `schema.ts`, `index.ts`; tests `restore.test.ts`, `dumps-job-spec.test.ts`, `dumps-resolvers.test.ts`.

**Produces:**
- table `database_restores(id, documentId, tenantId, dumpId, safetyDumpId, status, jobName, replicas text /* JSON {deployment: n} */, errorMessage, requestedBy, requestedAt, completedAt)`; statuses `SAFETY_DUMP | STOPPING | RESTORING | STARTING | SUCCEEDED | FAILED`
- `buildRestoreJob({ restoreId, dumpId, tenantNs, image, bucket, s3Endpoint, s3AccessKey, s3SecretKey })` — label `vetra.io/kind=restore`, `vetra.io/restore-id`, NOT `vetra.io/dump-id`; PGHOST `${tenantNs}-pg-rw...`; script: download dump to /tmp, `{ echo "BEGIN;"; psql -Atc "<generate DROP SCHEMA … CASCADE for schemas owned by current_user except pg_* / information_schema>"; pg_restore --no-owner --no-acl -f - /tmp/d.dump; echo "COMMIT;"; } | psql -v ON_ERROR_STOP=1 -X -q`
- `DumpsK8sClient.scaleDeployment(ns, name, replicas)`, `readDeploymentReplicas(ns, selector): Promise<Record<string, number>>`, `countPods(ns, selector): Promise<number>`, `listRestoreJobs(): Promise<Array<{namespace,name,restoreId}>>`
- `advanceRestore(row, deps, now): Promise<void>` state machine (one step per tick)
- GraphQL `restoreEnvironmentDump(dumpId: ID!): DatabaseRestore!`, `environmentRestores(tenantId: String!): [DatabaseRestore!]!`

- [ ] Resolver tests: unauth/forbidden; dump of other tenant; dump not READY/expired → error; active restore exists → `RESTORE_IN_PROGRESS`; dump in flight → `DUMP_IN_PROGRESS`; success creates restore row SAFETY_DUMP + PRE_RESTORE dump.
- [ ] State machine tests: safety READY → records replicas, scales to 0, STOPPING; pods 0 → creates Job, RESTORING; Job complete → scale back, STARTING; Job failed → scale back, error kept; STARTING + ready pods → SUCCEEDED (or FAILED if job failed); safety FAILED → FAILED, no scaling; restart-resilience: a STOPPING row with replicas recorded is advanced by a fresh tick.
- [ ] Job spec test: PGHOST is `-pg-rw`, labels, ON_ERROR_STOP.
- [ ] Wire into dump watcher tick in `index.ts` (advance every non-terminal restore). Commit.

### Task 6: Frontend

**Files (vetra.io):** `modules/cloud/graphql.ts`, `modules/cloud/types.ts`, `modules/cloud/hooks/use-environment-dumps.ts`, `modules/cloud/components/{database-backups-tab.tsx,dump-row.tsx,backup-schedule-panel.tsx}`.

- [ ] `DUMP_FIELDS` back to include `source`; `RESTORE_SUPPORTED = true`; `restoreEnvironmentDump` returns restore; `fetchEnvironmentRestores`; hook polls restores every 5s while one is active and refetches dumps.
- [ ] Banner text per status: SAFETY_DUMP "Saving a safety backup…", STOPPING "Stopping Switchboard…", RESTORING "Restoring…", STARTING "Starting Switchboard…"; toast on SUCCEEDED/FAILED.
- [ ] Confirm dialog copy (spec Frontend section); `before restore` badge for PRE_RESTORE; schedule panel shows default Daily/7 when schedule is null; 24h copy → 30 days.
- [ ] `npm run tsc && npm run lint && npm run format:check`. Commit.

### Task 7: Rollout

- [ ] Bucket lifecycle 1 → 30 days (boto3 with the env-dumps creds; update `terraform/30-env-dumps/variables.tf` default + comments to match).
- [ ] vetra-cloud-package: full `vitest run`, `tsc`, lint; merge feature into `staging`, push → `x-staging.N` published; bump `tenants/staging/powerhouse-values.yaml` pins; ArgoCD sync.
- [ ] vetra.io → `staging`. Verify on a staging env: dump, write, restore, data reverted, safety dump listed, switchboard back; scheduler fires; Connect re-sync behaviour observed.
- [ ] Merge feature to vetra-cloud-package `main` (→ 0.0.81), bump `tenants/vetra` pins, vetra.io `main`; verify prod health + schema.
