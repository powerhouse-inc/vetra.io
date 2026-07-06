# Studio Brand Caching — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show each studio's real product name + description on `/user/products`, durably across hibernation, by caching the BrandSheet centrally via the observability pull-worker instead of fetching it live from the (usually-sleeping) studio.

**Architecture:** The observability `clint-pull-worker` (already polls only awake studios) also fetches each studio's `BrandSheet` and upserts it into a new `studio_brand` table in the observability read-model DB. `myStudioProducts` left-joins it and returns `brand { title, tagline, description }`. `/user/products` reads that; the live `useProductBrand` fetch is removed.

**Tech Stack:** Kysely (obsDB), GraphQL federation subgraph (vetra-cloud-package), Next.js/React/TanStack Query (vetra.io).

## Global Constraints

- Commit style: small incremental commits, NO Co-Authored-By / AI attribution trailer.
- vetra-cloud-package builds on the dev `@powerhousedao/*` line; vetra-cli on rc (N/A here). Publish on the dev channel, promote to `registry.vetra.io`, repin `vetra`.
- **No-clobber:** an empty / `{"status":"waking"}` / failed brand fetch must NOT overwrite an existing `studio_brand` row.
- Only upsert a brand when a non-empty `name` is present.
- Description line = `maxim`; also cache `concept`. Header falls back to `studio.label` ("Vetra Studio") only when `brand` is absent.
- Read-tolerant: vetra.io must treat a missing `brand` field (older subgraph) as null.

---

## Phase 1 — vetra-cloud-package

### Task 1: `studio_brand` read-model table

**Files:**

- Modify: `subgraphs/vetra-cloud-observability/db/migrations.ts` (add table in `up()`)
- Modify: `subgraphs/vetra-cloud-observability/db/schema.ts` (row type + DB interface)
- Test: `subgraphs/vetra-cloud-observability/__tests__/db-migrations.test.ts` (assert table exists)

- [ ] Add the table in `up()` (mirror the `clint_runtime_endpoints` block, `.ifNotExists()`):

```ts
await db.schema
  .createTable('studio_brand')
  .addColumn('documentId', 'varchar(255)', (c) => c.primaryKey())
  .addColumn('subdomain', 'varchar(255)')
  .addColumn('name', 'text')
  .addColumn('maxim', 'text')
  .addColumn('concept', 'text')
  .addColumn('updatedAt', 'varchar(255)')
  .ifNotExists()
  .execute()
```

- [ ] `schema.ts`: add the row interface + register it on the DB type:

```ts
export interface StudioBrand {
  documentId: string
  subdomain: string | null
  name: string | null
  maxim: string | null
  concept: string | null
  updatedAt: string
}
// in the ObservabilityDB interface:
studio_brand: StudioBrand
```

- [ ] Extend the migrations test to assert `studio_brand` is created (mirror the existing table assertions). Run: `npx vitest run subgraphs/vetra-cloud-observability/__tests__/db-migrations.test.ts` → PASS.
- [ ] Commit: `feat(obs): studio_brand read-model table`

### Task 2: pull-worker caches the BrandSheet

**Files:**

- Modify: `subgraphs/vetra-cloud-observability/clint-pull-worker.ts`
- Test: `subgraphs/vetra-cloud-observability/__tests__/clint-pull-worker.test.ts`

**Interfaces:**

- Produces: rows in `studio_brand` keyed by `documentId`, populated from each awake studio's switchboard BrandSheet.

- [ ] Add a brand-URL builder + parse helper near the top of the class (host is the same flattened host the agent URL uses; the switchboard is at `/switchboard/graphql`):

```ts
private brandUrl(svc: ClintServiceTuple): string {
  // Same host as buildAgentUrl, but the studio switchboard path.
  const agent = this.buildAgentUrl(svc); // https://<host>/_proxy/routes
  const host = new URL(agent).host;
  return `https://${host}/switchboard/graphql`;
}

