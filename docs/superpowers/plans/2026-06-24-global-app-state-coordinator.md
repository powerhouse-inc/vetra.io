# Global App-State Coordinator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a client-side coordination layer over the existing React Query cache so app data is prefetched on boot, kept fresh on return, auto-busted on deploy, fully reset on identity change, and surfaced via a small sync-status indicator.

**Architecture:** A thin `AppStateCoordinator` provider mounts under the existing `QueryClientProvider`. It (1) warms the cache by mounting existing data hooks at the root (React Query dedupes by key, so every page reads warm data), (2) owns one global Switchboard WS subscription that invalidates coordinated query-key prefixes, (3) refreshes everything when the user returns after being away, and (4) exposes sync status + `refreshAll()` via context to a fixed-position status chip. Feature hooks are untouched. Two independent hardening changes — version-based cache-bust and boot-time identity reset — fix the deploy/identity staleness.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, `@tanstack/react-query` + `react-query-persist-client`, `@powerhousedao/reactor-browser` (`useRenownAuth`, `useDid`), `graphql-ws`, Vitest (`npm run test:unit`, happy-dom).

## Global Constraints

- Unit tests live under `modules/**/__tests__/**/*.test.{ts,tsx}` and run with `npm run test:unit` (config `vitest.unit.config.ts`, env `happy-dom`, `globals: true`). Import `describe/it/expect/vi` explicitly (matches existing tests).
- File/dir naming: kebab-case files, PascalCase components, camelCase functions. Use `type` keyword for type-only imports.
- Per-user query keys embed identity already (`modules/cloud/query/keys.ts`); do NOT change existing key shapes.
- Do NOT replace React Query or modify feature hooks' fetch logic. Coordination is additive.
- Path aliases: `@/shared/*` → `modules/shared/*`, `@/*` → repo root.
- Reuse existing hooks/fetchers — no duplicated fetchers or query keys (DRY).
- Packages are server-rendered (`app/packages/page.tsx`); they are OUT of the client coordinator scope.
- Commit after each task. Co-author trailer:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

## File Structure

```
modules/shared/state/
  sync-status-logic.ts        # CREATE — pure: types, COORDINATED_KEY_PREFIXES, deriveSyncStatus, shouldRefreshAfterAway
  identity-reset.ts           # CREATE — pure: IDENTITY_MARKER_KEY, shouldClearForIdentity, read/writeIdentityMarker
  app-state-coordinator.tsx   # CREATE — provider: warmers + global WS + visibility + context (status, lastSyncedAt, refreshAll)
  index.ts                    # CREATE — barrel exports
  __tests__/
    sync-status-logic.test.ts # CREATE
    identity-reset.test.ts     # CREATE
modules/shared/components/ui/
  sync-status-chip.tsx        # CREATE — fixed-position chip consuming useAppState()
modules/shared/providers/query-client/
  query-client.ts             # MODIFY — CACHE_BUSTER from NEXT_PUBLIC_BUILD_ID
  query-client-provider.tsx   # MODIFY — boot identity-reset using identity-reset.ts
next.config.ts                # MODIFY — inject NEXT_PUBLIC_BUILD_ID from package.json version
app/layout.tsx                # MODIFY — wrap app in <AppStateCoordinator>, mount <SyncStatusChip/>
```

---

### Task 1: Version-based cache-bust on deploy

**Files:**
- Modify: `next.config.ts`
- Modify: `modules/shared/providers/query-client/query-client.ts:10` (the `CACHE_BUSTER` constant)

**Interfaces:**
- Produces: `CACHE_BUSTER: string` (now env-derived) — already consumed by `query-client-provider.tsx` `persistOptions.buster`. No signature change.

- [ ] **Step 1: Inject the version into the client bundle via `next.config.ts`**

Add a top-level import and an `env` key. The version is read from `package.json` at config-load (Node context), exposed as a public env var so it reaches the browser bundle.

In `next.config.ts`, after the existing imports add:

```ts
import pkg from './package.json' with { type: 'json' }
```

Then add an `env` property to the `nextConfig` object (place it right after `outputFileTracingRoot: projectRoot,`):

```ts
  // Exposes the app version to the client so the persisted React Query cache
  // is auto-busted on every release that bumps package.json's version.
  env: {
    NEXT_PUBLIC_BUILD_ID: pkg.version,
  },
```

