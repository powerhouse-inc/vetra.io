# Global App-State Coordinator — Design

**Date:** 2026-06-24
**Status:** Approved design, pending implementation plan
**Author:** Frank (with Claude)

## Problem

Users report the app sometimes shows "bad state (cached)." Three concrete symptoms:

1. **Stale after deploy** — the persisted localStorage cache serves old-shaped or old data after a new app version ships.
2. **Wrong identity / leftover** — after login/logout or switching wallet/DID, data from the previous user (or pre-auth state) lingers.
3. **Stale across navigation** — landing on a page shows data fetched a while ago that is never revalidated.

The goal: a global state layer that fetches everything on boot, keeps it shared and available across pages, refreshes in the background on return, and surfaces a small "up to date / refreshing" status indicator.

## Existing state (what we build on)

The app already has a capable client-side cache; this is **not** a greenfield state manager.

- **React Query** with a persisted localStorage cache (`PersistQueryClientProvider`), 30s `staleTime`, `refetchOnWindowFocus`, `gcTime` of 24h.
- A **manual** `CACHE_BUSTER = 'v1'` (the persisted blob is dropped when it changes).
- A `CacheIdentityGuard` that clears the cache when the signed-in DID changes.
- `SENSITIVE_KEY_PREFIXES` so tenant secrets/env-vars are never persisted.
- A centralized query-key factory (`modules/cloud/query/keys.ts`) with DID-scoped per-user keys.
- **Direct client → Switchboard WebSocket** subscriptions (`graphql-ws`, `/graphql/subscriptions`, `documentChanges`) used throughout the cloud module (`use-environment`, `use-environment-detail`, status/metrics/events). `useDocumentListSubscription` subscribes to **all** document changes with no filter.
- A `GlobalRefreshIndicator` — a thin top progress bar driven by `useIsFetching` + `useIsMutating`.
- Next.js API routes acting as a BFF for **global/public** data: `app/api/registry/*` (packages/versions/tags/manifest) and `app/api/builder-teams`.

## Decisions (from brainstorming)

- **Architecture:** Harden React Query (client-only). Keep per-feature hooks; add a coordination layer on top. **Not** a separate store (Zustand) and **not** a server-side BFF cache with per-user Switchboard WS — the latter was considered and rejected because Switchboard auth is per-user (per-DID bearer token), so a server cache would need a stateful per-user session tier that fights Next.js's stateless/multi-instance model and duplicates what Switchboard already is.
- **Freshness model:** Hybrid — prefetch all user-scoped domains on boot (skeletons until data lands), keep persisted state on return, then background-refresh.
- **Scope:** All user-scoped domains — profile & teams, cloud environments, packages (the full signed-in set).
- **Refresh triggers:** tab refocus, app reopen/reload, and "been away a while" (threshold-gated). No manual refresh button (YAGNI; trivial to add later).
- **Build ID for cache-busting:** `package.json` version. Limitation accepted: only busts when the version is bumped, so releases should bump the version. Switchable to a git SHA later if CI is wired.

## Architecture

A single client-side **App State layer** mounted under the existing `QueryClientProvider`. It does not replace React Query or any feature hook — those keep hitting the cache unchanged. It adds coordination on top.

```
QueryClientProvider (persisted cache — exists)
└─ AppStateCoordinator        ← prefetch on boot, refresh on triggers, owns the global WS
   ├─ SyncStatusProvider      ← derives status + lastSyncedAt
   ├─ GlobalRefreshIndicator  ← top bar (exists) + new status chip
   └─ app…
```

Five workstreams: **(A) domain registry**, **(B) coordinator**, **(C) sync status + indicator**, **(D) deploy cache-bust**, **(E) identity-reset hardening**.

### (A) Domain registry — `modules/shared/state/domains.ts`

A declarative inventory of every app-wide domain. **Reuses existing key factories and fetchers — no duplication.**

```ts
interface DomainContext { did?: string; address?: string }

interface StateDomain {
  id: string                 // 'viewer' | 'my-teams' | 'environments' | 'packages'
  label: string              // for the status tooltip
  requiresIdentity: boolean  // skip prefetch until DID/address resolves
  wsBacked: boolean          // true → the global Switchboard WS invalidates it
  getKey: (ctx: DomainContext) => QueryKey       // reuse queryKeys.* / ['my-teams', …]
  fetcher: (ctx: DomainContext) => () => Promise<unknown>  // reuse existing fetchers
  staleTime?: number
}

export const STATE_DOMAINS: StateDomain[] = [ /* viewer, my-teams, environments, packages, … */ ]
```

This is the single source of truth for "what is app state." Adding a domain is one entry. Each entry must reuse the feature's existing key factory and fetcher so keys never drift from what the hooks use.

`wsBacked` is `true` for Switchboard-document-backed data (environments, viewer) and `false` for API-route data (packages, builder-teams) since those are not Switchboard documents and the `documentChanges` WS won't observe them.

### (B) Coordinator — `modules/shared/state/app-state-coordinator.tsx`

A `'use client'` provider mounted inside `QueryClientProvider`. Reads `did`/`address` from `@powerhousedao/reactor-browser`. Responsibilities:

