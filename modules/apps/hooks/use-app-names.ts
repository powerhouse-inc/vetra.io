'use client'

import { useQueries, useQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { publisherGql } from '@/modules/publisher/graphql'
import { fetchAppProfile } from '../lib/app-profile/api'
import { appProfileKey } from './use-app-profile'

type DirectoryEntry = { appId: string; appDid: string | null }

/** The public directory's app identities (no token), to find an app's Renown profile by id. */
async function fetchDirectoryDids(): Promise<DirectoryEntry[]> {
  const data = await publisherGql<{ vetraSubscriptions: { directory: DirectoryEntry[] } }>(
    '{ vetraSubscriptions { directory { appId appDid } } }',
    undefined,
    null,
  )
  return data.vetraSubscriptions.directory
}

/**
 * `nameOf(appId, fallback)`: an app's Renown profile name, for places that only know the app by
 * id (subscriptions, attention). `fallback` until the profile loads, or when there is none.
 */
export function useAppNameOf(): (appId: string, fallback: string) => string {
  const directory = useQuery({
    queryKey: ['app-directory-dids'],
    queryFn: fetchDirectoryDids,
    staleTime: 60_000,
    retry: 1,
  })
  const withDid = useMemo(
    () => (directory.data ?? []).filter((a): a is { appId: string; appDid: string } => !!a.appDid),
    [directory.data],
  )
  const profiles = useQueries({
    queries: withDid.map((a) => ({
      queryKey: appProfileKey(a.appDid),
      queryFn: () => fetchAppProfile(a.appDid),
      staleTime: 30_000,
      retry: 1,
    })),
  })
  const key = profiles.map((p) => p.data?.name ?? '').join('\u0000')
  const names = useMemo(() => {
    const map = new Map<string, string>()
    withDid.forEach((a, i) => {
      const name = profiles[i]?.data?.name?.trim()
      if (name) map.set(a.appId, name)
    })
    return map
    // `key` stands for the profile names; `profiles` is a new array every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withDid, key])
  return useCallback((appId, fallback) => names.get(appId) ?? fallback, [names])
}