- [ ] **Step 2: Derive `CACHE_BUSTER` from the build id**

In `modules/shared/providers/query-client/query-client.ts`, replace:

```ts
export const CACHE_BUSTER = 'v1'
```

with:

```ts
/**
 * Cache-bust key for the persisted localStorage blob. Sourced from the app
 * version at build time (`NEXT_PUBLIC_BUILD_ID`), so every release that bumps
 * `package.json`'s version discards stale persisted caches for all users.
 * Falls back to 'dev' outside a build (tests / unconfigured env).
 *
 * Note: only changes when the version is bumped — bump `package.json` on
 * release. Switchable to a git commit SHA later via a Docker build arg.
 */
export const CACHE_BUSTER = process.env.NEXT_PUBLIC_BUILD_ID ?? 'dev'
```

- [ ] **Step 3: Verify typecheck passes**

Run: `npm run tsc`
Expected: exits 0, no errors. (Confirms the JSON import assertion `with { type: 'json' }` is accepted by the TS config and `pkg.version` types resolve.)

- [ ] **Step 4: Verify the value is wired (build-config smoke check)**

Run: `node -e "import('./package.json', { with: { type: 'json' } }).then(m => console.log(m.default.version))"`
Expected: prints `0.1.0` (the value that will populate `NEXT_PUBLIC_BUILD_ID`).

- [ ] **Step 5: Commit**

```bash
git add next.config.ts modules/shared/providers/query-client/query-client.ts
git commit -m "fix(state): auto-bust persisted cache from app version

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Boot-time identity-reset hardening

Closes the "leftover from previous user" gap: on first load `CacheIdentityGuard` seeds and skips clearing, so non-DID-scoped persisted entries from a previous user can linger. We persist a last-known-DID marker and clear the cache on boot when it mismatches the resolved identity.

**Files:**
- Create: `modules/shared/state/identity-reset.ts`
- Create: `modules/shared/state/__tests__/identity-reset.test.ts`
- Modify: `modules/shared/providers/query-client/query-client-provider.tsx` (the `CacheIdentityGuard` component)

**Interfaces:**
- Produces:
  - `IDENTITY_MARKER_KEY: string`
  - `shouldClearForIdentity(storedDid: string | null, currentDid: string | null): boolean`
  - `readIdentityMarker(): string | null`
  - `writeIdentityMarker(did: string | null): void`

- [ ] **Step 1: Write the failing test**

Create `modules/shared/state/__tests__/identity-reset.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import {
  IDENTITY_MARKER_KEY,
  shouldClearForIdentity,
  readIdentityMarker,
  writeIdentityMarker,
} from '@/shared/state/identity-reset'

describe('shouldClearForIdentity', () => {
  it('clears when a stored identity differs from the resolved one', () => {
    expect(shouldClearForIdentity('did:a', 'did:b')).toBe(true)
  })

  it('does not clear when identities match', () => {
    expect(shouldClearForIdentity('did:a', 'did:a')).toBe(false)
  })

  it('does not clear on a fresh browser (no stored identity)', () => {
    expect(shouldClearForIdentity(null, 'did:b')).toBe(false)
  })

  it('does not clear while the current identity is still resolving', () => {
    expect(shouldClearForIdentity('did:a', null)).toBe(false)
  })
})

