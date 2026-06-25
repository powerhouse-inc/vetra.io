# WS-Driven Single-Source State (SP1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make pages instant and eliminate idle polling — one WS signal drives a debounced, active-only refresh of a single shared cache; pages warm via intent-prefetch.

**Architecture:** Keep React Query (persisted) as the single source of truth. The coordinator's one `documentChanges` WS becomes a *debounced, active-only* invalidation signal; per-query idle polling is removed; queries share `queryOptions`-style descriptors reused by hooks and by an intent-prefetch hook wired into the nav.

**Tech Stack:** Next.js 16, React 19, TanStack Query v5, graphql-ws, `@powerhousedao/reactor-browser`, Vitest (`npm run test:unit`, happy-dom).

## Global Constraints

- Unit tests under `modules/**/__tests__/**/*.test.{ts,tsx}`, run `npm run test:unit`. Import `describe/it/expect/vi` explicitly.
- Pre-push gate (CI "Lint and Types Checks" includes prettier): `npm run tsc && npm run lint && npm run format:check && npm run test:unit`.
- Commit style: small incremental commits, **no `Co-Authored-By` trailer**.
- Coordinated key prefixes (final): `builder-account`, `my-teams`, `studio-products`, `environments`, `viewer`.
- WS debounce window: **750ms**. Invalidate with `refetchType: 'active'`.
- Do not change query-key shapes (`modules/cloud/query/keys.ts`).

## File Structure

```
modules/shared/lib/debounce.ts                    # NEW: createDebouncer (pure, testable)
modules/cloud/studio/studio-readiness.ts          # studioPollIntervalMs → number|false (false when idle)
modules/shared/state/sync-status-logic.ts         # add 'studio-products' coordinated key
modules/cloud/hooks/use-environment.ts            # drop 20s poll + redundant per-hook WS; export env descriptor
modules/cloud/studio/use-studio-products.ts       # export studio descriptor (idle poll already stops via Task 1)
modules/shared/state/route-prefetch.ts            # NEW: ROUTE_PREFETCH map (href → descriptor)
modules/shared/state/use-prefetch-on-intent.ts    # NEW: intent hook returning link handlers
modules/shared/state/app-state-coordinator.tsx    # debounce WS invalidate (active-only)
modules/shared/components/navbar/components/navbar-items-desk.tsx    # spread intent handlers
modules/shared/components/navbar/components/navbar-item-mobile.tsx   # spread intent handlers
```

---

### Task 1: Pure-logic foundations (debounce, idle-stop poll, coordinated key)

**Files:**
- Create: `modules/shared/lib/debounce.ts`, `modules/shared/lib/__tests__/debounce.test.ts`
- Modify: `modules/cloud/studio/studio-readiness.ts` (`studioPollIntervalMs`)
- Modify: `modules/shared/state/sync-status-logic.ts` (add `['studio-products']`)
- Test: `modules/cloud/__tests__/studio-poll-interval.test.ts` (exists), `modules/shared/state/__tests__/sync-status-logic.test.ts` (exists)

**Produces:** `createDebouncer<T extends unknown[]>(fn: (...a:T)=>void, ms:number): { call:(...a:T)=>void; cancel:()=>void }`; `studioPollIntervalMs(...): number | false`.

