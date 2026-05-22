# Environment Reset + Service Restart

**Status:** ready
**Date:** 2026-05-12
**Driver:** liberuum hit a broken state on `mild-dove-63.vetra.io` and asked
for a way to "nuke the db" without deleting the env, plus a "restart" for an
individual service when switchboard hangs on a failed op. Two small,
adjacent features.

## Problem

Today the only knobs in the env settings drawer's Danger Zone are
**Terminate** (begin teardown) and **Delete** (permanently destroy the doc).
Neither helps an owner who wants to keep their env definition, packages,
secrets, and dump history intact while resetting the application data.

Service drawers expose Logs / Events / Config / Database but no way to
restart a single service when it's stuck — owners currently have to
`kubectl delete pod` themselves, which most don't have access to do.

## Goal

Two new owner-gated mutations and matching UI:

1. **Reset Environment** — TRUNCATE every user-schema base table in the
   tenant's Postgres, then roll-restart every tenant app deployment so
   pods come back with empty in-memory caches against an empty DB.
2. **Restart Service** — roll-restart one specific service's deployment
   without touching the DB.

Both reuse the Phase B/D infrastructure: same owner-check, same
`getTenantPool` helper, same `<tenantNs>-pg-pooler` connect path.

## Non-goals

- Dropping or recreating the database (CNPG cluster stays as-is).
- Wiping env vars, secrets, dump history, or scheduled-backup config.
- Resetting non-Postgres state (S3 dumps, OpenBao secrets, etc.).
- Touching the CNPG `cluster` / `pooler` pods (they stay up).
- Per-document RBAC UI — that ask deferred to a separate spec
  (`auth-config-design.md`, brainstormed in a fresh session).
- Scheduling reset / restart — fire-and-forget only.
- Restart confirmation for the same service if a rollout is already in
  progress — k8s handles that idempotently (the new annotation timestamp
  just supersedes the previous one).

---

## Components

### Backend — `vetra-cloud-package`, branch `fix/clint-pullpolicy-always-in-processor`

#### New directory: `subgraphs/vetra-cloud-observability/reset/`

**`reset/service.ts`** — pure functions, no I/O wiring inside:

```ts
export async function truncateUserTables(pool: pg.Pool): Promise<number>
export async function restartAppDeployments(
  k8s: TenantK8sClient,
  namespace: string,
): Promise<{ restarted: number; failed: Array<{ name: string; error: string }> }>
export async function restartSingleService(
  k8s: TenantK8sClient,
  namespace: string,
  service: 'CONNECT' | 'SWITCHBOARD' | 'CLINT' | 'FUSION',
): Promise<string> // returns the deployment name that was patched
```

`truncateUserTables`:

1. Query `information_schema.tables` for rows where
   `table_schema NOT IN ('pg_catalog', 'information_schema')` AND
   `table_schema NOT LIKE 'pg_temp_%'` AND `table_type = 'BASE TABLE'`.
2. If zero tables: return 0, no-op.
3. Build a single `TRUNCATE TABLE "schema"."name", ... RESTART IDENTITY CASCADE`.
4. Wrap in `BEGIN; ...; COMMIT;` so on failure nothing is partially truncated.
5. Return count of tables truncated.

`restartAppDeployments` lists deployments labelled
`app.kubernetes.io/component in (connect, switchboard, clint, fusion)`.
(The `part-of` label is NOT used as a selector because clint deployments
ship with `part-of=clint` in the current chart, not `part-of=vetra-tenant`
— matching by `component` alone is sufficient and more robust against
chart drift.) Per-deployment errors are collected and returned, not
thrown — caller decides how to surface them.

`restartSingleService` finds the deployment by:

- `app.kubernetes.io/component = <lower(service)>` for CONNECT, SWITCHBOARD, FUSION
- `app.kubernetes.io/component = clint AND clint.vetra.io/agent = <agentPrefix>` when service=CLINT

