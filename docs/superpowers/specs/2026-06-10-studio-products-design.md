# `/studio` Products — Design

**Date:** 2026-06-10
**Status:** Approved (design); pending implementation plan
**Builds on:** `2026-06-09-studio-page-design.md` (single-studio detect/create/embed)

## Summary

Evolve `/studio` from "one studio per user" into a **Products** model. A product is
a Vetra Studio environment; a user can have several. `/studio` shows the user's
products as a grid (title + description fetched from each env's agent), lets them
**open** an existing product (the embedded studio we already have) or **create a
new product** (provision a fresh studio environment).

## Context (verified facts)

- A "product" maps **1:1 to a vetra studio environment** (a `vetra-cli` CLINT
  agent). The user's products are their `vetra-cli` environments.
- Each agent runs its own Switchboard, reachable at
  `https://<prefix>.<subdomain>.vetra.io/switchboard/graphql`.
- Product **title/description** come from a **BrandSheet** document in the
  agent's `vetra-cli` drive. Verified schema
  (`BrandSheet_BrandSheetState`): `name: String` (→ **title**),
  `concept: String` (→ **description**), `maxim: String` (optional tagline),
  plus logos/colors/typography/voice/imagery.
  Query shape:
  ```graphql
  { BrandSheet { documents { items { id name state { global { name maxim concept } } } } } }
  ```
- Document reads are **auth-gated**: an unauthenticated query to the agent
  switchboard returns an empty drive (`childIds: []`), while the owner sees the
  BrandSheet. The page must query **with the user's Renown bearer token**
  (`getAuthToken`, already used elsewhere). The exact working endpoint
  (type-namespaced `/switchboard/graphql` vs the drive read endpoint) is
  verified against an authenticated session during implementation; default to
  the type-namespaced query above.
- `vetra-cli` requires an `ANTHROPIC_API_KEY` (write-only secret; not readable
  back), so each new product prompts for the key.

## Decisions

1. **Product = vetra studio environment** (1:1). Products list = the user's
   `vetra-cli` environments.
2. **Title/description** = the env's BrandSheet `state.global.name` /
   `concept` (+ `maxim` tagline), fetched per-env from the agent switchboard
   with the user's Renown bearer token. Missing/booting/no-BrandSheet →
   fall back to the environment label, else "Untitled product".
3. **Create new product**: prompt for the Anthropic key (every time — keys
   aren't reusable), provision a new env, navigate to it, boot, embed. The
   product name is set later inside the studio (via the BrandSheet).
4. **Routing**: `/studio` = products grid; `/studio/[envId]` = embedded studio
   for one product (shareable, back-button returns to grid).
5. **Per-env client fetch** (N parallel authed switchboard calls from the
   browser) for v1 — no backend aggregator. Revisit if N grows large.

## Architecture

### Data & fetching

- `findStudioAgents(envs): StudioAgentMatch[]` — generalize the existing
  single-match `findStudioAgent` to return **all** envs that have an enabled
  `vetra-cli` CLINT agent. Reuses the package-based detection that tolerates the
  environment-detail fragment omitting `service.config` (matches on
  `state.packages` containing `vetra-cli`).
- `fetchProductBrand(subdomain, prefix, token): ProductBrand | null` — POST the
  BrandSheet query to `https://<prefix>.<subdomain>.vetra.io/switchboard/graphql`
  with `Authorization: Bearer <token>`; parse the first BrandSheet item into
  `{ title, description, tagline }`. Returns `null` on any failure (agent down,
  booting, no BrandSheet, network) — callers fall back to the env label.
- `use-studio-products.ts` — list hook: resolves the user's product envs
  (`findStudioAgents` over fetched env details), then for each loads brand
  metadata (`fetchProductBrand`) and status (reuse `useClintRuntimeEndpoints` +
  pod status → `ready | booting | error`). Stable effect deps (address string,
  env-id list), mirroring the loop fix already applied to
  `use-studio-environment`.

### Routing & components

- `app/studio/page.tsx` → renders `StudioProductsGrid` (the new list).
- `app/studio/[envId]/page.tsx` → renders the existing embed flow scoped to
  `envId` (reuses `StudioFrame` + `StudioBootScreen` + new-tab fallback). A
  per-env variant of `use-studio-environment` keyed by the route param drives
  detect-ready/booting/embed for that single env.
- New components under `modules/cloud/studio/`:
  - `studio-products-grid.tsx` — gate (unauth/not-allowed) → grid of
    `StudioProductCard` + a "New product" card.
  - `studio-product-card.tsx` — card layout per the approved mockup: brand icon
    (default glyph for v1; BrandSheet `logos` is image-refs, deferred),
    **title** (BrandSheet `name`), **tagline** (`maxim`), **description**
    (`concept`, clamped), and a footer row. The whole card links to
    `/studio/[envId]`. Footer for v1 shows a **status badge** (Ready / Starting…);
    the mockup's "N environments" count and social links (github/web/twitter)
    have no BrandSheet source yet and are deferred (Phase 3+ / product doc model).
  - `fetch-product-brand.ts` — switchboard query + parser (pure parser unit-tested).
  - `use-studio-products.ts` — list state hook.
- Reuse: `StudioFrame`, `StudioBootScreen`, `StudioCreateForm` (key-only),
  `useCreateStudioEnvironment`, allowlist + gate logic.

### Create flow

"New product" → `StudioCreateForm` (Anthropic key) → `useCreateStudioEnvironment`
(unchanged: provisions a `vetra-cli` XL env pinned to the known-good version,
writes the key to the tenant secret store, approves) → on success navigate to
`/studio/[newEnvId]` → boot screen → embed once the agent announces its website
endpoint.

## States

- **Gate**: unauthenticated → login; logged-in but not allowlisted → limited-preview message.
- **Grid empty** (allowlisted, no products): just the "New product" card + a short explainer.
- **Card status** (per product): `ready` → "Open"; `booting` → "Starting…" (Open still works, lands on the boot screen); `error`/crash → badge + link to `/cloud/<id>` logs.
- **Brand fetch failure / no BrandSheet yet**: card shows the env label or "Untitled product"; no error surfaced (best-effort metadata).
- **Embed route `/studio/[envId]`**: env not found / not the user's → "Product not found" with a link back to `/studio`.

## Error handling

- `fetchProductBrand` never throws to the UI — returns `null`, card falls back.
- Create failure → error on the create form, grid intact.
- A booting/crashing agent doesn't block the grid — other products still render.

## Testing

- **Unit (vitest):**
  - `findStudioAgents` — zero / one / many product envs; ignores non-`vetra-cli` CLINT and disabled agents.
  - BrandSheet response parser — title/description/tagline extraction; missing `state`, empty items, malformed payload → safe fallback.
  - product-card status mapping (ready/booting/error → label + affordance).
- **Component (testing-library):**
  - `StudioProductsGrid` renders a card per product plus the "New product" card; empty state shows only the New-product CTA.
  - `StudioProductCard` shows title, description, status badge, and an Open link to `/studio/[envId]`.
  - Embed route renders `StudioFrame` for a known env.

## Out of scope (v1)

- Backend product aggregator (keep per-env client fetch).
- Editing product title/description from the grid (done inside studio).
- Key reuse / platform-provided key (re-prompt per product for now).
- Deleting/archiving products from the grid (use /cloud).
