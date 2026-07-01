# Studio group-header layout — UI ideation & implementation plan

This folder is a **mock-driven UI prototype** for reorganizing the environments
page around Vetra Studio instances. It is not wired to any backend.

- **Preview route:** `/user/products/preview` (see
  [`app/user/products/preview/page.tsx`](../../../../app/user/products/preview/page.tsx))
- **Everything here uses mock data** ([`mock-data.ts`](./mock-data.ts)); no GraphQL, no auth gate.

## What the prototype shows

- The page title is **Environments**.
- Each **Vetra Studio** renders as a **full-width managed-infra header** titled by the
  product identity (e.g. "Hotel Breakfast App — Studio"), with the environments it
  produced **organized underneath it**.
- The header is:
  - **collapsible** via a caret (folds its environments away),
  - **clickable** to enter the studio (stretched-link + green vetra hover outline + "Open studio →"),
  - fitted with a low-prominence **⋮ overflow menu** instead of a big Manage button.
- A header-less **"Other environments"** section lists environments **not** produced by any
  Studio (created directly by the user).
- Bottom actions: **New environment** and **New Vetra Studio**.
- Statuses shown per environment, including a new **Hibernating** state.

---

## What it takes to make this real

The prototype fakes one thing the real system does not yet have: **a link from an
environment to the Studio that produced it**. Today a "Studio" is just a
`VetraCloudEnvironment` that happens to run the `vetra-cli` CLINT service
(see [`find-studio-agent.ts`](../find-studio-agent.ts)); there is **no parent/child
relationship** between a Studio and the environments it builds.

### 1. Document-model change (cross-repo — `@powerhousedao/vetra-cloud-package`)

The `VetraCloudEnvironment` document model lives in the external
`@powerhousedao/vetra-cloud-package` dependency, **not** in this repo. Required changes:

- **State:** add `studioInstanceId: ID | null` to `VetraCloudEnvironmentState`
  (`null` = the Studio itself, or an environment created directly by the user).
- **Action + reducer:** add `SetStudioInstance(studioInstanceId: ID)`
  (and optionally `ClearStudioInstance`) that sets the field.
- **Codegen:** regenerate the `gen/schema` types and publish a new `dev` version.
- **Direction of the link:** each produced environment points *up* to its parent Studio's
  document id. The Studio env's own `studioInstanceId` stays `null`.

> **Who sets the field (also cross-repo):** the deploy/provisioning path that creates an
> environment *on behalf of a Studio* must call `SetStudioInstance` with the Studio env's
> id. That logic lives in the **vetra-cli / switchboard** side, not vetra.to. Existing
> environments remain unlinked (`null`) until backfilled — they simply fall into
> "Other environments".

### 2. Product identity — BrandSheet (no change needed)

The header title comes from the **BrandSheet** document (name / maxim / concept) already
fetched per-Studio from its own switchboard via
[`use-product-brand.ts`](../use-product-brand.ts) / [`fetch-product-brand.ts`](../fetch-product-brand.ts).
Reuse it as-is for the header title; **no document-model change** here.

### 3. vetra.to consumption (this repo)

- **Types:** add `studioInstanceId: string | null` to `CloudEnvironmentState` in
  [`modules/cloud/types.ts`](../../types.ts).
- **Query:** add `studioInstanceId` to the `myEnvironments` selection + `EnvironmentSummary`
  in [`modules/cloud/graphql.ts`](../../graphql.ts) (`fetchMyEnvironments`), and carry it
  through the env→`CloudEnvironment` mapping.
- **Grouping:** replace mock data with real grouping —
  - Studios = envs with an enabled `vetra-cli` CLINT service (`findStudioAgent`).
  - A Studio's children = envs where `studioInstanceId === studio.id`.
  - "Other environments" = envs with `studioInstanceId == null` that are not Studios.
- **Status / hibernation:** extend the `STATUS_LABELS` map (currently in
  [`app/user/environments/cloud-projects.tsx`](../../../../app/user/environments/cloud-projects.tsx))
  with a `HIBERNATING` entry, and reuse the real `CloudEnvironmentCard` for children
  (export it from that file) instead of the mock `OwnedEnvCard`.
- **Wire the real page:** point [`app/user/products/page.tsx`](../../../../app/user/products/page.tsx)
  at the grouped layout, and de-duplicate against `/user/environments` so an env isn't
  shown both nested and flat.

---

## Open questions for the dev conversation

1. **Studios per user:** this prototype shows **multiple** Studios (many product cycles).
   An earlier assumption was "exactly one per user." Confirm which — it changes whether the
   page has one header or many.
2. **"New product" semantics:** with the grouped model, does "create" mean a new **child
   environment** under a Studio, or a new **Studio**? The prototype exposes both.
3. **`myStudioProducts` query:** today it returns Studio envs as the product list. Under the
   grouped model the page derives Studios + children from `myEnvironments`. Keep, repurpose,
   or drop it?
4. **Backfill:** do we stamp `studioInstanceId` on already-existing environments, or leave
   them under "Other environments"?
5. **Enter-studio target & overflow menu:** confirm the header click destination (studio URL
   vs. a detail page) and what belongs in the ⋮ menu (settings, delete, rename…).