- [ ] **Step 1: Write failing debounce test** — `modules/shared/lib/__tests__/debounce.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createDebouncer } from '@/shared/lib/debounce'

describe('createDebouncer', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('fires once after the window for a burst of calls', () => {
    const fn = vi.fn()
    const d = createDebouncer(fn, 750)
    d.call(); d.call(); d.call()
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(750)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('cancel prevents a pending fire', () => {
    const fn = vi.fn()
    const d = createDebouncer(fn, 750)
    d.call(); d.cancel()
    vi.advanceTimersByTime(1000)
    expect(fn).not.toHaveBeenCalled()
  })
})
```
- [ ] **Step 2: Run, expect FAIL** — `npm run test:unit -- debounce` (module missing).
- [ ] **Step 3: Implement** — `modules/shared/lib/debounce.ts`:
```ts
/** Trailing-edge debouncer: coalesces a burst of calls into one fire after `ms`. */
export function createDebouncer<T extends unknown[]>(fn: (...args: T) => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined
  return {
    call(...args: T) {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = undefined
        fn(...args)
      }, ms)
    },
    cancel() {
      if (timer) clearTimeout(timer)
      timer = undefined
    },
  }
}
```
- [ ] **Step 4: Run, expect PASS** — `npm run test:unit -- debounce`.
- [ ] **Step 5: studioPollIntervalMs → idle-stop.** Edit `studio-readiness.ts`: change return type to `number | false` and return `false` (not `SLOW_STUDIO_POLL_MS`) when nothing is booting:
```ts
export function studioPollIntervalMs(
  products: ReadonlyArray<{ status: ProductStatus }> | undefined,
): number | false {
  const anyBooting = (products ?? []).some((p) => p.status !== 'ready')
  return anyBooting ? FAST_STUDIO_POLL_MS : false
}
```
Update `modules/cloud/__tests__/studio-poll-interval.test.ts`: the "all ready" case now expects `false` (was `SLOW_STUDIO_POLL_MS`); booting case still `FAST_STUDIO_POLL_MS`.
- [ ] **Step 6: Add coordinated key.** In `sync-status-logic.ts` add `['studio-products']` after `['my-teams']`. Update `sync-status-logic.test.ts` `toEqual([...])` list and add `isCoordinatedKey(['studio-products','x']) === true`.
- [ ] **Step 7: Run** — `npm run test:unit -- debounce studio-poll-interval sync-status-logic` → all PASS.
- [ ] **Step 8: Commit** — `git add -A && git commit -m "feat(state): debounce util, idle-stop studio poll, studio-products coordinated key"`

---

### Task 2: Drop idle polling + export query descriptors

**Files:**
- Modify: `modules/cloud/hooks/use-environment.ts`
- Modify: `modules/cloud/studio/use-studio-products.ts`

**Consumes:** `studioPollIntervalMs` (now `number|false`).
**Produces:**
- `myEnvironmentsQuery(did, scope): { queryKey: QueryKey; fetch: (token: string|null) => Promise<EnvironmentSummary[]> }`
- `studioProductsQuery(did): { queryKey: QueryKey; fetch: (token: string|null) => Promise<StudioProduct[]> }`

