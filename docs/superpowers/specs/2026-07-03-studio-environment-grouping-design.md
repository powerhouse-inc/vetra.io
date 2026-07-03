# Studio ⇄ Environment grouping — design

**Date:** 2026-07-03
**Status:** approved for planning
**Repos touched:** `vetra-cloud-package`, `vetra-cli`, `vetra.io`

## Goal

Turn PR #93's mock-driven ideation (`/user/products/preview`) into a real,
backend-wired page. Each **Vetra Studio** renders as a full-width managed-infra
header (product identity from its BrandSheet) with the **environments it
deployed to** nested underneath, plus a header-less **"Other environments"**
section for envs not produced by any studio.

The layout is locked to the PR #93 mockup: group header (caret, "Managed" chip,
status pill, ⋮ menu, click-to-open-studio) → grid of environment cards + a "New
environment…" tile → "Other environments" grid → bottom "New environment" /
"New Vetra Studio" actions. We reuse the **real** `CloudEnvironmentCard`
(Manage / Visit / Delete), status treatment, and brand fetch that already
produce this look.

## The real mechanism (what the mock fakes)

Traced through the working deploy flow:

- A **studio** is a `VetraCloudEnvironment` running the `vetra-cli` CLINT agent.
  `findStudioAgents` / the subgraph's `myStudioProducts` already surface these,
  status-resolved. Product identity (name / maxim / concept) comes from each
  studio's own **BrandSheet**, fetched client-side via `use-product-brand`
  (gated on `ready`).
- Inside a studio you build a **project** → a **package**. Deploying
  (`vetra-cli` `deployProject`) publishes that package and calls
  `controller.addPackage({ packageName, version })` on the target env. So a
  **deployed env carries the studio's produced package** — "where the package
  from the studio is installed."
- The one missing fact: **which studio produced a given env.** The env records
  the package, not the studio. With ≥2 studios this attribution is unknowable
  from vetra.io alone.

The studio agent already knows its own env id (`VETRA_ENVIRONMENT_ID`, set at
studio creation). So the deploy moment is exactly when both sides of the link
are known — we capture it there, durably.

## Approach: stamp `studioInstanceId` at deploy time

Add an optional `studioInstanceId` to the environment document model, stamp it
during a studio's deploy, project it through the subgraph, and group by it on
the frontend. `autoUpdateChannel` is the precedent at every layer.

### Data flow

```
vetra-cli deployProject  ──setStudioInstance(VETRA_ENVIRONMENT_ID)──▶  env document
        │                                                                   │
        ▼                                                          processor projects
 addPackage(product pkg)                                     studioInstanceId → environments table
                                                                            │
                                                                            ▼
vetra.io  ◀── myEnvironments { …, studioInstanceId, packages, services } ── observability subgraph
   │
   ▼
 group: env.studioInstanceId === studioProduct.envId  →  nested under that studio
        env.studioInstanceId == null && not a studio   →  "Other environments"
```

The studio's own env (`envId` in `myStudioProducts`) is the header, never a
nested card. Its own `studioInstanceId` stays `null`; we exclude studio envs
from the env-card set by id so they don't leak into "Other environments."

## Phase 1 — `vetra-cloud-package` (the durable link)

Mirror `autoUpdateChannel` end to end. New optional state field
`studioInstanceId: OID` (nullable; `null` = the studio itself or a
user-created env) and a `SET_STUDIO_INSTANCE` action.

1. **Doc-model source** `document-models/vetra-cloud-environment/vetra-cloud-environment.json`:
   - Add `studioInstanceId: OID` to the `VetraCloudEnvironmentState` schema string.
   - Add `"studioInstanceId": null` to `initialValue`.
   - Add a `SET_STUDIO_INSTANCE` operation to the `data_management` module:
     `input SetStudioInstanceInput { studioInstanceId: OID }` (nullable input so
     it can also clear).
2. **Regenerate** `gen/` via `ph-cli generate` (npm run generate).
3. **Reducer** `v1/src/reducers/data-management.ts`:
   `setStudioInstanceOperation(state, action) { assertOwner(state, action); state.studioInstanceId = action.input.studioInstanceId ?? null; }`
   No `markPendingIfDeployed` — the link is metadata; it renders nothing into the
   chart / gitops values, so no re-deploy is required. (Confirm against
   `gitops.ts`; if it never reads the field, this holds.)
4. **Processor** `processors/vetra-cloud-environment/`:
   - `migrations.ts`: `addColumn("studioInstanceId", "varchar(255)")` (new
     migration step, like the `autoUpdateChannel` add).
   - `schema.ts`: add `studioInstanceId: string | null` to the row type.
   - `index.ts`: destructure `studioInstanceId` from `state` and add
     `studioInstanceId: studioInstanceId ?? null` to `row`.
5. **Subgraph** `subgraphs/vetra-cloud-observability/`:
   - `schema.ts`: add `studioInstanceId: String`, `packages: [VetraCloudPackage!]`,
     and `services: [...]` (or a compact `serviceTypes: [String!]`) to
     `VetraCloudEnvironmentSummary` so env cards can render package count +
     service list like the mock.
   - `resolvers.ts` `myEnvironments`: select `studioInstanceId`, `packages`,
     `services` from the `environments` table and shape them for the response.
6. **Tests**: reducer unit test (`data-management.test.ts`) mirroring the
   `autoUpdateChannel` / `apexService` cases; processor projection test.

