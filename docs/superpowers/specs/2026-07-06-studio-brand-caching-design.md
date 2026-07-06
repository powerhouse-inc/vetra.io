# Studio brand caching — design

**Date:** 2026-07-06
**Status:** draft — awaiting review
**Repos:** `vetra-cloud-package` (pull-worker + read-model DB + subgraph), `vetra.io` (consume)

## Problem

`/user/products` studio headers show the hardcoded fallback **"Vetra Studio"** instead of the real product name + description. Root cause (verified):

- Header title is `brand?.title || studio.label`, and `studio.label` is hardcoded `'Vetra Studio'` at creation. So `brand.title` is the only source of a real name.
- `useProductBrand` fetches the `BrandSheet` **live from each studio's own switchboard**, gated on `status === 'ready'`.
- Studios hibernate after ~24h idle (`status: 'sleeping'`) → the fetch is disabled → fallback. Even a "ready" studio that's actually asleep returns the wake-proxy (`{"status":"waking"}`), not GraphQL → parses to null.
- So the product identity lives **only inside the (usually-sleeping) studio switchboard**, unreachable when browsing the products page → everything shows "Vetra Studio".

## Approach (chosen)

**Cache each awake studio's BrandSheet centrally, served via `myStudioProducts`.** Reuse the existing `clint-pull-worker` pattern: the observability subgraph already polls each **awake** studio (skipping hibernated ones so it never re-wakes them) and caches results in its read-model DB (`clint_runtime_endpoints`). We add the BrandSheet to that flow. `/user/products` then reads the **cached** brand — durable across hibernation, centralized (every client), and it removes the live cross-origin fetch (and its NXDOMAIN-poisoning risk).

Storage: the **observability read-model DB** (obsDB), a new `studio_brand` table — same store + pattern as `clint_runtime_endpoints`, and the DB `myStudioProducts` already reads.

## Components

### vetra-cloud-package

**1. obsDB migration — `studio_brand` table**
Mirror `clint_runtime_endpoints`' style (`db/migrations.ts`):

```
documentId  varchar(255)  PK   -- the studio env's document id
subdomain   varchar(255)
name        text               -- BrandSheet.name  → header title
maxim       text               -- BrandSheet.maxim → description line
concept     text               -- BrandSheet.concept (cached for later use)
updatedAt   varchar(255)
```

**2. Pull-worker extension (`clint-pull-worker.ts`)**
Inside the existing per-awake-studio loop (already skips `NO_WORKLOAD_STATUSES` so hibernated studios are never polled/re-woken), add a second fetch alongside the `/_proxy/routes` call:

- POST the BrandSheet query to the studio's switchboard: `https://<host>/switchboard/graphql` with
  `query { BrandSheet { documents { items { state { global { name maxim concept } } } } } }`
  (`<host>` from the same flattened-host builder the worker already uses).
- Parse the first item's `global` (name/maxim/concept).
- **Upsert** into `studio_brand` (`documentId` conflict → update), only when a valid `name` is present.
- **Never clobber on empty/failure:** an empty `items`, a `{"status":"waking"}` body, or a fetch error **leaves the last cached row untouched** — so a studio that once published a name keeps it even if a later poll is empty.

**3. `myStudioProducts` resolver + schema**

- Add `brand { title tagline description }` to the `StudioProduct` type (`schema.ts`).
- In the resolver, left-join `studio_brand` on `documentId` and map `name→title`, `maxim→tagline`, `concept→description`. `brand` is `null` when nothing is cached yet.

### vetra.io

**4. Types + hook** — add `brand` to `StudioProduct` (`use-studio-products.ts`) and carry it through `toStudioProduct` from the `myStudioProducts` response.

**5. `StudioGroupHeader`** — render `studio.brand?.title` (name) and `studio.brand?.tagline` (description) directly; fall back to `studio.label` only when `brand` is absent.

**6. Remove the live fetch** — delete `use-product-brand.ts` + `fetch-product-brand.ts` and their usages. The brand now comes from `myStudioProducts`; no per-card cross-origin fetch.

## Data flow / behavior

```
pull-worker (every ~15s, awake studios only)
   └─ POST BrandSheet → studio switchboard → upsert studio_brand (obsDB)
myStudioProducts  ──left join studio_brand──▶  StudioProduct { …, brand }
/user/products (use-studio-groups)  ──▶  header shows brand.title / brand.tagline
```

- **Awake studio with a BrandSheet** → cached → shown always, **even after it hibernates.**
- **Never-awake / no-BrandSheet studio** → no cached row → header falls back to "Vetra Studio" (acceptable; auto-populates the next time it's awake).
- Eventually-consistent up to one poll interval (~15s).

## "name **and** description"

`title` = `name`; the description line = `maxim` (the short tagline the header already renders in its sub-line). `concept` is cached too so a longer blurb can be shown later without a schema change. (Flip the description to `concept` if preferred — one-line change.)

## Edge cases

- **BrandSheet deleted / renamed to empty:** the no-clobber rule keeps the last good name (deliberate — avoids flapping to the fallback on a transient empty read). A future explicit "clear" is out of scope.
- **Studio switchboard reachable but 5xx / timeout:** treated as failure → keep last cached (worker already has a per-fetch timeout).
- **New studio, first poll:** brand null until the first successful fetch → brief "Vetra Studio" then resolves.

## Testing

- **Worker:** unit test — a BrandSheet response upserts name/maxim/concept; an empty/`waking`/error response does **not** clobber an existing row; hibernated studios are skipped (existing behavior unchanged).
- **Resolver:** `myStudioProducts` returns the joined `brand` for a studio with a cached row, `null` without.
- **vetra.io:** header renders `studio.brand.title`/`.tagline`; grouping hook + `StudioProduct` type carry `brand`; `use-product-brand`/`fetch-product-brand` removed with no dangling imports.

## Rollout

vetra-cloud-package via the established flow (dev → publish → promote to `registry.vetra.io` → repin `vetra` + staging), then vetra.io → staging. The worker starts caching brands on the next polls; the page shows real names as studios are polled while awake.

## Open decisions (for review)

- **maxim vs concept** as the description line (recommend `maxim`).
