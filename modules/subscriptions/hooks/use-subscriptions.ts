'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { useAppNameOf } from '@/modules/apps/hooks/use-app-names'
import { useAuthedQuery } from '@/modules/cloud/query/use-authed-query'
import { retryPublisher } from '@/modules/publisher/graphql'
import { usePublisherToken } from '@/modules/publisher/hooks/use-publisher'
import { useViewerDid } from '@/modules/publisher/hooks/use-viewer-did'
import {
  cancelSubscription,
  fetchInviteCodeCheck,
  fetchMySubscriptions,
  fetchStudioAccess,
  recreateEnvironment,
  redeemInviteCode,
} from '../graphql'
import { isLive, isSettling } from '../lib/subscriptions'
import type { RedeemInviteCodeInput, StudioAccess, Subscription } from '../types'
import { subscriptionsKeys } from './keys'

const SETTLING_POLL_MS = 10_000

/** Public check, before login. Cached briefly so going back and forth does not re-ask. */
export function useInviteCodeCheck(code: string) {
  return useQuery({
    queryKey: subscriptionsKeys.inviteCode(code),
    queryFn: () => fetchInviteCodeCheck(code),
    enabled: code.length > 0,
    retry: retryPublisher,
    staleTime: 30_000,
  })
}

/** The caller's subscriptions, each app named by its Renown profile where it has one. */
export function useMySubscriptions() {
  const { did, keyDid } = useViewerDid()
  const nameOf = useAppNameOf()
  const query = useAuthedQuery<Subscription[]>(
    subscriptionsKeys.mine(keyDid),
    (token) => fetchMySubscriptions(token),
    {
      enabled: !!did,
      retry: retryPublisher,
      // A fresh licence is ISSUED and its environment appears a little later: poll until settled.
      refetchInterval: (query) => (isSettling(query.state.data ?? []) ? SETTLING_POLL_MS : false),
      refetchIntervalInBackground: false,
    },
  )
  const data = useMemo(
    () => query.data?.map((sub) => ({ ...sub, appName: nameOf(sub.appId, sub.appName) })),
    [query.data, nameOf],
  )
  return { ...query, data }
}

const STUDIO_ACCESS_POLL_MS = 2_000
/** How long "not known yet" may last before we stop polling and say so. */
export const STUDIO_ACCESS_WAIT_MS = 60_000

/**
 * Studio licence. `null` means "not known yet" (no bearer token right after a
 * redirect), never "no licence": it polls until a real answer arrives, for about a
 * minute. Then `timedOut` is true and `retry` waits another minute.
 */
export function useStudioAccess() {
  const { did, keyDid } = useViewerDid()
  const [since, setSince] = useState(() => Date.now())
  const waited = (updatedAt: number) => updatedAt - since >= STUDIO_ACCESS_WAIT_MS
  const query = useAuthedQuery<StudioAccess | null>(
    subscriptionsKeys.studioAccess(keyDid),
    (token) => (token ? fetchStudioAccess(token) : Promise.resolve(null)),
    {
      enabled: !!did,
      retry: retryPublisher,
      staleTime: 60_000,
      refetchInterval: (q) =>
        q.state.data === null && !waited(q.state.dataUpdatedAt) ? STUDIO_ACCESS_POLL_MS : false,
    },
  )
  const timedOut = query.data === null && waited(query.dataUpdatedAt)
  const { refetch } = query
  const retry = useCallback(() => {
    setSince(Date.now())
    void refetch()
  }, [refetch])
  return { ...query, timedOut, retry }
}

function useSubscriptionsMutation<V, R>(fn: (vars: V, token: string | null) => Promise<R>) {
  const qc = useQueryClient()
  const token = usePublisherToken()
  return useMutation<R, Error, V>({
    mutationFn: async (vars) => fn(vars, await token()),
    // Redeeming the studio code changes studioAccess too, so refresh every subscription query,
    // except the code check: a single-use code would flash "can't be used" before navigation.
    onSuccess: () =>
      void qc.invalidateQueries({
        queryKey: subscriptionsKeys.all,
        predicate: (q) => q.queryKey[1] !== 'invite-code',
      }),
  })
}

export const useRedeemInviteCode = () =>
  useSubscriptionsMutation<RedeemInviteCodeInput, Subscription>((input, t) =>
    redeemInviteCode(input, t),
  )

export const useCancelSubscription = () =>
  useSubscriptionsMutation<{ licenseId: string }, boolean>(({ licenseId }, t) =>
    cancelSubscription(licenseId, t),
  )

export const useRecreateEnvironment = () =>
  useSubscriptionsMutation<{ licenseId: string }, Subscription>(({ licenseId }, t) =>
    recreateEnvironment(licenseId, t),
  )

export function useSubscriptionForEnvironment(environmentId: string) {
  const subs = useMySubscriptions()
  const matches = (subs.data ?? []).filter((s) => s.environmentId === environmentId)
  return {
    subscription: matches.find(isLive) ?? matches[0],
    isPending: subs.isPending && subs.fetchStatus !== 'idle',
  }
}
