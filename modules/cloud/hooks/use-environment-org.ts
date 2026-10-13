'use client'

import { useDid } from '@powerhousedao/reactor-browser'
import { syncEnvironmentOrg, type EnvironmentOrgAccess } from '../graphql'
import { queryKeys } from '../query/keys'
import { useAuthedQuery } from '../query/use-authed-query'
import { useCanSign } from './use-can-sign'

/**
 * The viewer's access to an organisation env (also refreshes their operator
 * entry). Only asked when the env is known to belong to an organisation:
 * personal envs make no sync call. `data` is null when the sync fails.
 */
export function useEnvironmentOrg(
  documentId: string | null,
  ownerOrgId: string | null | undefined,
) {
  const did = useDid()
  return useAuthedQuery<EnvironmentOrgAccess | null>(
    queryKeys.environmentOrg(documentId ?? '', did),
    async (token) => (documentId ? syncEnvironmentOrg(documentId, token).catch(() => null) : null),
    { enabled: !!documentId && !!did && !!ownerOrgId, staleTime: 30_000 },
  )
}

/**
 * Whether env edit controls are shown/enabled (Ruling R6).
 * `ownerOrgId`: `null` = personal (signer alone decides), a string = org env
 * (the backend's canOperate decides), `undefined` = not known yet (false, so
 * an org env never flashes editable). False while the identity resolves.
 */
export function useCanEditEnvironment(
  documentId: string | null,
  ownerOrgId: string | null | undefined,
): boolean {
  const { canSign } = useCanSign()
  const did = useDid()
  const { data } = useEnvironmentOrg(canSign ? documentId : null, ownerOrgId)
  if (!canSign || !did || ownerOrgId === undefined) return false
  if (ownerOrgId === null) return true
  return data?.canOperate ?? false
}
