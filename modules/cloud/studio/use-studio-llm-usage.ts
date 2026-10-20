'use client'

import { useDid } from '@powerhousedao/reactor-browser'
import { queryKeys } from '@/modules/cloud/query/keys'
import { useAuthedQuery } from '@/modules/cloud/query/use-authed-query'
import { fetchStudioLlmUsage, type StudioLlmUsage } from './llm-client'

/** A Studio's model spend this month. A failed fetch is not retried and leaves no data. */
export function useStudioLlmUsage(envId: string, enabled: boolean) {
  const did = useDid()
  return useAuthedQuery<StudioLlmUsage | null>(
    queryKeys.studioLlmUsage(envId, did),
    (token) => fetchStudioLlmUsage(envId, token),
    { enabled, staleTime: 60_000, retry: false },
  )
}
