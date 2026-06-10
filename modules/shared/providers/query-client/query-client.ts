import { QueryClient, isServer } from '@tanstack/react-query'

/**
 * Bump when the shape of any persisted query payload changes (or on a deploy
 * that should drop stale client caches). The persisted localStorage blob is
 * discarded whenever this string no longer matches.
 */
export const CACHE_BUSTER = 'v1'

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

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Show cached data immediately, revalidate quietly in the background.
        staleTime: 30 * 1000,
        // Keep cached entries around long enough to be worth persisting.
        gcTime: CACHE_MAX_AGE,
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
