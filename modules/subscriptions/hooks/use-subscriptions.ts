'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthedQuery } from '@/modules/cloud/query/use-authed-query'
import { retryPublisher } from '@/modules/publisher/graphql'
import { usePublisherToken } from '@/modules/publisher/hooks/use-publisher'
import { useViewerDid } from '@/modules/publisher/hooks/use-viewer-did'
import {
  cancelSubscription,
  fetchInviteCodeCheck,
  fetchMySubscriptions,
  fetchStudioAccess,
  redeemInviteCode,
} from '../graphql'
import { isLive } from '../lib/subscriptions'
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

export function useMySubscriptions() {
  const { did, keyDid } = useViewerDid()
  return useAuthedQuery<Subscription[]>(
    subscriptionsKeys.mine(keyDid),
    (token) => fetchMySubscriptions(token),
    {
      enabled: !!did,
      retry: retryPublisher,
      // A fresh licence is ISSUED and its environment appears a little later: poll until settled.
      refetchInterval: (query) =>
        query.state.data?.some(
          (s) => s.status === 'ISSUED' || (s.mode === 'DEDICATED' && isLive(s) && !s.environmentId),
        )
          ? SETTLING_POLL_MS
          : false,
      refetchIntervalInBackground: false,
    },
  )
}

/**
 * Studio licence. `null` means "not known yet" (no bearer token right after a
 * redirect), never "no licence": it keeps polling until a real answer arrives.
 */
export function useStudioAccess() {
  const { did, keyDid } = useViewerDid()
  return useAuthedQuery<StudioAccess | null>(
    subscriptionsKeys.studioAccess(keyDid),
    (token) => (token ? fetchStudioAccess(token) : Promise.resolve(null)),
    {
      enabled: !!did,
      retry: retryPublisher,
      staleTime: 60_000,
      refetchInterval: (query) => (query.state.data === null ? 2_000 : false),
    },
  )
}

function useSubscriptionsMutation<V, R>(fn: (vars: V, token: string | null) => Promise<R>) {
  const qc = useQueryClient()
  const token = usePublisherToken()
  return useMutation<R, Error, V>({
    mutationFn: async (vars) => fn(vars, await token()),
    // Redeeming the studio code changes studioAccess too, so drop every subscription query.
    onSuccess: () => void qc.invalidateQueries({ queryKey: subscriptionsKeys.all }),
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

export function useSubscriptionForEnvironment(environmentId: string) {
  const subs = useMySubscriptions()
  const matches = (subs.data ?? []).filter((s) => s.environmentId === environmentId)
  return {
    subscription: matches.find(isLive) ?? matches[0],
    isPending: subs.isPending && subs.fetchStatus !== 'idle',
  }
}
