# Studio ⇄ Environment grouping — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every deployed environment a durable `studioInstanceId` link to the studio that produced it, and render `/user/products` as studio group-headers with their environments nested underneath (PR #93's mock, wired to real data).

**Architecture:** `vetra-cli`'s deploy stamps `SET_STUDIO_INSTANCE(VETRA_ENVIRONMENT_ID)` onto the target env; the env doc-model gains an optional `studioInstanceId` field projected through the processor into the `environments` table; the observability subgraph exposes it (plus packages/services) on `myEnvironments`; vetra.io joins `myStudioProducts` × `myEnvironments` and groups by it. Mirrors `autoUpdateChannel` at every backend layer.

**Tech Stack:** Powerhouse document-model (ph-cli codegen), Kysely processor, GraphQL federation subgraph, Next.js 16 / React 19 / TanStack Query.

## Global Constraints

- Commit style: small incremental commits, NO Co-Authored-By / AI attribution trailer.
- Run `npm run format:check` (or repo equivalent) + lint + tsc before every push; CI "Lint and Types Checks" gates on prettier.
- `studioInstanceId` is nullable everywhere; `null`/absent = the studio itself or a user-created env. Frontend treats missing as `null`.
- New field must be read-tolerant: older subgraph without the field must not break the frontend.

---

## Phase 1 — `vetra-cloud-package` (repo: `../vetra-cloud-package`)

### Task 1: Add `studioInstanceId` field + `SET_STUDIO_INSTANCE` action to the doc-model, regenerate

**Files:**

- Modify: `document-models/vetra-cloud-environment/vetra-cloud-environment.json` (state schema string, initialValue, data_management operations)
- Regenerate: `document-models/vetra-cloud-environment/v1/gen/**`
- Modify: `document-models/vetra-cloud-environment/v1/schema.graphql` (kept in sync with the json)

- [ ] Add `studioInstanceId: OID` to the `VetraCloudEnvironmentState` type (after `runtimeConfig`) in both the `.json` `schema` string and `v1/schema.graphql`.
- [ ] Add `"studioInstanceId": null` to the `.json` `initialValue`.
- [ ] Add a `SET_STUDIO_INSTANCE` operation to the `data_management` module in the `.json`: `input SetStudioInstanceInput { studioInstanceId: OID }`, reducer stub `state.studioInstanceId = action.input.studioInstanceId ?? null;`.
- [ ] Run `npm run generate` (ph-cli generate). Expected: `gen/` updates with `SetStudioInstanceInput`, `setStudioInstance` creator, `SET_STUDIO_INSTANCE` action type.
- [ ] Commit: `feat: add studioInstanceId field + SET_STUDIO_INSTANCE action`

### Task 2: Implement + test the reducer

**Files:**

- Modify: `document-models/vetra-cloud-environment/v1/src/reducers/data-management.ts`
- Test: `document-models/vetra-cloud-environment/v1/tests/data-management.test.ts`

- [ ] Write failing tests mirroring the `apexService` cases: sets `studioInstanceId` when owner signs; clears on null; owner-gated (non-owner throws).
- [ ] Run the test file; expect FAIL (operation not implemented / returns undefined).
- [ ] Implement `setStudioInstanceOperation(state, action) { assertOwner(state, action); state.studioInstanceId = action.input.studioInstanceId ?? null; }`. No `markPendingIfDeployed` (metadata only — verify `gitops.ts` never reads the field).
- [ ] Run tests; expect PASS.
- [ ] Commit: `feat: SET_STUDIO_INSTANCE reducer`

### Task 3: Processor — project `studioInstanceId` into the `environments` table

**Files:**

- Modify: `processors/vetra-cloud-environment/migrations.ts` (add column)
- Modify: `processors/vetra-cloud-environment/schema.ts` (row type)
- Modify: `processors/vetra-cloud-environment/index.ts` (destructure + row)
- Test: `processors/vetra-cloud-environment/e2e.test.ts` (or the projection test)