Throws `DEPLOYMENT_NOT_FOUND` if zero matches; throws `AMBIGUOUS_SERVICE`
if more than one (e.g. CLINT without `agentPrefix` and multiple clint
agents exist).

#### New k8s client methods (extend the existing client in `dumps/k8s-client.ts`)

```ts
listAppDeployments(namespace: string): Promise<Array<{ name: string; component: string }>>
patchDeploymentRestart(namespace: string, name: string): Promise<void>
```

`patchDeploymentRestart` issues a JSON merge patch:

```json
{
  "spec": {
    "template": {
      "metadata": {
        "annotations": {
          "kubectl.kubernetes.io/restartedAt": "<ISO-now>"
        }
      }
    }
  }
}
```

This is exactly what `kubectl rollout restart deploy/<name>` produces —
the Deployment controller treats it as a pod-template change and triggers
a rolling update.

#### Schema additions — `subgraphs/vetra-cloud-observability/schema.ts`

```graphql
extend type Mutation {
  """
  Owner-gated. TRUNCATE every user-schema base table in the tenant's
  Postgres (CASCADE + RESTART IDENTITY), then patch every tenant app
  deployment with a kubectl rollout-restart annotation. Returns the
  counts plus, when applicable, a partial-success message naming
  deployments that failed to patch.

  Errors: UNAUTHENTICATED, FORBIDDEN, ENV_NOT_FOUND, TRUNCATE_FAILED.
  RESTART_PARTIAL is NOT an error — it is a successful ResetAck with
  a non-null message and deploymentsRestarted < the number of matched
  deployments.
  """
  resetEnvironment(tenantId: String!): ResetAck!

  """
  Owner-gated. Patch one deployment's pod template with the rollout-
  restart annotation. For CLINT services the optional agentPrefix
  argument disambiguates which clint deployment to restart (each agent
  prefix produces its own Deployment via the chart).

  Errors: UNAUTHENTICATED, FORBIDDEN, ENV_NOT_FOUND, DEPLOYMENT_NOT_FOUND,
  AMBIGUOUS_SERVICE.
  """
  restartEnvironmentService(
    tenantId: String!
    service: TenantService!
    agentPrefix: String
  ): RestartAck!
}

type ResetAck {
  ok: Boolean!
  tablesCleared: Int!
  deploymentsRestarted: Int!
  """
  Human-readable note when partial-success — null on full success.
  """
  message: String
}

type RestartAck {
  ok: Boolean!
  deploymentName: String!
  message: String
}
```

If `TenantService` doesn't currently include `CLINT` / `FUSION`, extend
the enum so the restart mutation can target those.

#### Resolver wiring — `subgraphs/vetra-cloud-observability/dumps/resolvers.ts` (or a new sibling file)

Same shape as `restoreEnvironmentDump`:

```ts
resetEnvironment: async (_p, { tenantId }, ctx) => {
  const env = await loadEnv(envDb, tenantId)
  requireOwner({ caller: ctx.user?.address ?? null, envOwner: env?.owner ?? null })
  if (!env) throw new Error('ENV_NOT_FOUND')

  const pool = await getTenantPool(tenantId)
  let tablesCleared: number
  try {
    tablesCleared = await truncateUserTables(pool)
  } catch (err) {
    throw new Error('TRUNCATE_FAILED: ' + (err instanceof Error ? err.message : String(err)))
  }

  const { restarted, failed } = await restartAppDeployments(k8s, tenantId)
  return {
    ok: true,
    tablesCleared,
    deploymentsRestarted: restarted,
    message: failed.length
      ? `RESTART_PARTIAL: ${failed.length} deployment(s) failed: ${failed.map((f) => f.name).join(', ')}`
      : null,
  }
}

restartEnvironmentService: async (_p, { tenantId, service }, ctx) => {
  const env = await loadEnv(envDb, tenantId)
  requireOwner({ caller: ctx.user?.address ?? null, envOwner: env?.owner ?? null })
  if (!env) throw new Error('ENV_NOT_FOUND')

  const deploymentName = await restartSingleService(k8s, tenantId, service)
  return { ok: true, deploymentName, message: null }
}
```

