'use client'

import { useCallback, useRef } from 'react'
import { useRenown } from '@powerhousedao/reactor-browser'
import type { UseQueryOptions } from '@tanstack/react-query'
import { getAuthToken } from '@/modules/cloud/graphql'
import { useAuthedQuery } from '@/modules/cloud/query/use-authed-query'
import { waitForToken } from '@/modules/apps/lib/token'
import {
  fetchAllowList,
  fetchAppArtifacts,
  fetchEnvironments,
  fetchInviteCodes,
  fetchLicenses,
  fetchPublisherApps,
  fetchTemplates,
  fetchTerms,
  retryPublisher,
} from '../graphql'
import type {
  PublisherAllowListEntry,
  PublisherApp,
  PublisherAppArtifact,
  PublisherEnvironment,
  PublisherInviteCode,
  PublisherLicense,
  PublisherTemplate,
  PublisherTerm,
} from '../types'
import { publisherKeys, type PublisherResource } from './keys'
import { useViewerDid } from './use-viewer-did'

const ENVIRONMENTS_POLL_MS = 10_000
const LICENCES_POLL_MS = 15_000

/**
 * Token resolver for mutations. Goes through waitForToken so a write fired right
 * after login or a redirect does not go out unauthenticated.
 */
export function usePublisherToken(): () => Promise<string | null> {
  const renown = useRenown()
  const ref = useRef(renown)
  // eslint-disable-next-line react-hooks/refs
  ref.current = renown
  return useCallback(() => waitForToken(() => getAuthToken(ref.current)), [])
}

export function usePublisherApps() {
  const { did, keyDid } = useViewerDid()
  return useAuthedQuery<PublisherApp[]>(
    publisherKeys.apps(keyDid),
    async (token) => (await fetchPublisherApps(token)) ?? [],
    { retry: retryPublisher, enabled: !!did },
  )
}

/** Is the viewer this app's publisher? Uses the server's own ownership rule (myApps). */
export function useAppPublisher(appId: string) {
  const apps = usePublisherApps()
  const app = apps.data?.find((a) => a.id === appId)
  // A disabled query (signed out) is "pending" forever in React Query; it is not loading.
  const isPending = apps.isPending && apps.fetchStatus !== 'idle'
  // Only a failure with nothing to show counts; a failed background refetch keeps the tabs.
  const error = apps.data ? null : apps.error
  const { refetch } = apps
  const retry = useCallback(() => void refetch(), [refetch])
  return { isPublisher: !!app, app, isPending, error, retry, retrying: apps.isFetching }
}

type ListOptions<T> = Omit<
  UseQueryOptions<T[], Error, T[], readonly unknown[]>,
  'queryKey' | 'queryFn'
>

function useAppList<T>(
  resource: PublisherResource,
  appId: string | null,
  fetcher: (appId: string, token: string | null) => Promise<T[]>,
  options: ListOptions<T> = {},
) {
  const { did, keyDid } = useViewerDid()
  return useAuthedQuery<T[]>(
    publisherKeys.resource(resource, appId ?? '', keyDid),
    async (token) => (await fetcher(appId ?? '', token)) ?? [],
    { retry: retryPublisher, enabled: !!did && !!appId, ...options },
  )
}

export const usePublisherTemplates = (appId: string | null) =>
  useAppList<PublisherTemplate>('templates', appId, fetchTemplates)

export const usePublisherTerms = (appId: string | null) =>
  useAppList<PublisherTerm>('terms', appId, fetchTerms)

export const usePublisherAppArtifacts = (appId: string | null) =>
  useAppList<PublisherAppArtifact>('artifacts', appId, fetchAppArtifacts)

/** Every licence of the app; tabs filter client-side. Polls while one is still ISSUED. */
export const usePublisherLicenses = (appId: string | null) =>
  useAppList<PublisherLicense>('licenses', appId, (id, t) => fetchLicenses(id, null, t), {
    refetchInterval: (query) =>
      query.state.data?.some((l) => l.status === 'ISSUED') ? LICENCES_POLL_MS : false,
    refetchIntervalInBackground: false,
  })

/** Keeper-driven and delayed, so it polls while mounted. */
export const usePublisherEnvironments = (appId: string | null) =>
  useAppList<PublisherEnvironment>('environments', appId, fetchEnvironments, {
    refetchInterval: ENVIRONMENTS_POLL_MS,
    refetchIntervalInBackground: false,
  })

export const usePublisherInviteCodes = (appId: string | null) =>
  useAppList<PublisherInviteCode>('inviteCodes', appId, fetchInviteCodes)

export const usePublisherAllowList = (appId: string | null) =>
  useAppList<PublisherAllowListEntry>('allowList', appId, fetchAllowList)
