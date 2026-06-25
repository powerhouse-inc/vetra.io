# WS-Driven Single-Source Client State (SP1) — Design

**Date:** 2026-06-25
**Status:** Approved design, pending implementation plan
**Author:** Frank (with Claude)

## Problem

After the app-state coordinator shipped (PR #78), two UX problems remain:

1. **Pages aren't instant.** Opening _My Products_ (and _Cloud_) cold-loads — the chip says "Up to date," yet the page shows skeletons because the data was never warmed and the chip never tracked it.
2. **Unnecessary requests.** Several queries poll on a fixed interval regardless of whether anything changed:
   - Environments: `refetchInterval: 20_000` (always).
   - Studio products: adaptive poll that idles at 30s even when nothing is provisioning.
   - `refetchOnWindowFocus` across the board.

The goal: a smooth experience where the user always has the latest state, with **few or no unnecessary requests**, kept fresh by the **WebSocket in the background**, with **every page sourced from one shared client state**.

## Decisions (from brainstorming)

- **Phased delivery.** This is SP1 of a larger plan:
  - **SP1 (this spec, client-only, ships now):** WebSocket as the freshness _signal_ → targeted, debounced refetch; remove idle polling; single cache all pages read; intent-prefetch for first load. No backend dependency.
  - **SP2 (later, backend):** real GraphQL subscriptions in `vetra-cloud-package` that push the _projected data_ over WS → client applies via `setQueryData` → true zero-refetch. A read-only spike confirmed this is buildable with local subgraph code (~95% confidence) using `BaseSubgraph.hasSubscriptions` + an own `graphql-subscriptions` PubSub + per-user `withFilter` on `context.user`. **Caveat:** the framework PubSub is in-memory, so it is only correct at `replicaCount: 1` (staging + vetra are 1 today); >1 replica needs a shared pubsub (Redis / PG LISTEN-NOTIFY), which is upstream framework work.
  - **SP3 (later, client):** swap SP1's targeted-refetch for `setQueryData` from the SP2 push.
- **Why not full backend push now:** SP1 delivers ~90% of the felt benefit (smooth UX, no idle requests, WS-driven) with zero backend/framework risk; SP2 is the last 10% behind real infra risk. Ship SP1, run the spike in parallel (done), commit to SP2/SP3 only if needed.
- **Supersedes PR #80** (warm-everything-on-boot) — closed. Its one good idea (studio-products as a coordinated key) is folded in here.
- **Server-prefetch + HydrationBoundary** (the textbook Next+RQ best practice) is _not_ viable: auth is a client-side Renown wallet bearer token the server can't use. Hence client-side techniques.

## Existing state (what we build on)

- React Query cache, persisted to localStorage, identity-reset + version cache-bust (PR #78/#79). This is already the single source of truth; pages already read from it.
- `AppStateCoordinator` (PR #78): warms `builder-account` + `my-teams` on boot; owns one `documentChanges` WS subscription that currently invalidates **all** coordinated keys on **every** event (no debounce); tracks sync status for the chip over `COORDINATED_KEY_PREFIXES`.
- `useDocumentListSubscription(onEvent)` (graphql-ws, `/graphql/subscriptions`, payload = change type + doc IDs only). Also a per-document `useDocumentSubscription`.
- Per-hook polling: `use-environment.ts` (`ENV_REFETCH_INTERVAL = 20s` + its own list subscription), `use-studio-products.ts` (`studioPollIntervalMs` adaptive; a separate 2s access-status poll that self-stops).
- `queryKeys` factory (`modules/cloud/query/keys.ts`); profile hooks use inline keys (`['my-teams', addr]`, `['builder-account', addr]`).

## Architecture

SP1 reshapes _when_ the cache is read/refreshed; it does not change what the cache is (React Query, persisted) or that pages read from it.

```
React Query cache (single source of truth, persisted) — pages read from it
└─ AppStateCoordinator
   ├─ one documentChanges WS  → debounced, active-only invalidate  (freshness signal)
   ├─ boot warm: builder-account + my-teams only                   (cheap shared data)
   ├─ intent prefetch: nav hover/focus → prefetchQuery(queryOptions) (warm before click)
   └─ sync status (chip)      → reflects WS-connected + in-flight coordinated fetches
   queries: NO idle polling — staleTime + WS drive freshness; bounded poll only while provisioning
```

### Component 1 — `queryOptions` factories (drift-safe shared query defs)

Refactor each coordinated/prefetchable query to export a TanStack v5 `queryOptions(...)` object reused by both the hook and the prefetch path, so keys/fetchers never diverge.

- `studioProductsQueryOptions(token)` — key `queryKeys.studioProducts(did)`, fn `fetchMyStudioProducts(token)`.
- `myEnvironmentsQueryOptions(token, scope)` — key `queryKeys.environments(scope, did)`, fn `fetchMyEnvironments(scope, token)`.
- `myTeamsQueryOptions(address)`, `builderAccountQueryOptions(address)`.

Authed queries need a token; the factory takes the token (resolved by the caller via `getAuthToken(renown)`, mirroring `useAuthedQuery`). The existing hooks are refactored to consume these factories — behavior-preserving except for the polling change below.

### Component 2 — WS as the freshness signal (debounced, active-only)

The coordinator keeps **one** `documentChanges` subscription. On an event:

- Coalesce bursts with a **~750ms debounce** (the staging _management_ switchboard emits a high-frequency `documentChanges` stream from its reconcile/pull-worker loops — without debounce this becomes a refetch firehose, the "constant pulling" failure mode).
- Then `queryClient.invalidateQueries({ queryKey: prefix, refetchType: 'active' })` for each coordinated prefix. `refetchType: 'active'` means **only queries with mounted observers refetch** — i.e. the page you're looking at; idle pages are marked stale and refresh lazily on next visit.

Remove the now-redundant per-hook env list subscription (the central one covers it).

### Component 3 — Remove idle polling

- **Environments:** delete `refetchInterval: 20_000`. Freshness now comes from the WS signal + `refetchOnWindowFocus`. Keep `staleTime` generous.
- **Studio products:** change `studioPollIntervalMs` to return `false` when nothing is provisioning (today it idles at 30s). Keep the fast poll **only while a product is provisioning** — a status flip (provisioning→ready) is server-computed and may not emit a `documentChanges` event, so a bounded transient poll preserves correctness; it stops once all products are ready.
- **Access-status 2s poll:** unchanged — it already self-stops once resolved.
- **`refetchOnWindowFocus`:** keep (cheap safety net for any missed WS event).

Net: idle user → zero requests; a real change → at most one debounced refetch of the active page; provisioning → bounded fast poll until ready.

### Component 4 — Intent prefetch (instant first paint)

- `usePrefetchOnIntent(href)` returns `{ onMouseEnter, onFocus, onTouchStart }`; first trigger fires once (deduped per href) and calls `queryClient.prefetchQuery(<that route's queryOptions>)`.
- A small `ROUTE_PREFETCH` map: `'/user/products' → studioProductsQueryOptions`, `'/user/environments' & '/cloud' → myEnvironmentsQueryOptions`. (Packages/builders are RSC — Next's built-in `<Link>` route prefetch already covers them; no data prefetch.)
- Applied at the single nav-item map site (`navbar-items-desk` / `navbar-item-mobile`) so every item gets it automatically — no per-item wiring. Handlers are spread onto the existing `<Link>` (additive; navigation is unaffected if prefetch fails).
- Mobile (no hover): `onTouchStart` gives a small head start; first tap may still load on a cold cache. Best-effort; persisted cache covers return visits.

### Component 5 — Boot warm shrinks; chip stays honest

- `CacheWarmers` warms only `builder-account` + `my-teams` (cheap, used by navbar/profile). Products/envs are no longer boot-warmed (intent-prefetch handles them).
- `COORDINATED_KEY_PREFIXES`: `builder-account`, `my-teams`, `studio-products`, `environments`, `viewer`. The chip reflects these **once loaded** — "Up to date" honestly means "what's loaded is fresh and the WS is live." Hovering a nav link briefly shows "Refreshing…" as the prefetch runs.

## Data flow

- **First visit to a page:** hover nav link → prefetch via `queryOptions` → cache warm → click → instant paint. (Or, no hover → query runs on mount, skeleton briefly.)
- **Return visit:** persisted cache paints instantly; WS keeps it fresh.
- **Something changes server-side:** `documentChanges` fires → debounced → active page's query refetches once; other pages refresh on next visit.
- **Idle:** no polling, no requests.

## Error handling / edges

- **WS down / disconnected:** queries still work (mount-fetch + focus-refetch); chip shows not-live. `graphql-ws` retries (existing `retryAttempts: 5`).
- **Missed WS event** (server-computed change with no doc change): caught by `refetchOnWindowFocus` and, for provisioning, the bounded poll.
- **High-churn firehose:** bounded by debounce + `refetchType: 'active'`.
- **Prefetch failure:** swallowed; the page's own query/Suspense handles loading + errors. Navigation unaffected.

## Testing

Following existing Vitest patterns (`modules/shared/state/__tests__/*`, `use-my-teams.test`):

- `queryOptions` factories produce the expected key + fn (and match `queryKeys.*`).
- Debounce/coalesce util: N rapid events → one invalidate after the window.
- `studioPollIntervalMs` returns `false` when no product is provisioning, fast interval while provisioning.
- `usePrefetchOnIntent` fires the prefetch once per href and dedupes repeat hovers.
- `isCoordinatedKey` includes `studio-products`; `COORDINATED_KEY_PREFIXES` matches the new list.
- Sync-status derivation unchanged (still green).

## Out of scope (SP1)

- SP2 backend subscriptions / SP3 client switch to `setQueryData` from push.
- Cross-replica pubsub (only relevant when switchboard scales >1 replica).
- Converting pages to Suspense/`useSuspenseQuery` (skeletons already exist; revisit only if a page lacks a good loading state).
- Builder-teams / builder-account backend changes.

## File touch-list (for the plan)

```
modules/cloud/studio/use-studio-products.ts      # queryOptions + drop idle poll
modules/cloud/studio/studio-readiness.ts          # studioPollIntervalMs → false when idle
modules/cloud/hooks/use-environment.ts            # queryOptions + drop 20s poll + drop redundant per-hook WS
modules/profile/lib/use-my-teams.ts               # queryOptions
modules/profile/lib/use-builder-account.ts        # queryOptions
modules/cloud/query/query-options.ts              # NEW — shared queryOptions factories (or co-located per hook)
modules/shared/state/sync-status-logic.ts         # add studio-products to coordinated keys
modules/shared/state/app-state-coordinator.tsx    # debounce WS invalidate (active-only); warm set unchanged (cheap only)
modules/shared/state/use-prefetch-on-intent.ts    # NEW — intent prefetch hook + ROUTE_PREFETCH map
modules/shared/components/navbar/components/navbar-items-desk.tsx   # spread intent handlers
modules/shared/components/navbar/components/navbar-item-mobile.tsx  # spread intent handlers
```