Configuration fallback: `resetEnvironment` depends on the explorer's
`getTenantPool` (DB connect) AND on the k8s client (deployment patches);
when either isn't configured in the subgraph runtime, the resolver
throws `RESET_NOT_CONFIGURED`. `restartEnvironmentService` only needs
the k8s client; it throws `RESTART_NOT_CONFIGURED` when that isn't
configured. Frontend maps both codes to a single friendly toast: "Reset
isn't available for this environment."

#### Version bump

`package.json` → `0.0.3-dev.80` (`.79` is the last published).

### Frontend — `vetra.to`, branch `staging`

#### `modules/cloud/graphql.ts`

```ts
export async function resetEnvironment(
  tenantId: string,
  token?: string | null,
): Promise<{
  ok: boolean
  tablesCleared: number
  deploymentsRestarted: number
  message: string | null
}>

export async function restartEnvironmentService(
  tenantId: string,
  service: 'CONNECT' | 'SWITCHBOARD' | 'CLINT' | 'FUSION',
  token?: string | null,
): Promise<{ ok: boolean; deploymentName: string; message: string | null }>
```

#### `modules/cloud/components/env-settings-drawer.tsx` — Danger Zone gains a Reset row

Insert **above** the Terminate row (less destructive ordering: Reset →
Terminate → Delete). New copy:

```
Reset environment
Wipe all database rows and restart every service. Packages, env vars,
secrets, and dump history are preserved.

[Reset]  → AlertDialog: "Reset {name}? All database rows will be deleted.
                          This cannot be undone, but you can restore from
                          a recent dump if one exists."
```

Implementation mirrors the existing Delete confirm — AlertDialog
trigger + AsyncButton in the footer with `pendingLabel="Resetting…"`,
`e.preventDefault()` on the action so the dialog stays open on error.
On success: toast "Environment reset — {N} tables cleared, {M} services
restarting…"; if `message` includes `RESTART_PARTIAL`, toast.warning
with the message tail.

#### `modules/cloud/components/service-detail-drawer.tsx` — Restart button

Add to the drawer header button row (alongside the existing close
button). Uses `<RotateCw>` icon and "Restart" label. Visible only when
`canEdit` is true. AlertDialog confirms; AsyncButton runs the mutation;
success toast names the service.

If the service is not yet deployed (no matching component in the env
state, or the env is in PROVISIONING/CHANGES_PENDING), the button is
disabled with a tooltip "Restart available once the service is running."

---

## Data flow

```
Reset:
  User clicks "Reset environment" in Danger Zone
    AlertDialog opens, confirm
    AsyncButton: e.preventDefault(); await onClickAsync
      resetEnvironment(tenantId, token)
        Subgraph: requireOwner → getTenantPool(tenantId)
        BEGIN; TRUNCATE TABLE "<schema>"."<name>", ... RESTART IDENTITY CASCADE; COMMIT
        tablesCleared = N
        listAppDeployments(tenantId) → [{name, component}]
        for each deployment: patchDeploymentRestart(tenantId, name)
        return { ok, tablesCleared, deploymentsRestarted, message }
    setConfirmOpen(false)
    toast.success("Environment reset — {N} tables, {M} services restarting…")

Restart:
  User clicks "Restart" in service drawer header
    AlertDialog: "Restart {service}?"
    Confirm → AsyncButton
      restartEnvironmentService(tenantId, service, token)
        Subgraph: requireOwner → restartSingleService(k8s, ns, service)
        patchDeploymentRestart(ns, deploymentName)
        return { ok, deploymentName }
    toast.success("{service} restarting…")
```

---

## Edge cases

- **Empty DB** — `truncateUserTables` returns 0 and the response is
  `{ ok: true, tablesCleared: 0, deploymentsRestarted: M, message: null }`.
  UI toast adapts: "No data to clear. Restarted {M} service(s)."
