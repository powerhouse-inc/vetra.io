'use client'

import { useDid } from '@powerhousedao/reactor-browser'
import { syncEnvironmentOrg, type EnvironmentOrgAccess } from '../graphql'
import { queryKeys } from '../query/keys'
import { useAuthedQuery } from '../query/use-authed-query'
import { useCanSign } from './use-can-sign'

/**
 * The env's organisation and the viewer's access (also refreshes their
 * operator entry). `data` is null on personal envs of older switchboards and
 * when the sync fails; callers then fall back to the personal rules.
 */
export function useEnvironmentOrg(documentId: string | null) {
  const did = useDid()
  return useAuthedQuery<EnvironmentOrgAccess | null>(
    queryKeys.environmentOrg(documentId ?? '', did),
    async (token) => (documentId ? syncEnvironmentOrg(documentId, token).catch(() => null) : null),
    { enabled: !!documentId && !!did, staleTime: 30_000 },
  )
}

/**
 * Whether env edit controls are shown/enabled (Ruling R6): the viewer can sign
 * and, on an organisation environment, the backend says they can operate.
 * Personal envs and older switchboards (no answer) keep the signer-only rule.
 */
export function useCanEditEnvironment(documentId: string | null): boolean {
  const { canSign } = useCanSign()
  const { data, isLoading } = useEnvironmentOrg(canSign ? documentId : null)
  // Disabled while the first answer is in flight, so an org env never flashes editable.
  if (!canSign || isLoading) return false
  return data ? data.canOperate : true
}