const BRAND_QUERY =
  'query { BrandSheet { documents { items { state { global { name maxim concept } } } } } }';

function parseBrand(body: unknown): { name: string; maxim: string | null; concept: string | null } | null {
  const items = (body as any)?.data?.BrandSheet?.documents?.items;
  if (!Array.isArray(items) || items.length === 0) return null;
  const g = items[0]?.state?.global;
  if (!g || typeof g.name !== "string" || g.name.trim() === "") return null;
  return { name: g.name, maxim: g.maxim ?? null, concept: g.concept ?? null };
}
```

- [ ] Add `pullBrand(svc)` (fetch + upsert; no-clobber on empty/waking/error):

```ts
private async pullBrand(svc: ClintServiceTuple): Promise<void> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), this.fetchTimeoutMs);
  try {
    const res = await fetch(this.brandUrl(svc), {
      method: "POST",
      signal: ac.signal,
      headers: { "content-type": "application/json", "user-agent": OBSERVABILITY_PULL_USER_AGENT },
      body: JSON.stringify({ query: BRAND_QUERY }),
    });
    if (!res.ok) return;                       // keep last cached
    const brand = parseBrand(await res.json());
    if (!brand) return;                        // empty/waking → keep last cached
    const now = new Date().toISOString();
    await this.config.obsDb
      .insertInto("studio_brand")
      .values({ documentId: svc.documentId, subdomain: svc.subdomain, ...brand, updatedAt: now })
      .onConflict((oc: any) =>
        oc.column("documentId").doUpdateSet({
          subdomain: svc.subdomain, name: brand.name, maxim: brand.maxim, concept: brand.concept, updatedAt: now,
        }),
      )
      .execute();
  } catch {
    // keep last cached
  } finally {
    clearTimeout(t);
  }
}
```

- [ ] In `tickOnce`, pull brand alongside routes — only for apex studios (the studio's own switchboard): `await Promise.all(tuples.map((t) => Promise.all([this.pullOne(t), t.isApex ? this.pullBrand(t) : Promise.resolve()])));`
- [ ] Tests (mock `fetch` + a Kysely test DB, mirroring the existing worker test): (a) a BrandSheet response upserts `{name,maxim,concept}`; (b) a `{"status":"waking"}` body and a non-ok response do **not** clobber an existing row; (c) a studio in `NO_WORKLOAD_STATUSES` is never fetched. Run the worker test → PASS.
- [ ] Commit: `feat(obs): pull-worker caches studio BrandSheet (no-clobber)`

### Task 3: `myStudioProducts` returns the cached brand

**Files:**

- Modify: `subgraphs/vetra-cloud-observability/schema.ts` (StudioProduct type)
- Modify: `subgraphs/vetra-cloud-observability/resolvers.ts` (batch-join studio_brand)
- Test: `subgraphs/vetra-cloud-observability/__tests__/my-studio-products.test.ts`

**Interfaces:**

- Produces: `StudioProduct.brand { title, tagline, description }` (null when uncached).

- [ ] `schema.ts` — extend the `StudioProduct` type:

```graphql
type StudioProduct {
  envId: String!
  subdomain: String!
  prefix: String!
  label: String!
  status: String!
  brand: StudioBrandInfo
}
type StudioBrandInfo {
  title: String!
  tagline: String
  description: String
}
```

- [ ] `resolvers.ts` — after `matched` is built, batch-load brands (mirror the `readyKeys` batch, no N+1) and attach to the returned objects:

```ts
const brandRows = matchedEnvIds.length
  ? await db
      .selectFrom('studio_brand')
      .select(['documentId', 'name', 'maxim', 'concept'])
      .where('documentId', 'in', matchedEnvIds)
      .execute()
  : []
