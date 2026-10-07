'use client'

import { useCallback, useRef } from 'react'
import { useDid, useRenown } from '@powerhousedao/reactor-browser'
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

/** Viewer DID for cache keys. 'anon' only while signed out; never shared across signed-in wallets. */
function useViewerDid(): string {
  return useDid() ?? 'anon'
}

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
  const did = useViewerDid()
  return useAuthedQuery<PublisherApp[]>(
    publisherKeys.apps(did),
    // `?? []`: a wallet with no apps must resolve to an empty list, never undefined,
    // so the dashboard can render its empty state instead of a stuck spinner.
    async (token) => (await fetchMyApps(token)) ?? [],
    { retry: retryPublisher },
  )
}

export function usePublisherLicenseTypes(appId: string | null) {
  const did = useViewerDid()
  return useAuthedQuery<PublisherLicenseType[]>(
    publisherKeys.types(appId ?? '', did),
    (token) => fetchLicenseTypes(appId ?? '', token),
    { retry: retryPublisher, enabled: !!appId },
  )
}

export function usePublisherLicenses(appId: string | null, status: string | null) {
  const did = useViewerDid()
  return useAuthedQuery<PublisherLicense[]>(
    publisherKeys.licenses(appId ?? '', status, did),
    (token) => fetchLicenses(appId ?? '', status, token),
    { retry: retryPublisher, enabled: !!appId },
  )
}

export function usePublisherEnvironments(appId: string | null) {
  const did = useViewerDid()
  return useAuthedQuery<AppUserEnvironment[]>(
    publisherKeys.environments(appId ?? '', did),
    (token) => fetchEnvironments(appId ?? '', token),
    { retry: retryPublisher, enabled: !!appId },
  )
}
