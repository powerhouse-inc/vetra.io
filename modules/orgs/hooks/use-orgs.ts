'use client'

import { useDid, useRenownAuthAsync } from '@powerhousedao/reactor-browser'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useSyncExternalStore } from 'react'
import { useAuthedQuery } from '@/modules/cloud/query/use-authed-query'
import {
  readActiveOrg,
  resolveActiveOrgId,
  subscribeActiveOrg,
  writeActiveOrg,
} from '../active-org'
import { fetchMyOrganizations, fetchOrganizationSummary } from '../graphql'
import type { MyOrg, OrgSummary } from '../types'

export const orgKeys = {
  mine: (did: string | undefined) => ['orgs', 'mine', did ?? null] as const,
  summary: (id: string) => ['orgs', 'summary', id] as const,
}

export function useMyOrgs() {
  const did = useDid()
  const auth = useRenownAuthAsync()
  const address =
    auth.state === 'authenticated'
      ? ((auth.address ?? auth.displayAddress)?.toLowerCase() ?? null)
      : null
  return useAuthedQuery<MyOrg[]>(
    orgKeys.mine(did),
    (token) => (address ? fetchMyOrganizations(address, token) : Promise.resolve([])),
    { enabled: !!address, staleTime: 60_000, retry: 1 },
  )
}

export type ActiveOrg = {
  orgId: string | null
  org: MyOrg | null
  orgs: MyOrg[]
  isLoading: boolean
  setActiveOrg: (id: string | null) => void
}

export function useActiveOrg(): ActiveOrg {
  const stored = useSyncExternalStore(subscribeActiveOrg, readActiveOrg, () => null)
  const mine = useMyOrgs()
  const loaded = mine.data
  const failed = mine.isError && !loaded
  const auth = useRenownAuthAsync()
  const signedOut = auth.state !== 'authenticated' && auth.state !== 'resolving'
  const orgId = signedOut ? null : resolveActiveOrgId(stored, loaded, failed)
  useEffect(() => {
    // Signed out, or a stored org the viewer is not (or no longer) in, is forgotten.
    if (stored && (signedOut || (loaded && orgId === null))) writeActiveOrg(null)
  }, [stored, loaded, orgId, signedOut])
  return {
    orgId,
    org: orgId ? (loaded?.find((o) => o.id === orgId) ?? null) : null,
    orgs: loaded ?? [],
    isLoading: mine.isLoading,
    setActiveOrg: writeActiveOrg,
  }
}

export function useOrgSummary(orgId: string | null | undefined) {
  return useQuery<OrgSummary | null>({
    queryKey: orgKeys.summary(orgId ?? ''),
    queryFn: () => fetchOrganizationSummary(orgId!),
    enabled: !!orgId,
    staleTime: 5 * 60_000,
  })
}