## Phase 2 — `vetra-cli` (stamp on deploy)

In `vetra-app/editors/vetra-studio/deploy/deployProject.ts`, when running inside
a studio (`process.env.VETRA_ENVIRONMENT_ID` present), stamp the target env with
the studio's id at install:

- **New env** branch: after `applyCreateEnvironment` / before `addPackage`, call
  `controller.setStudioInstance({ studioInstanceId: studioEnvId })`.
- **Existing env** branch: same, alongside the `addPackage` / `setPackageVersion`.

Requires the codegen'd `setStudioInstance` action to be exposed by the
`vetra-cloud-client` controller (comes from Phase 1's regenerated types; bump
the `@powerhousedao/vetra-cloud-package` dep in vetra-cli). Guard on the env id
being present so a locally-run deploy (no studio context) simply doesn't stamp.

## Phase 3 — `vetra.io` (the grouped page)

1. **Types** `modules/cloud/types.ts`: add `studioInstanceId?: string | null` to
   `CloudEnvironmentState`.
2. **Query** `modules/cloud/graphql.ts`: add `studioInstanceId`, `packages`,
   `services` to the `myEnvironments` selection + `EnvironmentSummary`; carry
   them through `summaryToCloudEnvironment` (so env cards finally show real
   package counts + services — the current dashboard shows 0 because the summary
   drops them).
3. **Grouping hook** (new, `modules/cloud/studio/use-studio-groups.ts`): combine
   `myStudioProducts` (studios: brand + status + subdomain) with
   `myEnvironments` (envs: now carrying `studioInstanceId`). Produce:
   - `groups`: one per studio product → `{ studio, environments: envs where studioInstanceId === studio.envId }`.
   - `standalone`: envs with `studioInstanceId == null` that are not themselves studios.
   Freshness stays on the coordinator's WS signal + `myStudioProducts` adaptive
   poll — no new polling loop (keeps the SP1 single-source model).
4. **Layout** `modules/cloud/studio/components/`: port the four preview
   components off mock types onto the real model, reusing `CloudEnvironmentCard`,
   `StatusDot` / `STATUS_LABELS` (extend with a `sleeping`→"Hibernating"
   treatment; `myStudioProducts.status` already emits `sleeping`), and
   `use-product-brand` for the header title/tagline.
5. **Wire the page** `app/user/products/page.tsx`: swap `StudioProductsGrid` for
   the grouped layout (kept behind `EarlyAccessGate`). Decide `myStudioProducts`
   fate — keep it for the studios list; the grouping just joins it with envs.
6. **Actions**:
   - Header ⋮ / click → open the studio (existing `buildStudioEmbedUrl`).
   - "New environment…" (per-studio tile + bottom) → existing
     `/user/environments/new` flow.
   - "New Vetra Studio…" → existing create-studio flow (`useCreateStudioEnvironment`).

## Backfill / rollout

- Existing envs have `studioInstanceId == null` → they render under "Other
  environments" until re-deployed from their studio (which stamps them) or a
  one-off backfill runs. The page is correct and useful from day one; it just
  starts light on grouping and fills in as deploys happen.
- Ship order: Phase 1 (publish a `dev` version) → Phase 2 (bump dep, stamp) →
  Phase 3 (consume). Phase 3 can merge before real data exists; everything
  simply appears under "Other environments" until stamps land — graceful.
- The frontend must tolerate `studioInstanceId` absent (older subgraph) — treat
  missing as `null`.

## Edge cases

- **Env deployed to by two studios over time:** last stamp wins (single id). The
  UI reflects the current owner. Acceptable — a deploy is an explicit act.
- **Studio env in the env list:** excluded from cards by matching against
  `myStudioProducts` env ids (it's a header, not a nested card).
- **Sleeping studio:** brand fetch is gated on `ready`, so a hibernating studio
  header falls back to its label; status pill shows "Hibernating." Nested envs
  still render from `myEnvironments`.
- **Deploy outside a studio** (local CLI): `VETRA_ENVIRONMENT_ID` unset → no
  stamp → env is standalone. Correct.

## Testing

- **vetra-cloud-package:** reducer unit test for `SET_STUDIO_INSTANCE`
  (set + clear + owner-gate); processor projection test (state → column);
  subgraph resolver test asserting `studioInstanceId`/`packages`/`services` in
  `myEnvironments`.
- **vetra-cli:** unit test that `deployProject` stamps `setStudioInstance` in
  both branches when `VETRA_ENVIRONMENT_ID` is set, and does not when unset.
- **vetra.io:** unit test for the grouping hook (studios × envs → groups +
  standalone; studio env excluded; unstamped → standalone); component render of
  a group with nested cards. Signed-in visual QA on staging (human/wallet).

## Open questions (resolved)

1. **Studios per user:** many — one header per studio (as the mock shows).
2. **"New" semantics:** both exposed — per-studio "New environment" and a
   top-level "New Vetra Studio."
3. **`myStudioProducts`:** kept — it's the studios source; grouping joins it
   with `myEnvironments`.
4. **Backfill:** no forced backfill; unstamped envs live under "Other
   environments" and populate as deploys stamp.
5. **Enter-studio target / ⋮:** header click → `buildStudioEmbedUrl`; ⋮ menu
   holds open-studio + (later) settings/rename/delete.
