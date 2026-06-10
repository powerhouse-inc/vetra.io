'use client'

import { useEffect, useRef } from 'react'
import { useDid } from '@powerhousedao/reactor-browser'
import { useQueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import type { ReactNode } from 'react'
import {
  CACHE_BUSTER,
  CACHE_MAX_AGE,
  PERSIST_KEY,
  getQueryClient,
  shouldPersistQuery,
} from './query-client'

/**
 * localStorage-backed persister. Guarded for SSR — `createSyncStoragePersister`
 * touches the storage object eagerly, so we hand it `undefined` on the server
 * (the persister no-ops) and the real store in the browser.
 */
const persister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  key: PERSIST_KEY,
})

/**
 * Clears the cache (memory + persisted) whenever the signed-in identity
 * changes. Per-user query keys already include the DID, so a different user
 * can't *read* the previous user's entries — this additionally evicts them so
 * stale data never lingers in storage. Skips the very first resolution
 * (undefined → did) so we don't wipe a freshly-hydrated cache on load.
 */
function CacheIdentityGuard() {
  const did = useDid()
  const queryClient = useQueryClient()
  const prevDid = useRef<string | undefined>(undefined)
  const seeded = useRef(false)

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

  return null
}

export default function QueryClientProvider({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient()

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: CACHE_MAX_AGE,
        buster: CACHE_BUSTER,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) =>
            query.state.status === 'success' && shouldPersistQuery(query.queryKey),
        },
      }}
    >
      <CacheIdentityGuard />
      {children}
    </PersistQueryClientProvider>
  )
}
