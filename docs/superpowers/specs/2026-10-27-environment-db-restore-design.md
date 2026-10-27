# Self-service database restore for environments

**Status:** approved 2026-10-27
**Date:** 2026-10-27
**Repos:** `vetra-cloud-package` (backend), `vetra.io` (frontend), `powerhouse-k8s-hosting` (bucket lifecycle + version pins)

## Intent

An environment owner whose data has gone wrong (bad migration, buggy package,
deleted documents) can roll their environment's Postgres back to an earlier
backup from vetra.io, without asking us to do it with kubectl. Both Frank's
boss and liberuum asked for this.

Today an owner can create a dump and download it (Switchboard service →
Database → Backups), but:

- there is no restore — the Restore button is hidden (`RESTORE_SUPPORTED =
  false` in `modules/cloud/components/database-backups-tab.tsx`) because the
  `restoreEnvironmentDump` mutation was never deployed;
- dumps expire after 24h, so an owner almost never has a restore point when
  something breaks;
- there are no automatic dumps.

The platform's CNPG backups (nightly base backup + WAL, 180d) remain our
operator-only safety net and are **not** part of this feature.

## Goals

1. Owner can restore their environment's database from any READY dump in the list.
2. Restore points exist without the owner remembering: **scheduled dumps**
   (the existing Backup schedule panel — Off / Hourly / Daily / Weekly + retention
   count) actually run.
3. Dumps live long enough to be useful restore points (count-based retention,
   30-day ceiling) instead of 24h.
4. Every restore first takes an automatic **safety dump** of the current data,
   so a wrong restore can itself be undone.
5. A restore is either fully applied or not applied at all — never a
   half-restored database.

## Non-goals

- Self-service point-in-time recovery from the CNPG backups.
- Uploading your own dump file, restoring into a different environment, or
  partial (table-level) restore.
- The database explorer, environment reset and other features that sit on
  the same stale branch (see Source material).
- Free-form cron schedules.

## Anti-goals (failure even if it "works")

- A failed restore leaves the database partially restored.
- Anyone other than the environment owner can trigger a restore (or schedule changes).
- Data is overwritten without a safety copy having been taken first.
- Existing create / download / cancel dump behaviour regresses.
- Turning this on stampedes the cluster with ~75 simultaneous `pg_dump` jobs.

## Source material

Most of the backend was written in May on `vetra-cloud-package`
`origin/fix/clint-pullpolicy-always-in-processor` (34 commits never merged;
`main` is ~730 commits ahead). Relevant commits, to port onto current `main`
(cherry-pick where it applies, re-implement where `main` has moved):

| Area | Commits |
|---|---|
| Restore job + resolver | `6717cf0` buildRestoreJob, `b1fdcdb` listRestoreJobsInNamespace, `9eb0907` restoreEnvironmentDump resolver + schema, `2bee000` fail-closed concurrency gate, `625a7b6` label tightening |
| Schedule | `fc47257` SET_BACKUP_SCHEDULE doc-model action, `6a4e48c` dump `source` column + enum, `1624e05` createDumpAndJob helper, `4ea90c7` scheduled backups runner, `283ea28` re-entrancy guard |

**Do not port:** `1de710a` (clint pullPolicy), explorer (`8d62aa9`…`6c9ae27`),
reset (`99739af`…`4d4fc37`), version bumps, codegen noise (`c465a36`).
`main` already has its own `restart.ts` (`restartEnvironmentService`) — use it.

The vetra.io frontend for all of this is already on `main`: `BackupSchedulePanel`,
`setBackupSchedule` in `use-environment-detail.ts` (feature-tested, renders
"coming soon" when the controller lacks the action), the `auto` badge in
`DumpRow`, the restore confirm dialog, `restoreEnvironmentDump` in
`modules/cloud/graphql.ts`. `source` was removed from `DUMP_FIELDS` on
2026-10-27 (`62ef305`) because prod didn't have it; add it back once deployed.