- **No app deployments** (env still in PROVISIONING) — `restartAppDeployments`
  returns `{ restarted: 0, failed: [] }`. UI shows
  "Database cleared. No services to restart yet."
- **Some deployment patches fail** (e.g. one was deleted mid-flight) —
  resolver returns ok=true with `RESTART_PARTIAL` in `message`. Toast
  uses warning variant.
- **TRUNCATE fails** (e.g. another transaction holding a long lock,
  permission error) — resolver throws `TRUNCATE_FAILED`. UI toast.error,
  pods untouched. Re-run is safe (idempotent).
- **Caller loses ownership mid-call** — race with `setOwner` is impossible
  in practice because requireOwner is the first check; if it later
  changes, the action that's already firing finishes. Acceptable.
- **Multiple deployments with same component label** (shouldn't happen
  given the chart) — restartSingleService throws `DEPLOYMENT_NOT_FOUND`
  citing the ambiguous match. Hardening the chart is out of scope.
- **Restart on a service currently rolling out** — k8s treats the
  annotation patch idempotently. New `restartedAt` supersedes the prior.
  The user just sees a fresh rollout start.

---

## Verification

### Reset

1. Owner of an env with data: click Reset → confirm → toast
   "Environment reset — N tables, M services restarting…".
2. Watch the Activity / Pods view: switchboard / connect / clint
   pods enter `Pending` → `Running` within ~30s.
3. Re-open the env: dump history present, packages list intact, env
   vars and secrets unchanged.
4. Non-owner: Reset button hidden in the Danger Zone (or disabled
   with tooltip). Subgraph also returns FORBIDDEN as defence in depth.
5. Empty env (no data yet): toast "No data to clear. Restarted M services."
6. Force a partial: temporarily set a deployment's selector to a
   non-existent label; Reset returns ok=true + RESTART_PARTIAL warning.

### Restart

1. Owner clicks Restart in switchboard drawer → confirm → toast
   "switchboard restarting…". Pods cycle within seconds.
2. Restart on FUSION when FUSION isn't enabled in this env → button
   disabled with tooltip.
3. Restart on a service that's in PROVISIONING (no deployment yet) →
   `DEPLOYMENT_NOT_FOUND` toast.
4. `pnpm tsc` + `pnpm lint` clean on both repos.

---

## Backend dependencies

| Requirement                                                                             | Blocks go-live                                                             |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `getTenantPool(tenantId)` helper from the explorer package                              | already shipped (Phase D)                                                  |
| `<tenantNs>-pg-pooler.<tenantNs>.svc.cluster.local:5432` reachable from switchboard pod | already configured (Phase D Cilium fix)                                    |
| ClusterRole grants `apps/deployments get/list/patch` on tenant namespaces               | check current `vetra-observability-reader` ClusterRole — extend if missing |
| `TenantService` GraphQL enum already covers CLINT + FUSION (or extend it)               | minor schema change                                                        |

---

## Implementation order (small commits, no Co-Authored-By)

### Backend

1. `feat(reset): truncateUserTables service helper + tests`
2. `feat(reset): restartAppDeployments + restartSingleService + tests`
3. `feat(k8s): patchDeploymentRestart + listAppDeployments on tenant k8s client`
4. `feat(reset): resetEnvironment + restartEnvironmentService resolvers + schema`
5. `chore: extend TenantService enum with CLINT, FUSION if missing`
6. `chore(deps): bump version to 0.0.3-dev.80`

If `vetra-observability-reader` ClusterRole lacks `apps/deployments patch`,
extend it in `powerhouse-k8s-hosting` (separate commit on that repo).

### Frontend

1. `feat(cloud): resetEnvironment + restartEnvironmentService graphql helpers`
2. `feat(cloud): Danger Zone "Reset environment" row above Terminate`
3. `feat(cloud): "Restart" button in service detail drawer header`

### Gitops

1. Bump staging `PH_REGISTRY_PACKAGES` to `0.0.3-dev.80` once the package
   is published.

Each commit is independently compilable. Feature is user-invisible until
all of these are deployed end-to-end.
