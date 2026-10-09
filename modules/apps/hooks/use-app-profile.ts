'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { updateAppProfile } from '@/modules/publisher/graphql'
import { usePublisherToken } from '@/modules/publisher/hooks/use-publisher'
import { fetchAppProfile, type RenownAppProfile } from '../lib/app-profile/api'
import type { AppProfileChanges } from '../lib/app-profile/form'

export const appProfileKey = (appDid: string) => ['renown-app-profile', appDid] as const

/** The app's public Renown profile (null when it has none yet). Public read, no token. */
export function useAppProfile(appDid: string | null | undefined) {
  return useQuery<RenownAppProfile | null>({
    queryKey: appProfileKey(appDid ?? ''),
    queryFn: () => fetchAppProfile(appDid ?? ''),
    enabled: !!appDid,
    staleTime: 30_000,
    retry: 1,
  })
}

/** Saves a profile patch through Vetra's relay, then refreshes the profile. No retries. */
export function useUpdateAppProfile(appId: string, appDid: string | null | undefined) {
  const qc = useQueryClient()
  const token = usePublisherToken()
  return useMutation<boolean, Error, AppProfileChanges>({
    mutationFn: async (changes) => updateAppProfile({ appId, ...changes }, await token()),
    onSuccess: () => {
      if (appDid) void qc.invalidateQueries({ queryKey: appProfileKey(appDid) })
    },
  })
}

/** The signed-in user's Renown bearer, for Renown's upload route (the same session as Vetra's API). */
export function useRenownBearer(): () => Promise<string> {
  const token = usePublisherToken()
  return useCallback(async () => {
    const value = await token()
    if (!value) throw new Error('Log in again to upload images.')
    return value
  }, [token])
}