## Design decisions

### Dump sources and retention

- `database_dumps` gains `source`: `MANUAL | SCHEDULED | PRE_RESTORE`
  (migration; existing rows → `MANUAL`). Exposed on the `DatabaseDump` GraphQL type.
- Retention is per environment, per source, count-based; deleting a dump
  deletes **both the S3 object and the row**:
  - `MANUAL`: keep newest 5
  - `SCHEDULED`: keep newest *N*, N = schedule retention (1–30, default 7)
  - `PRE_RESTORE`: keep newest 3
- Hard ceiling: `expiresAt = requestedAt + 30 days` for every source, enforced
  by the existing resolver expiry check **and** the bucket lifecycle rule,
  which moves from 1 to 30 days (`powerhouse-k8s-hosting/terraform/30-env-dumps`,
  `expiration_days`; follow the `ignore_changes` dance documented in `bucket.tf`).
- Note the branch runner deletes only rows; that's a bug to fix while porting.
- The existing 7-day row pruner must not delete rows younger than their `expiresAt`.

### Scheduled dumps

- Doc model: `backupSchedule { enabled, cadence: HOURLY|DAILY|WEEKLY, retention }`
  on `VetraCloudEnvironmentState`, set via `SET_BACKUP_SCHEDULE` (owner only).
  Field names must match what vetra.io already reads
  (`modules/cloud/types.ts` `BackupSchedule`).
- Default for environments with no schedule set: **on, Daily, keep 7**
  (see Resolved 1). The panel shows that effective default.
- Runner (from `4ea90c7`): ticks every minute in the observability subgraph,
  fires a `SCHEDULED` dump when `now >= lastScheduled + cadence`, applies
  retention. Must not stampede: cap concurrently running scheduled dump Jobs
  across the cluster (suggested 5) and spread first runs (e.g. jitter by a
  hash of tenantId) so a deploy doesn't fire every environment at once.
- Skip environments that are stopped/hibernated (no DB to dump) without
  recording failures for them.

### Restore flow

`restoreEnvironmentDump(dumpId)` becomes a **tracked, multi-step operation**
(the branch version was fire-and-forget):

1. Validate: caller authorized the same way as dumps today (`authorizeDump`
   in `dumps/auth.ts` — owner, or org OWNER/ADMIN; there is no `requireOwner`
   on `main`), dump exists, READY, not expired, belongs to this environment,
   no other active restore for the tenant (fail closed).
2. Create a `database_restores` row (`id, documentId, tenantId, dumpId,
   safetyDumpId, status, errorMessage, requestedBy, requestedAt, completedAt`)
   and fire a `PRE_RESTORE` safety dump. Status `SAFETY_DUMP`.
3. Watcher: safety dump READY → **stop the writers**: scale the Switchboard
   deployment (and anything else writing to the tenant DB) to 0, status
   `STOPPING`; once no pods remain, create the restore Job, status `RESTORING`.
   Safety dump FAILED/cancelled → restore `FAILED`, database untouched,
   nothing stopped. *(My call, from the builder check: if the Switchboard
   keeps running, writes blocked on the restore's locks go through after
   commit, carrying operations from the abandoned timeline into the restored
   DB. Record the original replica counts on the restore row so a crashed
   backend can always scale back up; verify ArgoCD self-heal doesn't fight the
   scale-down, and if it does, pause sync for that app during the restore.)*
