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
import { fetchMyOrganizationsAnswer, fetchOrganizationSummary } from '../graphql'
import type { MyOrg, OrgSummary } from '../types'

export const orgKeys = {
  mine: (did: string | undefined) => ['orgs', 'mine', did ?? null] as const,
  summary: (id: string) => ['orgs', 'summary', id] as const,
}

type MyOrgsAnswer = { orgs: MyOrg[]; partial: boolean }

function useMyOrgsQuery<T>(select: (answer: MyOrgsAnswer) => T) {
  const did = useDid()
  const auth = useRenownAuthAsync()
  const address =
    auth.state === 'authenticated'
      ? ((auth.address ?? auth.displayAddress)?.toLowerCase() ?? null)
      : null
  return useAuthedQuery<MyOrgsAnswer, T>(
    orgKeys.mine(did),
    (token) =>
      address
        ? fetchMyOrganizationsAnswer(address, token)
        : Promise.resolve({ orgs: [], partial: false }),
    { enabled: !!address, staleTime: 60_000, retry: 1, select },
  )
}

// A cache entry from before the answer carried `partial` (a bare list) counts
// as non-authoritative until it is refetched.
const normalize = (answer: MyOrgsAnswer | MyOrg[]): MyOrgsAnswer =>
  Array.isArray(answer) ? { orgs: answer, partial: true } : answer
const selectOrgs = (answer: MyOrgsAnswer) => normalize(answer).orgs
const selectAnswer = (answer: MyOrgsAnswer) => normalize(answer)

export function useMyOrgs() {
  return useMyOrgsQuery(selectOrgs)
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
  const mine = useMyOrgsQuery(selectAnswer)
  const loaded = mine.data?.orgs
  // A degraded answer (Renown refused the bearer) may omit hidden memberships:
  // like a failure it falls back to personal without forgetting the stored org.
  const partial = mine.data?.partial ?? false
  const failed = mine.isError && !loaded
  const auth = useRenownAuthAsync()
  const signedOut = auth.state !== 'authenticated' && auth.state !== 'resolving'
  const orgId = signedOut ? null : resolveActiveOrgId(stored, loaded, failed)
  useEffect(() => {
    // Signed out, or a stored org the viewer is not (or no longer) in per an
    // authoritative answer, is forgotten.
    if (stored && (signedOut || (loaded && !partial && orgId === null))) writeActiveOrg(null)
  }, [stored, loaded, partial, orgId, signedOut])
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
