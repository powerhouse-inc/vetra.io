'use client'

import { useQueries, useQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { publisherGql } from '@/modules/publisher/graphql'
import { fetchAppProfile } from '../lib/app-profile/api'
import { profileLogoUrl } from '../lib/app-profile/logo'
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

/** An app's Renown identity, profile name and logo, each null where it has none. */
export type AppIdentity = { appDid: string | null; name: string | null; logo: string | null }

const NO_IDENTITY: AppIdentity = { appDid: null, name: null, logo: null }

/**
 * `identityOf(appId)`: an app's Renown profile name and logo, for places that only know the app
 * by id (subscriptions, attention, my instances). Nulls until the profile loads, or without one.
 */
export function useAppIdentityOf(): (appId: string) => AppIdentity {
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
  const key = profiles
    .map((p) => `${p.data?.name ?? ''}\u0001${p.data ? (profileLogoUrl(p.data) ?? '') : ''}`)
    .join('\u0000')
  const identities = useMemo(() => {
    const map = new Map<string, AppIdentity>()
    withDid.forEach((a, i) => {
      const profile = profiles[i]?.data
      map.set(a.appId, {
        appDid: a.appDid,
        name: profile?.name?.trim() || null,
        logo: profile ? profileLogoUrl(profile) : null,
      })
    })
    return map
    // `key` stands for the profile names and logos; `profiles` is a new array every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withDid, key])
  return useCallback((appId) => identities.get(appId) ?? NO_IDENTITY, [identities])
}

/**
 * `nameOf(appId, fallback)`: an app's Renown profile name, for places that only know the app by
 * id (subscriptions, attention). `fallback` until the profile loads, or when there is none.
 */
export function useAppNameOf(): (appId: string, fallback: string) => string {
  const identityOf = useAppIdentityOf()
  return useCallback((appId, fallback) => identityOf(appId).name ?? fallback, [identityOf])
}