describe('identity marker storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('round-trips a did', () => {
    writeIdentityMarker('did:a')
    expect(readIdentityMarker()).toBe('did:a')
    expect(localStorage.getItem(IDENTITY_MARKER_KEY)).toBe('did:a')
  })

  it('reads null when unset', () => {
    expect(readIdentityMarker()).toBeNull()
  })

  it('removes the marker when written with null', () => {
    writeIdentityMarker('did:a')
    writeIdentityMarker(null)
    expect(readIdentityMarker()).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:unit -- identity-reset`
Expected: FAIL — cannot resolve `@/shared/state/identity-reset`.

- [ ] **Step 3: Write the implementation**

Create `modules/shared/state/identity-reset.ts`:

```ts
/**
 * Boot-time identity guard for the persisted React Query cache.
 *
 * Per-user query keys embed the DID, so a different user can't *read* the
 * previous user's entries — but non-DID-scoped entries (and the persisted
 * localStorage blob as a whole) can linger across an account switch that
 * happens between sessions. We persist the last-known DID and, on boot,
 * clear the cache when it no longer matches the resolved identity.
 */

/** localStorage key holding the last-known signed-in DID. */
export const IDENTITY_MARKER_KEY = 'vetra-rq-identity'

/**
 * True when the cache should be cleared for an identity mismatch.
 *
 * - No stored marker (fresh browser): keep — nothing to leak.
 * - Current still resolving (null): keep — decide once identity settles.
 * - Stored differs from current: clear.
 */
export function shouldClearForIdentity(
  storedDid: string | null,
  currentDid: string | null,
): boolean {
  if (storedDid === null) return false
  if (currentDid === null) return false
  return storedDid !== currentDid
}

/** Reads the persisted identity marker (SSR-safe). */
export function readIdentityMarker(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(IDENTITY_MARKER_KEY)
}

/** Writes (or, with `null`, removes) the persisted identity marker (SSR-safe). */
export function writeIdentityMarker(did: string | null): void {
  if (typeof window === 'undefined') return
  if (did === null) {
    window.localStorage.removeItem(IDENTITY_MARKER_KEY)
    return
  }
  window.localStorage.setItem(IDENTITY_MARKER_KEY, did)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:unit -- identity-reset`
Expected: PASS (7 tests).

- [ ] **Step 5: Wire the boot reset into `CacheIdentityGuard`**

In `modules/shared/providers/query-client/query-client-provider.tsx`:

Add to the import block (after the existing `./query-client` import):

```ts
import {
  shouldClearForIdentity,
  readIdentityMarker,
  writeIdentityMarker,
} from '@/shared/state/identity-reset'
```

Replace the body of the `CacheIdentityGuard` `useEffect` so the seeding pass performs a boot reset and the marker is kept in sync. Replace this block:

```ts
  useEffect(() => {
    if (!seeded.current) {
      seeded.current = true
      prevDid.current = did
      return
    }
    if (did !== prevDid.current) {
      prevDid.current = did
      queryClient.clear()
      void persister.removeClient()
    }
  }, [did, queryClient])
```

with:

```ts
  useEffect(() => {
    if (!seeded.current) {
      seeded.current = true
      prevDid.current = did
      // Boot reset: if the persisted cache belonged to a different DID than
      // the one resolving now, drop it so no previous-user data lingers.
      if (shouldClearForIdentity(readIdentityMarker(), did ?? null)) {
        queryClient.clear()
        void persister.removeClient()
      }
      if (did) writeIdentityMarker(did)
      return
    }
    if (did !== prevDid.current) {
      prevDid.current = did
      queryClient.clear()
      void persister.removeClient()
      writeIdentityMarker(did ?? null)
    }
  }, [did, queryClient])
```

- [ ] **Step 6: Verify typecheck + tests pass**

Run: `npm run tsc && npm run test:unit -- identity-reset`
Expected: tsc exits 0; tests PASS.

- [ ] **Step 7: Commit**

```bash
git add modules/shared/state/identity-reset.ts modules/shared/state/__tests__/identity-reset.test.ts modules/shared/providers/query-client/query-client-provider.tsx
git commit -m "fix(state): clear persisted cache on boot identity mismatch

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Sync-status + coordination pure logic

Pure, React-free functions and constants the coordinator and chip build on. Isolating them makes the behavior unit-testable without rendering.

**Files:**
- Create: `modules/shared/state/sync-status-logic.ts`
- Create: `modules/shared/state/__tests__/sync-status-logic.test.ts`

**Interfaces:**
- Produces:
  - `type SyncStatus = 'up-to-date' | 'refreshing' | 'offline' | 'error'`
  - `COORDINATED_KEY_PREFIXES: readonly (readonly [string])[]` — `[['builder-account'], ['my-teams'], ['environments'], ['viewer']]`
  - `AWAY_THRESHOLD_MS: number` — `60_000`
  - `deriveSyncStatus(input: { activeCount: number; online: boolean; hasError: boolean }): SyncStatus`
  - `shouldRefreshAfterAway(hiddenAt: number | null, now: number, thresholdMs: number): boolean`
  - `isCoordinatedKey(queryKey: readonly unknown[]): boolean`

- [ ] **Step 1: Write the failing test**

Create `modules/shared/state/__tests__/sync-status-logic.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  deriveSyncStatus,
  shouldRefreshAfterAway,
  isCoordinatedKey,
  COORDINATED_KEY_PREFIXES,
  AWAY_THRESHOLD_MS,
} from '@/shared/state/sync-status-logic'

describe('deriveSyncStatus', () => {
  it('reports offline first, regardless of fetching', () => {
    expect(deriveSyncStatus({ activeCount: 3, online: false, hasError: false })).toBe('offline')
  })

  it('reports refreshing while fetches are active and online', () => {
    expect(deriveSyncStatus({ activeCount: 1, online: true, hasError: true })).toBe('refreshing')
  })

  it('reports error when idle, online, and something failed', () => {
    expect(deriveSyncStatus({ activeCount: 0, online: true, hasError: true })).toBe('error')
  })

  it('reports up-to-date when idle, online, no error', () => {
    expect(deriveSyncStatus({ activeCount: 0, online: true, hasError: false })).toBe('up-to-date')
  })
})

describe('shouldRefreshAfterAway', () => {
  it('refreshes when away at least the threshold', () => {
    expect(shouldRefreshAfterAway(1_000, 1_000 + AWAY_THRESHOLD_MS, AWAY_THRESHOLD_MS)).toBe(true)
  })

  it('does not refresh for a quick tab flick under the threshold', () => {
    expect(shouldRefreshAfterAway(1_000, 1_500, AWAY_THRESHOLD_MS)).toBe(false)
  })

  it('does not refresh when never hidden', () => {
    expect(shouldRefreshAfterAway(null, 999_999, AWAY_THRESHOLD_MS)).toBe(false)
  })
})

describe('isCoordinatedKey', () => {
  it('matches a coordinated prefix', () => {
    expect(isCoordinatedKey(['my-teams', '0xabc'])).toBe(true)
    expect(isCoordinatedKey(['environments', 'MINE', null])).toBe(true)
  })

  it('rejects non-coordinated keys', () => {
    expect(isCoordinatedKey(['tenant-secrets', 'env1'])).toBe(false)
    expect(isCoordinatedKey([])).toBe(false)
  })

  it('exposes the expected prefixes', () => {
    expect(COORDINATED_KEY_PREFIXES.map((k) => k[0])).toEqual([
      'builder-account',
      'my-teams',
      'environments',
      'viewer',
    ])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:unit -- sync-status-logic`
Expected: FAIL — cannot resolve `@/shared/state/sync-status-logic`.

- [ ] **Step 3: Write the implementation**

Create `modules/shared/state/sync-status-logic.ts`:

```ts
/**
 * Pure logic for the app-state coordinator and sync-status chip — no React,
 * no side effects, so each rule is unit-testable in isolation.
 */

/** High-level freshness state surfaced to the user. */
export type SyncStatus = 'up-to-date' | 'refreshing' | 'offline' | 'error'

/**
 * Query-key prefixes the coordinator owns: prefetched on boot and/or
 * invalidated together on the coordinated refresh triggers. Each entry is the
 * first element of the relevant React Query key (see modules/cloud/query/keys.ts
 * and the profile hooks). Packages are server-rendered and intentionally absent.
 */
export const COORDINATED_KEY_PREFIXES = [
  ['builder-account'],
  ['my-teams'],
  ['environments'],
  ['viewer'],
] as const

/** How long the tab must be hidden before a return triggers a full refresh. */
export const AWAY_THRESHOLD_MS = 60_000

/** Derives the user-facing status. Offline wins; then refreshing; then error. */
export function deriveSyncStatus(input: {
  activeCount: number
  online: boolean
  hasError: boolean
}): SyncStatus {
  if (!input.online) return 'offline'
  if (input.activeCount > 0) return 'refreshing'
  if (input.hasError) return 'error'
  return 'up-to-date'
}

/** True when the tab was hidden for at least `thresholdMs` before returning. */
export function shouldRefreshAfterAway(
  hiddenAt: number | null,
  now: number,
  thresholdMs: number,
): boolean {
  if (hiddenAt === null) return false
  return now - hiddenAt >= thresholdMs
}

/** True when a query key starts with one of the coordinated prefixes. */
export function isCoordinatedKey(queryKey: readonly unknown[]): boolean {
  const head = queryKey[0]
  if (typeof head !== 'string') return false
  return COORDINATED_KEY_PREFIXES.some((prefix) => prefix[0] === head)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:unit -- sync-status-logic`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add modules/shared/state/sync-status-logic.ts modules/shared/state/__tests__/sync-status-logic.test.ts
git commit -m "feat(state): add sync-status + coordination pure logic

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: AppStateCoordinator provider

The provider that warms the cache on boot, owns the global WS, runs the been-away refresh, tracks `lastSyncedAt`, and exposes everything via `useAppState()`.

**Files:**
- Create: `modules/shared/state/app-state-coordinator.tsx`
- Create: `modules/shared/state/index.ts`

**Interfaces:**
- Consumes:
  - `deriveSyncStatus`, `shouldRefreshAfterAway`, `isCoordinatedKey`, `COORDINATED_KEY_PREFIXES`, `AWAY_THRESHOLD_MS`, `type SyncStatus` from `./sync-status-logic`
  - `useBuilderAccount(address: string | null | undefined)` from `@/modules/profile/lib/use-builder-account`
  - `useMyTeams(address: string | undefined)` from `@/modules/profile/lib/use-my-teams`
  - `useDocumentListSubscription(onEvent: () => void)` from `@/modules/cloud/hooks/use-document-subscription`
  - `useRenownAuth` from `@powerhousedao/reactor-browser`
  - React Query: `useQueryClient`, `useIsFetching`, `useIsMutating`
- Produces:
  - `AppStateCoordinator: (props: { children: ReactNode }) => JSX.Element`
  - `useAppState(): { status: SyncStatus; lastSyncedAt: number | null; refreshAll: () => void }`

- [ ] **Step 1: Write the implementation**

Create `modules/shared/state/app-state-coordinator.tsx`:

```tsx
'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { useRenownAuth } from '@powerhousedao/reactor-browser'
import { useIsFetching, useIsMutating, useQueryClient } from '@tanstack/react-query'
import { useBuilderAccount } from '@/modules/profile/lib/use-builder-account'
import { useMyTeams } from '@/modules/profile/lib/use-my-teams'
import { useDocumentListSubscription } from '@/modules/cloud/hooks/use-document-subscription'
import {
  AWAY_THRESHOLD_MS,
  COORDINATED_KEY_PREFIXES,
  deriveSyncStatus,
  isCoordinatedKey,
  shouldRefreshAfterAway,
  type SyncStatus,
} from './sync-status-logic'

interface AppStateValue {
  status: SyncStatus
  lastSyncedAt: number | null
  refreshAll: () => void
}

const AppStateContext = createContext<AppStateValue | null>(null)

/** Returns the connected address once authorized, else null. */
function useViewerAddress(): string | null {
  const auth = useRenownAuth()
  return auth.status === 'authorized' ? (auth.address ?? null) : null
}

/**
 * Invisible cache-warmer: mounting these existing hooks at the app root keeps
 * the user's cross-page data warm. React Query dedupes by key, so a page that
 * later mounts the same hook reads the warm cache instead of cold-fetching.
 * Each hook self-guards on `enabled`, so they no-op until identity resolves.
 *
 * Environments are intentionally not warmed here — they are cloud-only UI with
 * their own WS subscription + polling, and warming them globally would open a
 * redundant socket and fetch on every page. They are still kept fresh by the
 * coordinated refresh/WS below.
 */
function CacheWarmers({ address }: { address: string | null }) {
  useBuilderAccount(address)
  useMyTeams(address ?? undefined)
  return null
}

export function AppStateCoordinator({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const address = useViewerAddress()

  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null)
  const [online, setOnline] = useState(true)

  // Aggregate fetching/mutating across only the coordinated queries.
  const activeCount =
    useIsFetching({ predicate: (q) => isCoordinatedKey(q.queryKey) }) + useIsMutating()

  const hasError =
    useIsFetching({
      predicate: (q) => isCoordinatedKey(q.queryKey) && q.state.status === 'error',
    }) > 0

  const refreshAll = useCallback(() => {
    for (const prefix of COORDINATED_KEY_PREFIXES) {
      void queryClient.invalidateQueries({ queryKey: prefix })
    }
    setLastSyncedAt(Date.now())
  }, [queryClient])

  // Stamp lastSyncedAt whenever coordinated fetching settles to idle.
  const prevActive = useRef(activeCount)
  useEffect(() => {
    if (prevActive.current > 0 && activeCount === 0) {
      setLastSyncedAt(Date.now())
    }
    prevActive.current = activeCount
  }, [activeCount])

  // Online/offline tracking (seed from the live value on mount).
  useEffect(() => {
    setOnline(navigator.onLine)
    const goOnline = () => {
      setOnline(true)
      refreshAll()
    }
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [refreshAll])

  // Been-away refresh: refresh everything when returning after the threshold.
  useEffect(() => {
    const hiddenAt = { current: null as number | null }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now()
        return
      }
      if (shouldRefreshAfterAway(hiddenAt.current, Date.now(), AWAY_THRESHOLD_MS)) {
        refreshAll()
      }
      hiddenAt.current = null
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [refreshAll])

  // Global WS push: any Switchboard document change invalidates coordinated
  // queries, so profile/teams get real-time refresh (they had none before).
  useDocumentListSubscription(() => {
    for (const prefix of COORDINATED_KEY_PREFIXES) {
      void queryClient.invalidateQueries({ queryKey: prefix })
    }
  })

  const status = useMemo(
    () => deriveSyncStatus({ activeCount, online, hasError }),
    [activeCount, online, hasError],
  )

  const value = useMemo<AppStateValue>(
    () => ({ status, lastSyncedAt, refreshAll }),
    [status, lastSyncedAt, refreshAll],
  )

  return (
    <AppStateContext.Provider value={value}>
      <CacheWarmers address={address} />
      {children}
    </AppStateContext.Provider>
  )
}

/** Reads the coordinated app-state context. Returns null outside the provider. */
export function useAppState(): AppStateValue | null {
  return useContext(AppStateContext)
}
```

- [ ] **Step 2: Create the barrel**

Create `modules/shared/state/index.ts`:

```ts
export { AppStateCoordinator, useAppState } from './app-state-coordinator'
export {
  deriveSyncStatus,
  shouldRefreshAfterAway,
  isCoordinatedKey,
  COORDINATED_KEY_PREFIXES,
  AWAY_THRESHOLD_MS,
  type SyncStatus,
} from './sync-status-logic'
```

- [ ] **Step 3: Verify typecheck passes**

Run: `npm run tsc`
Expected: exits 0. (Confirms hook signatures match: `useBuilderAccount(address)`, `useMyTeams(address)`, `useDocumentListSubscription(cb)`, and `useRenownAuth().address`/`.status`.)

- [ ] **Step 4: Verify existing tests still pass**

Run: `npm run test:unit`
Expected: all PASS (no regressions; new module has no test of its own — its logic is covered by Task 3, integration is verified in Task 6).

- [ ] **Step 5: Commit**

```bash
git add modules/shared/state/app-state-coordinator.tsx modules/shared/state/index.ts
git commit -m "feat(state): add AppStateCoordinator provider

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Sync-status chip + layout wiring

Surface the status to the user and mount the coordinator so the whole app is covered.

**Files:**
- Create: `modules/shared/components/ui/sync-status-chip.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: `useAppState` from `@/shared/state`
- Produces: `SyncStatusChip: () => JSX.Element | null`

- [ ] **Step 1: Write the chip component**

Create `modules/shared/components/ui/sync-status-chip.tsx`:

```tsx
'use client'

import { useAppState, type SyncStatus } from '@/shared/state'

const LABELS: Record<SyncStatus, string> = {
  'up-to-date': 'Up to date',
  refreshing: 'Refreshing…',
  offline: 'Offline',
  error: 'Sync error',
}

const DOT: Record<SyncStatus, string> = {
  'up-to-date': 'bg-emerald-500',
  refreshing: 'bg-primary animate-pulse',
  offline: 'bg-muted-foreground',
  error: 'bg-destructive',
}

function syncedAgo(lastSyncedAt: number | null): string {
  if (lastSyncedAt === null) return 'Not synced yet'
  const secs = Math.round((Date.now() - lastSyncedAt) / 1000)
  if (secs < 5) return 'Synced just now'
  if (secs < 60) return `Synced ${secs}s ago`
  return `Synced ${Math.round(secs / 60)}m ago`
}

/**
 * Small fixed-position chip showing whether app data is fresh. Unobtrusive:
 * pinned bottom-right, summarizes the coordinated sync state. Renders nothing
 * until the coordinator context is available.
 */
export function SyncStatusChip() {
  const state = useAppState()
  if (!state) return null

  return (
    <div
      className="bg-background/80 text-muted-foreground pointer-events-none fixed right-3 bottom-3 z-[90] flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs shadow-sm backdrop-blur"
      title={syncedAgo(state.lastSyncedAt)}
      role="status"
      aria-live="polite"
    >
      <span className={`size-2 rounded-full ${DOT[state.status]}`} />
      {LABELS[state.status]}
    </div>
  )
}
```

- [ ] **Step 2: Mount the coordinator and chip in `app/layout.tsx`**

Add to the import block (after the `GlobalRefreshIndicator` import at line 8):

```ts
import { SyncStatusChip } from '@/modules/shared/components/ui/sync-status-chip'
import { AppStateCoordinator } from '@/modules/shared/state'
```

Then wrap the existing `QueryClientProvider` children with `<AppStateCoordinator>` and add the chip. Replace:

```tsx
            <QueryClientProvider>
              <GlobalRefreshIndicator />
              <RenownProvider appName="vetra" url={process.env.NEXT_PUBLIC_RENOWN_URL} />
              <CloudAuthBridge />
              <PostLoginRedirect />
              <div className="items-right flex min-h-screen flex-col">
                <Navbar />
                <main className="flex-1">{children}</main>
                <Footer />
              </div>
              <Toaster />
            </QueryClientProvider>
```

with:

```tsx
            <QueryClientProvider>
              <AppStateCoordinator>
                <GlobalRefreshIndicator />
                <SyncStatusChip />
                <RenownProvider appName="vetra" url={process.env.NEXT_PUBLIC_RENOWN_URL} />
                <CloudAuthBridge />
                <PostLoginRedirect />
                <div className="items-right flex min-h-screen flex-col">
                  <Navbar />
                  <main className="flex-1">{children}</main>
                  <Footer />
                </div>
                <Toaster />
              </AppStateCoordinator>
            </QueryClientProvider>
```

- [ ] **Step 3: Verify typecheck passes**

Run: `npm run tsc`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add modules/shared/components/ui/sync-status-chip.tsx app/layout.tsx
git commit -m "feat(state): mount coordinator + sync-status chip in layout

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Typecheck**

Run: `npm run tsc`
Expected: exits 0, no errors.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors. (If `react-hooks/refs` or `set-state-in-effect` warnings appear in `app-state-coordinator.tsx`, add the same targeted `// eslint-disable-next-line` comments used in `query-client-provider.tsx` / `use-environment.ts`, then re-run.)

- [ ] **Step 3: Unit tests**

Run: `npm run test:unit`
Expected: all PASS, including the new `identity-reset` (7) and `sync-status-logic` (10) suites, and the pre-existing suites with no regressions.

- [ ] **Step 4: Production build**

Run: `npm run build`
Expected: build succeeds; `NEXT_PUBLIC_BUILD_ID` is inlined. (Catches any SSR/client boundary issues from the new provider.)

- [ ] **Step 5: Manual smoke (optional, recommended)**

Run: `npm run dev`, open the app signed-in. Verify: bottom-right chip shows "Refreshing…" on load then "Up to date"; navigating between profile/teams shows data without a cold spinner; switching tabs away >60s and back triggers a brief "Refreshing…".

- [ ] **Step 6: Final commit (if any lint fixups were made)**

```bash
git add -A
git commit -m "chore(state): lint/verify global app-state coordinator

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Notes on spec deviations (deliberate)

- **Packages dropped from the coordinator.** Discovery showed `app/packages/page.tsx` server-renders package data per request (no client query), so it's already fresh on navigation. Including it would add nothing. (Spec listed packages under scope; this refines it.)
- **Registry realized as warmers + key prefixes.** Rather than a registry of duplicated fetchers (which would re-plumb auth tokens and risk key drift), the coordinator reuses the real hooks as cache-warmers and coordinates by query-key prefix. Same intent, lower risk, DRY.
- **Environments warmed lazily, not at boot.** Cloud-only UI with its own WS + polling; warming globally would open a redundant socket on every page. Still kept fresh via coordinated refresh + the global WS. Easy to add to `CacheWarmers` later if eager boot-fetch is wanted.
- **Chip is fixed-position, not in the navbar.** Self-contained, avoids navbar layout edits; lower risk. Can be relocated into `navbar-right-side.tsx` later.