- [ ] **Step 1: use-environment.ts.** Export a descriptor and reuse it in the hook; drop the 20s `refetchInterval` and the redundant per-hook `useDocumentListSubscription` (the coordinator's central WS now drives env freshness). Concretely:
  - Add near the top:
```ts
export function myEnvironmentsQuery(did: string | undefined, scope: ListScope = 'MINE') {
  return {
    queryKey: queryKeys.environments(scope, did),
    fetch: (token: string | null) => fetchMyEnvironments(scope, token),
  }
}
```
  - In `useEnvironments`, replace the `useAuthedQuery(queryKeys.environments(...), (token)=>fetchMyEnvironments(...), { refetchInterval: ENV_REFETCH_INTERVAL, placeholderData })` with the descriptor and **no** `refetchInterval`:
```ts
const q = myEnvironmentsQuery(did, backendScope)
const { data, isError } = useAuthedQuery<EnvironmentSummary[]>(q.queryKey, q.fetch, {
  placeholderData: keepPreviousData,
})
```
  - Delete the `useDocumentListSubscription(() => queryClient.invalidateQueries({ queryKey: ['environments'] }))` block in `useEnvironments` and the now-unused `ENV_REFETCH_INTERVAL` const + `useDocumentListSubscription` import if unused elsewhere in the file. (Keep `useQueryClient` only if still used; remove if not.)
- [ ] **Step 2: use-studio-products.ts.** Export descriptor; hook keeps `useAuthedQuery` with `refetchInterval: (q) => studioPollIntervalMs(q.state.data)` (now returns `false` when idle → polling stops automatically). Add:
```ts
export function studioProductsQuery(did: string | undefined) {
  return {
    queryKey: queryKeys.studioProducts(did),
    fetch: async (token: string | null) => (await fetchMyStudioProducts(token)).map(toStudioProduct),
  }
}
```
  Refactor the existing `useAuthedQuery(productsKey, async (token)=>..., {...})` to call `studioProductsQuery(did)` for `queryKey`/`fetch` (behavior identical).
- [ ] **Step 3: Typecheck** — `npm run tsc` → 0 errors. (Confirms removed imports/consts don't dangle.)
- [ ] **Step 4: Tests** — `npm run test:unit` → no new failures vs baseline (pre-existing: `agent-card`, `use-create-environment`).
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(state): drop idle env/studio polling; export query descriptors"`

---

### Task 3: Debounced, active-only WS invalidation in the coordinator

**Files:** Modify `modules/shared/state/app-state-coordinator.tsx`.

**Consumes:** `createDebouncer`, `COORDINATED_KEY_PREFIXES`.

- [ ] **Step 1: Replace the WS handler** with a debounced, active-only invalidator. Replace:
```tsx
  useDocumentListSubscription(() => {
    for (const prefix of COORDINATED_KEY_PREFIXES) {
      void queryClient.invalidateQueries({ queryKey: prefix })
    }
  })
```
with:
```tsx
  // One WS signal → debounced (coalesce the management-switchboard firehose) →
  // refetch only ACTIVE coordinated queries (the page you're on); idle pages go
  // stale and refresh lazily on next visit. No idle polling anywhere else.
  const wsInvalidate = useMemo(
    () =>
      createDebouncer(() => {
        for (const prefix of COORDINATED_KEY_PREFIXES) {
          void queryClient.invalidateQueries({ queryKey: prefix, refetchType: 'active' })
        }
      }, 750),
    [queryClient],
  )
  useEffect(() => () => wsInvalidate.cancel(), [wsInvalidate])
  useDocumentListSubscription(() => wsInvalidate.call())
```
Add `import { createDebouncer } from '@/shared/lib/debounce'`.
- [ ] **Step 2: Typecheck** — `npm run tsc` → 0.
- [ ] **Step 3: Commit** — `git add -A && git commit -m "feat(state): debounce + active-only WS invalidation"`

---

### Task 4: Intent prefetch wired into the nav

**Files:**
- Create: `modules/shared/state/route-prefetch.ts`, `modules/shared/state/use-prefetch-on-intent.ts`
- Create test: `modules/shared/state/__tests__/route-prefetch.test.ts`
- Modify: `navbar-items-desk.tsx`, `navbar-item-mobile.tsx`

**Consumes:** `myEnvironmentsQuery`, `studioProductsQuery`, `getAuthToken`, `useRenown`, `useDid`, `useQueryClient`.
**Produces:** `usePrefetchOnIntent(href: string): { onMouseEnter; onFocus; onTouchStart } | undefined`.

- [ ] **Step 1: route-prefetch map** — `modules/shared/state/route-prefetch.ts`:
```ts
import type { QueryClient } from '@tanstack/react-query'
import { myEnvironmentsQuery } from '@/modules/cloud/hooks/use-environment'
import { studioProductsQuery } from '@/modules/cloud/studio/use-studio-products'

type PrefetchCtx = { queryClient: QueryClient; did: string | undefined; token: string | null }

/** Maps a nav href to a prefetch action. Only authed/data routes are listed;
 *  RSC routes (packages/builders) rely on Next's built-in Link route-prefetch. */
export const ROUTE_PREFETCH: Record<string, (ctx: PrefetchCtx) => Promise<unknown>> = {
  '/user/products': ({ queryClient, did, token }) => {
    const q = studioProductsQuery(did)
    return queryClient.prefetchQuery({ queryKey: q.queryKey, queryFn: () => q.fetch(token) })
  },
  '/user/environments': ({ queryClient, did, token }) => {
    const q = myEnvironmentsQuery(did)
    return queryClient.prefetchQuery({ queryKey: q.queryKey, queryFn: () => q.fetch(token) })
  },
  '/cloud': ({ queryClient, did, token }) => {
    const q = myEnvironmentsQuery(did)
    return queryClient.prefetchQuery({ queryKey: q.queryKey, queryFn: () => q.fetch(token) })
  },
}

export function hasPrefetch(href: string): boolean {
  return href in ROUTE_PREFETCH
}
```
- [ ] **Step 2: Test the map** — `modules/shared/state/__tests__/route-prefetch.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { ROUTE_PREFETCH, hasPrefetch } from '@/shared/state/route-prefetch'

describe('ROUTE_PREFETCH', () => {
  it('covers the authed data routes', () => {
    expect(hasPrefetch('/user/products')).toBe(true)
    expect(hasPrefetch('/user/environments')).toBe(true)
    expect(hasPrefetch('/cloud')).toBe(true)
  })
  it('ignores RSC/unknown routes', () => {
    expect(hasPrefetch('/packages')).toBe(false)
    expect(hasPrefetch('/builders')).toBe(false)
  })
})
```
Run `npm run test:unit -- route-prefetch` → PASS after Step 1.
- [ ] **Step 3: intent hook** — `modules/shared/state/use-prefetch-on-intent.ts`:
```ts
'use client'
import { useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useDid, useRenown } from '@powerhousedao/reactor-browser'
import { getAuthToken } from '@/modules/cloud/graphql'
import { ROUTE_PREFETCH, hasPrefetch } from './route-prefetch'

/** Returns link handlers that warm a route's data on hover/focus/touch (once). */
export function usePrefetchOnIntent(href: string) {
  const queryClient = useQueryClient()
  const did = useDid()
  const renown = useRenown()
  const done = useRef(false)

  const trigger = useCallback(() => {
    if (done.current || !hasPrefetch(href)) return
    done.current = true
    void (async () => {
      const token = await getAuthToken(renown)
      // Authed routes need a token; skip silently if signed out.
      if (!token) { done.current = false; return }
      await ROUTE_PREFETCH[href]({ queryClient, did, token })
    })()
  }, [href, queryClient, did, renown])

  if (!hasPrefetch(href)) return undefined
  return { onMouseEnter: trigger, onFocus: trigger, onTouchStart: trigger }
}
```
- [ ] **Step 4: wire desktop nav** — in `navbar-items-desk.tsx`, extract the link into a small child so the hook can be called per-item (hooks can't be in `.map` callbacks directly). Add:
```tsx
function DeskNavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const intent = usePrefetchOnIntent(item.href)
  return (
    <Link
      href={item.href}
      target={item.isExternal ? '_blank' : '_self'}
      {...intent}
      className={cn(
        'text-foreground/70 hover:text-foreground flex items-center gap-1 text-base font-semibold transition-colors',
        !item.isExternal && item.isActive(pathname) && 'text-foreground',
      )}
    >
      {item.label}
      {item.isExternal && <ExternalLink className="h-4 w-4" />}
    </Link>
  )
}
```
and render `<DeskNavLink key={item.label} item={item} pathname={pathname} />` in the map. Add the import `import { usePrefetchOnIntent } from '@/modules/shared/state/use-prefetch-on-intent'`. (Note: `isActive`/`isExternal` access — `NavItem` is a union; guard with `!item.isExternal && item.isActive?.(pathname)` to satisfy TS, matching the existing `!item.isExternal && item.isActive(pathname)`.)
- [ ] **Step 5: wire mobile nav** — apply the same `{...usePrefetchOnIntent(item.href)}` spread to the `<Link>` in `navbar-item-mobile.tsx` (extract a child component the same way if it maps items).
- [ ] **Step 6: Typecheck + tests** — `npm run tsc && npm run test:unit -- route-prefetch` → clean/PASS.
- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat(state): intent-prefetch authed routes on nav hover/focus"`

---

### Task 5: Verify, build, ship, QA

**Files:** none (verification/release).

- [ ] **Step 1: Full local gate** — `npm run tsc && npm run lint && npm run format:check && npm run test:unit`. Fix prettier with `npx prettier --write` on flagged files. Expect only the 2 pre-existing failures (`agent-card`, `use-create-environment`).
- [ ] **Step 2: Production build** — `npm run build` → succeeds.
- [ ] **Step 3: Push + PR** — push branch, `gh pr create --base staging` with a summary (symptom, design, verification). No co-author trailer; strip AI attribution from the PR body.
- [ ] **Step 4: Watch CI green** — `gh run watch` on the lint-and-types run.
- [ ] **Step 5: Merge to staging** — only after CI green and user OK (or per one-shot mandate). ArgoCD syncs.
- [ ] **Step 6: Watch deploy** — poll `https://staging.vetra.io/health` until `version` = `staging-<new-sha>` (uptime reset).
- [ ] **Step 7: QA on staging** — automated smoke via Playwright on public pages (load, no console errors, navigation works). Verify in the bundle/network that env/studio idle polling is gone. **Authed-page QA (My Products instant, no idle requests) requires a wallet sign-in the agent can't perform — flag for the user to confirm.**

## Self-Review

- **Spec coverage:** WS debounce+active-only (Task 3), drop polling (Task 2 + Task 1 idle-stop), queryOptions/descriptors (Task 2), intent prefetch (Task 4), studio-products coordinated key (Task 1), supersede PR#80 (branch off staging, #80 closed), chip honesty (coordinated key added; chip logic unchanged). ✓
- **Placeholder scan:** none.
- **Type consistency:** `myEnvironmentsQuery`/`studioProductsQuery` return `{queryKey, fetch}`; consumed identically in hooks + route-prefetch. `studioPollIntervalMs: number|false` consumed by RQ `refetchInterval` (accepts `false`). `usePrefetchOnIntent` returns handlers|undefined; spread is safe (`{...undefined}` is a no-op).
- **Risk:** mobile nav file shape unknown until opened — Step 5 adapts to its actual structure.
