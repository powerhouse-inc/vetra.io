'use client'

import { useDid } from '@powerhousedao/reactor-browser'
import { queryKeys } from '@/modules/cloud/query/keys'
import { useAuthedQuery } from '@/modules/cloud/query/use-authed-query'
import { fetchStudioLlmStatus, type StudioLlmStatus } from './llm-client'

/** Whether a Studio has a model key. Only asked for a Studio that is up; cached for a minute. */
export function useStudioLlmStatus(envId: string, enabled: boolean) {
  const did = useDid()
  return useAuthedQuery<StudioLlmStatus>(
    queryKeys.studioLlmStatus(envId, did),
    (token) => fetchStudioLlmStatus(envId, token),
    { enabled, staleTime: 60_000 },
  )
}
