'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchAppStats, type AppStats } from '../lib/app-stats/api'

export const appStatsKey = (appDid: string) => ['renown-app-stats', appDid] as const

/** The app's public stats on Renown (null when it has none yet). Public read, no token. */
export function useAppStats(appDid: string | null | undefined) {
  return useQuery<AppStats | null>({
    queryKey: appStatsKey(appDid ?? ''),
    queryFn: () => fetchAppStats(appDid ?? ''),
    enabled: !!appDid,
    staleTime: 60_000,
    retry: 1,
  })
}
