'use client'

import { useCallback, useRef } from 'react'
import { useRenown } from '@powerhousedao/reactor-browser'
import { useAuthedQuery } from '@/modules/cloud/query/use-authed-query'
import { getAuthToken } from '@/modules/cloud/graphql'
import { waitForToken } from '@/modules/apps/lib/token'
import {
  fetchMyApps,
  fetchLicenseTypes,
  fetchLicenses,
  fetchEnvironments,
  retryPublisher,
} from '../graphql'
import type {
  PublisherApp,
  PublisherLicense,
  PublisherLicenseType,
  AppUserEnvironment,
} from '../types'
import { publisherKeys } from './keys'
import { useViewerDid } from './use-viewer-did'

const ENVIRONMENTS_POLL_MS = 10_000
const LICENCES_POLL_MS = 15_000

/**
 * Token resolver for mutations (Task 6). Goes through waitForToken, not a bare
 * getAuthToken: a call fired right after login or a redirect can otherwise go
 * out with no token and come back UNAUTHENTICATED.
 */
export function usePublisherToken(): () => Promise<string | null> {
  const renown = useRenown()
  const ref = useRef(renown)
  // eslint-disable-next-line react-hooks/refs
  ref.current = renown
  return useCallback(() => waitForToken(() => getAuthToken(ref.current)), [])
}

export function useMyApps() {
  const { did, keyDid } = useViewerDid()
  return useAuthedQuery<PublisherApp[]>(
    publisherKeys.apps(keyDid),
    // `?? []`: a wallet with no apps must resolve to an empty list, never undefined,
    // so the dashboard can render its empty state instead of a stuck spinner.
    async (token) => (await fetchMyApps(token)) ?? [],
    // enabled on the RAW did: never fetch into the shared 'anon' key.
    { retry: retryPublisher, enabled: !!did },
  )
}

export function usePublisherLicenseTypes(appId: string | null) {
  const { did, keyDid } = useViewerDid()
  return useAuthedQuery<PublisherLicenseType[]>(
    publisherKeys.types(appId ?? '', keyDid),
    (token) => fetchLicenseTypes(appId ?? '', token),
    { retry: retryPublisher, enabled: !!did && !!appId },
  )
}

export function usePublisherLicenses(appId: string | null, status: string | null) {
  const { did, keyDid } = useViewerDid()
  return useAuthedQuery<PublisherLicense[]>(
    publisherKeys.licenses(appId ?? '', status, keyDid),
    (token) => fetchLicenses(appId ?? '', status, token),
    {
      retry: retryPublisher,
      enabled: !!did && !!appId,
      // The keeper moves ISSUED -> ACTIVE after the grant returns; poll only while one is pending.
      refetchInterval: (query) =>
        query.state.data?.some((l) => l.status === 'ISSUED') ? LICENCES_POLL_MS : false,
      refetchIntervalInBackground: false,
    },
  )
}

export function usePublisherEnvironments(appId: string | null) {
  const { did, keyDid } = useViewerDid()
  return useAuthedQuery<AppUserEnvironment[]>(
    publisherKeys.environments(appId ?? '', keyDid),
    (token) => fetchEnvironments(appId ?? '', token),
    {
      retry: retryPublisher,
      enabled: !!did && !!appId,
      // Keeper-driven and delayed. Unconditional on purpose: right after a grant the list is
      // empty and looks settled while an environment is about to appear.
      refetchInterval: ENVIRONMENTS_POLL_MS,
      refetchIntervalInBackground: false,
    },
  )
}
