import { QueryClient, isServer } from '@tanstack/react-query'

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

/** localStorage key for the persisted React Query cache. */
export const PERSIST_KEY = 'vetra-rq-cache'

/** Persisted cache lifetime — long, so the cache survives browser restarts. */
export const CACHE_MAX_AGE = 24 * 60 * 60 * 1000 // 24h

/**
 * Query-key prefixes whose payloads must never be written to localStorage.
 * Tenant secrets/env vars can carry sensitive values; everything else is
 * per-user data already namespaced by DID in its key.
 */
const SENSITIVE_KEY_PREFIXES = ['tenant-secrets', 'tenant-env-vars']

/** True when a query is safe to persist (not sensitive, and succeeded). */
export function shouldPersistQuery(queryKey: readonly unknown[]): boolean {
  const head = queryKey[0]
  if (typeof head !== 'string') return true
  return !SENSITIVE_KEY_PREFIXES.includes(head)
}

/**
 * The `gcTime` to use for a given environment.
 *
 * `Infinity` on the server is not "cache forever" -- React Query treats a
 * non-finite gcTime as "schedule no GC timer at all" (`isValidTimeout(Infinity)`
 * is false), which is exactly what we want and matches its own server default.
 * Split out as a pure function so the rule is testable: the test environment is
 * happy-dom, so `isServer` is always false there and the server branch would
 * otherwise never be exercised.
 */
export function gcTimeFor(server: boolean): number {
  return server ? Infinity : CACHE_MAX_AGE
}

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Show cached data immediately, revalidate quietly in the background.
        staleTime: 30 * 1000,
        // Browser: keep cached entries around long enough to be worth
        // persisting. Server: Infinity, which is NOT "cache forever" here --
        // it is how you tell React Query to schedule no GC timer at all
        // (`isValidTimeout(Infinity)` is false), and it matches React Query's
        // own server default.
        //
        // A finite gcTime on the server leaks the entire render. `scheduleGc()`
        // calls setTimeout, a Node timer captures the AsyncLocalStorage context
        // it was created in, and that context holds the request's work store --
        // the react-dom/server Request, the produced HTML and the RSC payload.
        // One pending timer therefore pinned one whole SSR render for the full
        // 24h, and `getQueryClient()` builds a fresh client for EVERY server
        // request, so it was one leaked render per request.
        //
        // Measured on staging-d4ee67c before this change: exactly 1.00 retained
        // react-dom/server Request per HTTP request (412 -> 812 over 400
        // requests) and ~0.32 MiB/request of heap growth, which crashed the pod
        // with "Ineffective mark-compacts near heap limit" every ~2h.
        // Upstream: TanStack/query#11320, vercel/next.js#94919.
        //
        // Nothing is lost by not collecting on the server: the client is
        // per-request and thrown away with the response.
        gcTime: gcTimeFor(isServer),
        refetchOnWindowFocus: true,
        retry: 2,
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined

/**
 * One client per browser tab (a fresh client every render would throw the
 * cache away if React suspends). Server always gets a throwaway client.
 */
export function getQueryClient(): QueryClient {
  if (isServer) return makeQueryClient()
  if (!browserQueryClient) browserQueryClient = makeQueryClient()
  return browserQueryClient
}