- [ ] Add a migration step: `.alterTable("environments").addColumn("studioInstanceId", "varchar(255)")` (mirror the `autoUpdateChannel` add).
- [ ] Add `studioInstanceId: string | null` to the row type in `schema.ts`.
- [ ] In `index.ts`, destructure `studioInstanceId` from `state` and add `studioInstanceId: studioInstanceId ?? null` to `row`.
- [ ] Write/extend a projection test asserting a `SET_STUDIO_INSTANCE`'d env yields the column value.
- [ ] Run processor tests; expect PASS.
- [ ] Commit: `feat: project studioInstanceId into environments table`

### Task 4: Subgraph — expose `studioInstanceId` + packages/services on `myEnvironments`

**Files:**

- Modify: `subgraphs/vetra-cloud-observability/schema.ts` (`VetraCloudEnvironmentSummary`)
- Modify: `subgraphs/vetra-cloud-observability/resolvers.ts` (`myEnvironments` select + shape)
- Test: `subgraphs/vetra-cloud-observability/__tests__/*` (add a myEnvironments test)

- [ ] Add to `VetraCloudEnvironmentSummary`: `studioInstanceId: String`, `packages: [VetraCloudPackage!]`, `serviceTypes: [String!]` (enough to render "N packages" + "CONNECT, SWITCHBOARD"). Reuse/define the `VetraCloudPackage` type in this schema if not present.
- [ ] In `myEnvironments`, add `studioInstanceId`, `packages`, `services` to the `.select([...])`; parse `packages`/`services` (stored as text JSON, like `myStudioProducts` does via `parseEnvPackages`/`parseEnvStudioServices`) into the response shape.
- [ ] Write a resolver test asserting the new fields appear for an owned env.
- [ ] Run subgraph tests; expect PASS.
- [ ] Commit: `feat: expose studioInstanceId + packages/services on myEnvironments`

### Task 5: Build, version-bump, publish a dev build

