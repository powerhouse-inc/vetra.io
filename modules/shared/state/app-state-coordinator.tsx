'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import type { ReactNode } from 'react'
import { useRenownAuth } from '@powerhousedao/reactor-browser'
import { useIsFetching, useIsMutating, useQueryClient } from '@tanstack/react-query'
import { useBuilderAccount } from '@/modules/profile/lib/use-builder-account'
import { useMyTeams } from '@/modules/profile/lib/use-my-teams'
import { useDocumentListSubscription } from '@/modules/cloud/hooks/use-document-subscription'
import { createDebouncer } from '@/shared/lib/debounce'
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

/** Subscribe to browser connectivity changes. Module-level for a stable ref. */
function subscribeOnline(onChange: () => void): () => void {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

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
  // External store so SSR + first client render agree (server snapshot = true),
  // avoiding the false "offline" from Node 21+'s global `navigator` (no onLine).
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  )

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

  // Refresh coordinated data when connectivity is restored. The `online` value
  // itself is tracked by useSyncExternalStore above.
  useEffect(() => {
    const onOnline = () => refreshAll()
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
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

  // Global WS push: any Switchboard document change refreshes coordinated
  // queries. Debounced (the management switchboard emits a high-frequency
  // documentChanges stream) and active-only — only queries with mounted
  // observers (the page you're on) refetch; idle pages go stale and refresh
  // lazily on next visit. This is the freshness mechanism that replaces polling.
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
