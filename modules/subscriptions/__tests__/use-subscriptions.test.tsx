import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import React from 'react'

const fetchMySubscriptions = vi.fn()
const fetchStudioAccess = vi.fn()
const redeemInviteCode = vi.fn()
let did: string | undefined = 'did:pkh:eip155:1:0xme'

vi.mock('../graphql', () => ({
  fetchInviteCodeCheck: vi.fn(),
  fetchMySubscriptions: (...a: unknown[]) => fetchMySubscriptions(...a),
  fetchStudioAccess: (...a: unknown[]) => fetchStudioAccess(...a),
  redeemInviteCode: (...a: unknown[]) => redeemInviteCode(...a),
  cancelSubscription: vi.fn(),
}))
vi.mock('@/modules/cloud/query/use-authed-query', () => ({
  useAuthedQuery: (key: readonly unknown[], fetcher: (t: string | null) => Promise<unknown>, options?: object) =>
    useQuery({ queryKey: key, queryFn: () => fetcher('tok'), ...options }),
}))
vi.mock('@/modules/publisher/hooks/use-publisher', () => ({ usePublisherToken: () => async () => 'tok' }))
vi.mock('@powerhousedao/reactor-browser', () => ({ useDid: () => did }))

import {
  useMySubscriptions,
  useRedeemInviteCode,
  useStudioAccess,
  useSubscriptionForEnvironment,
} from '../hooks/use-subscriptions'

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidate = vi.spyOn(qc, 'invalidateQueries')
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return { Wrapper, invalidate }
}

describe('subscription hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    did = 'did:pkh:eip155:1:0xme'
  })

  it('stays idle while signed out', () => {
    did = undefined
    const { Wrapper } = setup()
    renderHook(() => useMySubscriptions(), { wrapper: Wrapper })
    renderHook(() => useStudioAccess(), { wrapper: Wrapper })
    expect(fetchMySubscriptions).not.toHaveBeenCalled()
    expect(fetchStudioAccess).not.toHaveBeenCalled()
  })

  it('finds the subscription behind an environment, preferring a live one', async () => {
    fetchMySubscriptions.mockResolvedValue([
      { licenseId: 'old', environmentId: 'env-1', status: 'REPLACED' },
      { licenseId: 'new', environmentId: 'env-1', status: 'ACTIVE' },
    ])
    const { Wrapper } = setup()
    const { result } = renderHook(() => useSubscriptionForEnvironment('env-1'), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.subscription?.licenseId).toBe('new'))
  })

  it('refreshes every subscription query after a redemption', async () => {
    redeemInviteCode.mockResolvedValue({ licenseId: 'l1' })
    const { Wrapper, invalidate } = setup()
    const { result } = renderHook(() => useRedeemInviteCode(), { wrapper: Wrapper })
    await act(async () => {
      await result.current.mutateAsync({ code: 'C' })
    })
    expect(redeemInviteCode).toHaveBeenCalledWith({ code: 'C' }, 'tok')
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['subscriptions'] })
  })
})