const brandByEnv = new Map(brandRows.map((b) => [b.documentId, b]))
// in the final StudioProduct map, add:
//   brand: (() => { const b = brandByEnv.get(m.id);
//     return b?.name ? { title: b.name, tagline: b.maxim ?? null, description: b.concept ?? null } : null; })(),
```

- [ ] Test: seed a `studio_brand` row for a matched studio → `myStudioProducts` returns `brand.title`; a studio with no row → `brand` is null. Run the test → PASS.
- [ ] Commit: `feat(obs): myStudioProducts returns cached brand`

### Task 4: publish + promote + repin (rollout)

- [ ] Full build + tests + tsc green.
- [ ] Merge to `dev` → publish (`0.0.13-dev.5`); promote the tarball to `registry.vetra.io` (`npm publish <tgz> --registry https://registry.vetra.io --tag dev`); repin `tenants/vetra` `PH_REGISTRY_PACKAGES` → the new version (both switchboard + connect); merge k8s; verify switchboard reload `1/1 Running`.

---

## Phase 2 — vetra.io

### Task 5: carry `brand` through the query + hook

**Files:**

- Modify: `modules/cloud/graphql.ts` (`myStudioProducts` selection + `StudioProductSummary`)
- Modify: `modules/cloud/studio/use-studio-products.ts` (`StudioProduct` type + `toStudioProduct`)

- [ ] `graphql.ts`: add `brand { title tagline description }` to the `myStudioProducts` query; add `brand?: { title: string; tagline: string | null; description: string | null } | null` to `StudioProductSummary`.
- [ ] `use-studio-products.ts`: `StudioProduct.brand` is currently `ProductBrand | null` imported from `fetch-product-brand` (deleted in Task 6). Replace that import with a **local** type so nothing dangles:

```ts
export type StudioBrand = { title: string; tagline: string | null; description: string | null }
// StudioProduct.brand: StudioBrand | null
```

Then map it in `toStudioProduct`: `brand: summary.brand ? { title: summary.brand.title, tagline: summary.brand.tagline, description: summary.brand.description } : null`.

- [ ] `npm run tsc` → clean. Commit: `feat(studio): carry cached brand from myStudioProducts`

### Task 6: header reads cached brand; remove the live fetch

**Files:**

- Modify: `modules/cloud/studio/components/studio-group-header.tsx`
- Delete: `modules/cloud/studio/use-product-brand.ts`, `modules/cloud/studio/fetch-product-brand.ts`
- Test: `modules/cloud/__tests__/studio-group-header.test.tsx` (new, render test)

- [ ] `studio-group-header.tsx`: replace the `useProductBrand(...)` call with `const brand = studio.brand`. Keep `const title = brand?.title || studio.label || 'Vetra Studio'` and `const tagline = brand?.tagline || null`.
- [ ] Delete `use-product-brand.ts` + `fetch-product-brand.ts`; remove any remaining imports (check `queryKeys.brand`, `parseBrandSheet` usages). If `queryKeys.brand`/`BRAND_QUERY` are now unused, remove them too.
- [ ] Render test: a `StudioProduct` with `brand: { title: 'Hotel Breakfast', tagline: 'Plan the morning', description: null }` renders "Hotel Breakfast — Studio" + the tagline; with `brand: null` renders "Vetra Studio — Studio".
- [ ] `npm run tsc` + lint + `npm run test:unit -- modules/cloud` (touched) → clean/pass. Commit: `feat(studio): render cached brand in the group header; drop live fetch`

### Task 7: verify + PR

- [ ] `npm run tsc`, lint, `format:check`, unit tests for touched modules → all clean.
- [ ] Grep for dangling `use-product-brand` / `fetch-product-brand` / `useProductBrand` references → none.
- [ ] PR `feat-studio-brand-caching` → `staging`.

---

## Merge order

1. vetra-cloud-package Phase 1 → dev → publish → promote → repin `vetra` (+ staging) → verify reload.
2. vetra.io Phase 2 → staging. The pull-worker starts caching brands on its next polls; the page shows real names as studios are polled while awake.
