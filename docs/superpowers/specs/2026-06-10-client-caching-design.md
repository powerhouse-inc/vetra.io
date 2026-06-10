# Client-side caching + snappy mutations — design

**Date:** 2026-06-10
**Status:** Approved, implementing

## Goal

Every data-backed surface paints instantly from a persisted cache, silently
revalidates in the background, and every mutation feels immediate via one
consistent optimistic pattern. Driven by an upcoming investor demo: the app
must feel fast and stable.

## Approach

Standardize on **React Query** (already a dependency, v5.101) as the single
data layer, **persisted to `localStorage`**. Migrate the hand-rolled
`useState`+`useEffect`+polling hooks onto it. The existing WebSocket
subscription (`useDocumentListSubscription`) becomes a cache-invalidation
signal instead of a manual refetch trigger.

Rollout is per-hook; each step ships working software. Foundation first, then
hot-path read hooks, then mutations, then cleanup.

## Sections

### 1. Persistence foundation

- Add `@tanstack/react-query-persist-client` + `@tanstack/query-sync-storage-persister`.
- Swap `QueryClientProvider` → `PersistQueryClientProvider` with a `localStorage` persister.
- Client defaults: `staleTime` 30s, `gcTime` 24h (persisted cache survives
  restarts), `refetchOnWindowFocus` on (silent SWR), `retry` 2.
- Cache version `buster` constant — bump on deploy/schema change to drop stale shapes.
- **Per-user isolation (security):** every user-scoped query key includes the
  viewer DID, so user B never reads user A's cache entries (different keys =
  cache miss = fresh fetch). On DID change we additionally `queryClient.clear()`
  + drop the persisted client. `dehydrateOptions.shouldDehydrateQuery` refuses
  to persist sensitive queries (tenant secrets/env vars). API keys are
  write-only and never enter the cache.
- SSR-safe: persister storage guarded by `typeof window`.

### 2. Query keys + token-aware fetchers

- A `queryKeys` factory: `environments(scope, did)`, `viewer(did)`,
  `environment(envId)`, `studioProducts(did)`, `brand(subdomain, prefix)`,
  `runtimeEndpoints(subdomain, envId)`, etc.
- `useAuthedQuery` helper wraps `useQuery`, injecting the bearer token from
  `useRenown()` into the existing `graphql.ts` fetchers. No fetch logic
  rewritten — only moved under React Query.

### 3. Migrate read hooks (SWR), hot paths first

- `useEnvironments`/`useEnvironment`/`useViewer`, then studio
  products/embed/runtime-endpoints.
- `setInterval` polling → `refetchInterval` (relaxed to ~20–30s since SWR +
  subscription cover freshness → fewer requests).
- `useDocumentListSubscription` → `queryClient.invalidateQueries`. The
  `refresh-environments` CustomEvent is replaced by invalidation.
- `placeholderData: keepPreviousData` so scope/param switches don't blank.
- Each hook keeps its current return shape — behind-the-interface swap.

### 4. One optimistic mutation pattern

- A single `useOptimisticMutation` wrapper over `useMutation`: `onMutate`
  (cancel + snapshot + optimistic cache write), `onError` (rollback),
  `onSettled` (invalidate). Every write uses it → identical, instant feel.
  - Create product/env: placeholder card appears instantly (`booting`),
    navigates immediately, reconciles on response.
  - Delete: card vanishes immediately, restored on failure.
  - Rename/edit: value reflects immediately.
  - API key: confirms instantly (write-only; reconcile on settle).
- Existing `useOptimistic`/`useDebouncedOptimistic` stay for pure toggles;
  anything touching a shared list/cache uses the new wrapper.

### 5. Subtle refresh UX

- Full skeleton only on cold start (no cached data). Once cached, revalidation
  is silent; content swaps in place (structural sharing avoids needless
  re-renders).
- One faint global indicator — a thin top-bar shimmer driven by
  `useIsFetching()`/`useIsMutating()`. No per-card spinners.

### 6. Testing

- Unit tests on pure seams: query-key factory, per-user namespacing + buster,
  `shouldDehydrateQuery` no-secrets filter, optimistic updater functions (pure
  cache transforms driven by a test `QueryClient`).

### 7. Cleanup

As each hook moves onto React Query, the scaffolding it replaces is deleted in
the same step:

- Manual `setInterval` polling blocks.
- The `refresh-environments` CustomEvent bus + `useRefreshEnvironments`
  (migrate all dispatchers/listeners to `invalidateQueries` first).
- Manual `JSON.stringify` diff guards and `summariesRef`/`isLoading`/`error`
  `useState` triads RQ now owns.
- The old plain `QueryClientProvider` default export.
- Read hooks fully superseded (collapse thin wrappers / remove unused).
- Reconcile optimistic helpers (keep for toggles, move list updates to wrapper).
- Final grep pass for orphans (dead exports, unreferenced files).