- **Boot prefetch.** Once identity resolves (public domains immediately), `queryClient.prefetchQuery({ queryKey, queryFn, staleTime })` for each applicable domain. Because the persisted cache hydrates first, this is a background revalidation behind already-visible data — not a blank-screen wait. Failures are swallowed (each page keeps its own `useQuery` error state).
- **WS push (real-time freshness).** One `useDocumentListSubscription` in the coordinator. On any `documentChanges` event, run a debounced `invalidateQueries` for all `wsBacked` domains. This is the primary freshness mechanism for Switchboard-backed data. Existing per-hook cloud subscriptions can remain (harmless) or be simplified later; not required for this change.
- **Been-away refresh.** A `visibilitychange` listener records `hiddenAt`. On return to visible, if `now - hiddenAt > AWAY_THRESHOLD` (proposed **60s**), run a coordinated `refreshAll()`. This covers the "tab refocus" + "been away a while" triggers while avoiding spam on quick tab flicks.
- **App reopen/reload.** Covered by boot prefetch (persisted state shows instantly, prefetch revalidates).
- **`refreshAll()`.** Invalidates all registered domain keys for the current context. Exposed via a hook (`useAppRefresh`) so the status chip — or a future manual button — can call it.
- **Offline handling.** When `navigator.onLine` is false, skip `refreshAll`; subscribe to the `online` event to trigger one refresh on reconnect.

### (C) Sync status + indicator — `modules/shared/state/sync-status.tsx`

`useSyncStatus()` derives a status from:

- `useIsFetching` scoped (via predicate) to registered domain keys,
- `useIsMutating`,
- `navigator.onLine`,
- a `lastSyncedAt` timestamp updated when a `refreshAll` settles.

States: `refreshing` | `up-to-date` | `offline` | `error` (`error` when a registered query is in error and not currently fetching).

UI:

- Keep the existing top progress bar (`GlobalRefreshIndicator`) for the `refreshing` state.
- Add a small **status chip** in the navbar — `modules/shared/components/ui/sync-status-chip.tsx`: a colored dot + label ("Up to date" / "Refreshing…" / "Offline"), with the last-synced relative time in a tooltip. No manual refresh button for now (YAGNI).

### (D) Deploy cache-bust — `next.config.ts` + `query-client.ts`

Root cause of "stale after deploy": `CACHE_BUSTER` is a hand-bumped `'v1'`. Fix: derive it from the app version so the persisted blob is dropped whenever the version changes.

```ts
// next.config.ts — expose the version at build time
env: { NEXT_PUBLIC_BUILD_ID: <package.json version> }

// query-client.ts
export const CACHE_BUSTER = process.env.NEXT_PUBLIC_BUILD_ID ?? 'dev'
```

The `PersistQueryClientProvider` `buster` already discards the localStorage blob when this string changes, so a version bump on release clears stale persisted caches for everyone.

**Limitation (accepted):** only busts on version bumps; deploys without a version change won't bust. Releases should bump `package.json` version. Switchable to a git commit SHA via Docker build arg later if CI is wired.

### (E) Identity-reset hardening — `query-client-provider.tsx`

Root cause of "leftover from previous user": `CacheIdentityGuard` seeds `prevDid` on first load and skips clearing. If the persisted cache belonged to user A and the session then resolves as user B, DID-scoped keys are safe (different key = cache miss) but **non-DID-scoped** entries (packages, public builder-teams, anything without a DID in the key) linger and can read as A's state.

Fix: persist a `vetra-rq-identity` marker (the last-known DID) in localStorage. On boot, before trusting hydration, compare it to the resolved DID; on mismatch, `queryClient.clear()` + `persister.removeClient()` and update the marker. This closes the non-scoped-key gap while keeping the existing on-change clear for live identity switches. Also handle the logout transition (`did: defined → undefined`) explicitly.

## Module / file layout

```
modules/shared/state/
  domains.ts                  # (A) registry
  app-state-coordinator.tsx   # (B) provider: prefetch + triggers + WS + refreshAll
  sync-status.tsx             # (C) context + useSyncStatus hook
  use-app-refresh.ts          # (B/C) exposes refreshAll() to UI
  index.ts                    # barrel exports
modules/shared/components/ui/
  global-refresh-indicator.tsx # (C) keep top bar
  sync-status-chip.tsx         # (C) new navbar chip
modules/shared/providers/query-client/
  query-client.ts             # (D) CACHE_BUSTER from build id
  query-client-provider.tsx   # (E) hardened identity reset
next.config.ts                # (D) NEXT_PUBLIC_BUILD_ID from package.json version
app/layout.tsx                # mount AppStateCoordinator inside QueryClientProvider
```

## Testing

Following existing Vitest patterns (`modules/cloud/__tests__/use-optimistic-mutation.test.tsx`, `modules/profile/__tests__/use-my-teams.test.tsx`):

- Registry completeness — every domain has a `getKey` and `fetcher`; keys match the feature hooks' keys.
- `refreshAll()` invalidates exactly the registered domain keys for a given context.
- Been-away threshold logic — mocked `visibilitychange` + timestamps: no refresh under threshold, refresh over it.
- Identity-mismatch on boot clears cache + persister; matching identity does not.
- `CACHE_BUSTER` derives from `NEXT_PUBLIC_BUILD_ID` and falls back to `'dev'`.
- Sync-status derivation — `refreshing` while fetching, `up-to-date` when idle, `offline` when `navigator.onLine` is false, `error` on a failed registered query.

## Error handling

- Prefetch failures are swallowed; pages render their own `useQuery` error/loading UI.
- Skeleton/placeholder cards render while `isLoading && !data` on the registered domains' pages. Most list pages already have loading states; ensuring envs/teams/packages do is light per-page work (a checklist item, not a redesign).
- Offline pauses `refreshAll`; an `online` event triggers a single refresh on reconnect.

## Out of scope

- Server-side BFF cache with per-user Switchboard WS (rejected — see Decisions).
- A separate global store library (Zustand/Redux).
- Manual "refresh all" button (deferred; trivial to add to the chip later).
- Migrating cloud per-hook subscriptions to the global one (optional cleanup, not required).