- [ ] Run the full package build + typecheck + tests.
- [ ] Bump version (dev channel) and publish so `vetra-cli` and `vetra.io` can consume the regenerated types / new field. (Follow repo's existing dev-publish flow.)
- [ ] Commit any version/lockfile changes.

---

## Phase 2 — `vetra-cli` (repo: `../vetra-cli`)

### Task 6: Stamp `setStudioInstance` at deploy

**Files:**

- Modify: `vetra-app/editors/vetra-studio/deploy/deployProject.ts`
- Modify: `package.json` (bump `@powerhousedao/vetra-cloud-package` to the Phase 1 dev version)
- Test: `vetra-app/editors/vetra-studio/deploy/*.test.ts` (or nearest deploy test)

- [ ] Bump the `@powerhousedao/vetra-cloud-package` dependency; install.
- [ ] Read the studio env id once: `const studioEnvId = process.env.VETRA_ENVIRONMENT_ID?.trim() || null`.
- [ ] In the **new env** branch: after `applyCreateEnvironment(...)`, before `addPackage`, if `studioEnvId` call `controller.setStudioInstance({ studioInstanceId: studioEnvId })`.
- [ ] In the **existing env** branch: alongside the `addPackage`/`setPackageVersion`, if `studioEnvId` and the env's current `studioInstanceId !== studioEnvId`, call `controller.setStudioInstance({ studioInstanceId: studioEnvId })`.
- [ ] Write a unit test: with `VETRA_ENVIRONMENT_ID` set, `deployProject` calls `setStudioInstance` (both branches); with it unset, it does not.
- [ ] Run tests + typecheck; expect PASS.
- [ ] Commit: `feat: stamp studioInstanceId on deploy from a studio`

---

## Phase 3 — `vetra.io` (repo: `.`)

### Task 7: Types + query carry `studioInstanceId` / packages / services

**Files:**

- Modify: `modules/cloud/types.ts` (`CloudEnvironmentState`)
- Modify: `modules/cloud/graphql.ts` (`EnvironmentSummary`, `fetchMyEnvironments` query)
- Modify: `modules/cloud/hooks/use-environment.ts` (`summaryToCloudEnvironment`)

- [ ] Add `studioInstanceId?: string | null` to `CloudEnvironmentState`.
- [ ] Add `studioInstanceId`, `packages`, `serviceTypes` to `EnvironmentSummary` and the `myEnvironments` GraphQL selection.
- [ ] In `summaryToCloudEnvironment`, populate `studioInstanceId`, `packages` (map to `CloudPackage`), and `services` (map `serviceTypes` → `{ type, enabled: true }` minimal shape used by the card's type list + count). Treat missing fields as empty/null.
- [ ] `npm run tsc`; expect clean.
- [ ] Commit: `feat: carry studioInstanceId + packages/services through env list`

### Task 8: Grouping hook

**Files:**

- Create: `modules/cloud/studio/use-studio-groups.ts`
- Test: `modules/cloud/__tests__/use-studio-groups.test.ts` (pure grouping fn)

- [ ] Extract a pure `groupStudioEnvironments(studios, envs)` → `{ groups: {studio, environments}[], standalone: CloudEnvironment[] }`: env belongs to a group when `env.state.studioInstanceId === studio.envId`; standalone = `studioInstanceId == null` AND id not in the studio set; studio envs themselves are never cards.
- [ ] Write failing unit tests: two studios each with envs; an unstamped env → standalone; a studio env excluded from cards.
- [ ] Implement the pure fn; run tests → PASS.
- [ ] Wrap in a `useStudioGroups()` hook combining `useStudioProducts()` + `useEnvironments()` (both already cached/WS-fresh; no new polling).
- [ ] Commit: `feat: studio-environment grouping hook`

### Task 9: Real grouped layout (port the preview components)

**Files:**

- Create: `modules/cloud/studio/components/studio-group.tsx`, `studio-group-header.tsx` (ported off mock types onto `StudioProduct` + brand)
- Modify: `app/user/environments/cloud-projects.tsx` (export `CloudEnvironmentCard` + `STATUS_LABELS`; add `sleeping`→"Hibernating")
- Create: `modules/cloud/studio/components/studio-groups-view.tsx` (composes groups + "Other environments" + bottom actions)
- Modify: `app/user/products/page.tsx` (render the grouped view behind `EarlyAccessGate`)

- [ ] Export `CloudEnvironmentCard` and `STATUS_LABELS` from `cloud-projects.tsx`; add a `sleeping`/hibernating label + moon treatment.
- [ ] `studio-group-header.tsx`: real studio header using `use-product-brand` for title/tagline, `myStudioProducts.status` for the pill, `buildStudioEmbedUrl` for the open-studio link, collapse caret, ⋮ menu (open-studio for now).
- [ ] `studio-group.tsx`: header + collapsible grid of real `CloudEnvironmentCard`s + a "New environment…" tile linking to `/user/environments/new`.
- [ ] `studio-groups-view.tsx`: map groups; "Other environments" grid of standalone cards; bottom "New environment" / "New Vetra Studio" actions (reuse existing create flows). Skeleton on first scan; empty state.
- [ ] Point `app/user/products/page.tsx` at `studio-groups-view`.
- [ ] `npm run tsc` + lint + format:check; expect clean.
- [ ] Commit: `feat: studio group-header environments layout on /user/products`

### Task 10: Cleanup + verification

**Files:**

- Delete: `modules/cloud/studio/preview/**`, `app/user/products/preview/page.tsx` (mock superseded)
- Modify: any leftover imports

- [ ] Remove the PR #93 mock preview files (now superseded by the real layout).
- [ ] Run full `npm run tsc`, lint, format:check, and `npm test` for touched modules; expect clean/PASS.
- [ ] Commit: `chore: remove studio-group mock preview (superseded by real layout)`

---

## Merge order

1. `vetra-cloud-package`: merge Phase 1 to its `main`, publish dev version.
2. `vetra-cli`: merge Phase 2 to its `main` (depends on the published version).
3. `vetra.io`: PR `feat-studio-environment-grouping` → `staging`; merge. Observe deploy on `staging.vetra.io/health`.

Frontend is safe to ship before stamps exist — all envs simply appear under "Other environments" until deploys populate `studioInstanceId`.