4. Restore Job:
   - in one transaction: drop every non-system schema the app role owns
     (so objects created *after* the dump don't survive into a mixed state),
     then stream the dump from S3 into
     `pg_restore --no-owner --no-acl --single-transaction --exit-on-error`.
     All-or-nothing, and restoring the safety dump returns exactly to the
     pre-restore state. *(My call. The builder picks the mechanics, e.g. a
     generated SQL prelude, or running pg_restore to a script and piping both
     through one `psql --single-transaction`.)*
   - connects **directly to the CNPG primary** (`<cluster>-rw` service, e.g.
     `${tenantNs}-pg-rw`), **not** the PgBouncer pooler: every tenant runs the
     pooler in `transaction` mode, which drops the session settings
     (`search_path`, etc.) `pg_restore` relies on. The CNPG instance network
     policy already admits in-cluster traffic.
5. Restore Job finished (either way) → scale writers back to their recorded
   replica counts, status `STARTING`; once Switchboard is ready → `SUCCEEDED`,
   or `FAILED` with the last log line if the Job failed (the DB is then
   unchanged, thanks to the single transaction).
6. New query `environmentRestores(tenantId)` (owner-gated, newest first,
   last ~10) so the UI can show progress and outcome.

The Switchboard is offline for the whole restore (safety dump excluded):
stop → restore → start.

**Scope: database only** *(my call)*. Restore does not change the
environment's packages or config. If a package update caused the damage,
the owner must roll the package back first, or the restarted Switchboard
will run the same migration again. The confirm dialog says so.

### Frontend (vetra.io)

- Set `RESTORE_SUPPORTED = true`; add `source` back to `DUMP_FIELDS`.
- Restore banner driven by `environmentRestores` (poll while active): "Saving
  a safety backup…" → "Stopping Switchboard…" → "Restoring…" → "Starting
  Switchboard…" → success / failure toast. Replaces the current
  mutation-in-flight-only banner.
- Confirm dialog: say a safety backup is taken first, everything written after
  the chosen dump is replaced, the Switchboard is offline during the restore,
  and packages/config are not rolled back.
- Badges in `DumpRow`: `auto` for SCHEDULED, `before restore` for PRE_RESTORE.
- Copy: dumps kept up to 30 days / per retention, not 24h.
- Schedule panel goes live once the controller exposes `setBackupSchedule`
  (already feature-tested).

### Rollout

1. Bucket lifecycle 1 → 30 days (Terraform).
2. `vetra-cloud-package` feature branch off `main` → PR → merge to `main`
   (push publishes to npm).
3. Bump `PH_REGISTRY_PACKAGES` pin for the **staging** tenant in
   `powerhouse-k8s-hosting/tenants/staging/powerhouse-values.yaml`; ArgoCD syncs.
4. vetra.io → `staging`; verify end to end on a staging environment
   (create dump, write data, restore, confirm data reverted, safety dump present,
   schedule fires, retention deletes S3 objects).
5. Bump the prod pin, vetra.io → `main`.

## Left to the builder

- Port strategy per commit (cherry-pick vs re-implement) and conflict resolution.
- Exact table/column names beyond the ones fixed above, and migration mechanics
  (subgraph DBs are `withSchema` namespaces — raw SQL must be schema-qualified).
- Polling intervals, jitter function, concurrency-cap mechanics.
- Test layout (follow the existing `__tests__` patterns with PGlite + stubs).
- Stopped/hibernated-environment detection for the runner.
- Version jump on the staging pin (staging is on `0.0.65-staging.15`, `main`
  at `0.0.80`): check the changelog for anything else that lands with it.
- `TTL_HOURS` / `pruneOlderThan` in `dumps/repo.ts` are where the 24h and
  7-day limits live today.

## Resolved after builder check (2026-10-27)

1. **Default schedule: on — Daily, keep 7 — for every environment with no
   schedule set** *(my call; Frank said "lfg" without picking, and it serves
   goal 2)*. The cluster-wide concurrency cap and first-run jitter are
   therefore launch requirements, not nice-to-haves. The runner should avoid
   fetching every environment document every minute (e.g. cache schedules and
   refresh on a slower interval, or project `backupSchedule` in the processor).
2. **Sync push-back: verify on staging** *(my call)*. Restore an environment,
   then reconnect a Connect client that still holds the newer operations and
   observe. If ops are pushed back, the confirm dialog and success toast tell
   owners to clear/reload their Connect clients; real mitigation (rotating
   sync identifiers) becomes a follow-up, not part of this work.
