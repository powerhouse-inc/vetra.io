'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
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
  const [online, setOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
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

  // Online/offline tracking (initial value seeded lazily in useState above).
  useEffect(() => {
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
