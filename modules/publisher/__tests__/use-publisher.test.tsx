import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import React from 'react'

const fetchPublisherApps = vi.fn()
const fetchTemplates = vi.fn()
const fetchLicenses = vi.fn()
const fetchEnvironments = vi.fn()
let currentDid: string | undefined = 'did:pkh:eip155:1:0xme'

vi.mock('../graphql', async (orig) => ({
  ...(await orig<typeof import('../graphql')>()),
  fetchPublisherApps: (...a: unknown[]) => fetchPublisherApps(...a),
  fetchTemplates: (...a: unknown[]) => fetchTemplates(...a),
  fetchLicenses: (...a: unknown[]) => fetchLicenses(...a),
  fetchEnvironments: (...a: unknown[]) => fetchEnvironments(...a),
}))
vi.mock('@/modules/cloud/graphql', () => ({ getAuthToken: async () => 'tok' }))
vi.mock('@/modules/cloud/query/use-authed-query', () => ({
  useAuthedQuery: (key: readonly unknown[], fetcher: (t: string | null) => Promise<unknown>, options?: object) =>
    useQuery({ queryKey: key, queryFn: () => fetcher('tok'), ...options }),
}))
vi.mock('@powerhousedao/reactor-browser', () => ({
  useDid: () => currentDid,
  useRenown: () => ({}),
}))

import {
  useAppPublisher,
  usePublisherApps,
  usePublisherLicenses,
  usePublisherTemplates,
} from '../hooks/use-publisher'
import { publisherKeys } from '../hooks/keys'
import { PublisherApiError } from '../graphql'

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return { qc, Wrapper }
}

describe('publisher query hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentDid = 'did:pkh:eip155:1:0xme'
  })

  it('usePublisherApps caches under the viewer DID and resolves an empty list', async () => {
    fetchPublisherApps.mockResolvedValue([])
    const { qc, Wrapper } = wrapper()
    const { result } = renderHook(() => usePublisherApps(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
    expect(qc.getQueryData(publisherKeys.apps('did:pkh:eip155:1:0xme'))).toEqual([])
  })

  it('does not fetch before the wallet resolves', () => {
    currentDid = undefined
    const { Wrapper } = wrapper()
    renderHook(() => usePublisherApps(), { wrapper: Wrapper })
    expect(fetchPublisherApps).not.toHaveBeenCalled()
  })

  it('per-app hooks stay idle without an appId', () => {
    const { Wrapper } = wrapper()
    renderHook(() => usePublisherTemplates(null), { wrapper: Wrapper })
    expect(fetchTemplates).not.toHaveBeenCalled()
  })

  it('usePublisherLicenses asks for every status', async () => {
    fetchLicenses.mockResolvedValue([])
    const { Wrapper } = wrapper()
    const { result } = renderHook(() => usePublisherLicenses('app-1'), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(fetchLicenses).toHaveBeenCalledWith('app-1', null, 'tok')
  })

  it('useAppPublisher is true only for an app in myApps', async () => {
    fetchPublisherApps.mockResolvedValue([{ id: 'app-1', name: 'Vault', status: 'ACTIVE' }])
    const { Wrapper } = wrapper()
    const mine = renderHook(() => useAppPublisher('app-1'), { wrapper: Wrapper })
    await waitFor(() => expect(mine.result.current.isPending).toBe(false))
    expect(mine.result.current.isPublisher).toBe(true)
    expect(mine.result.current.app?.name).toBe('Vault')

    const theirs = renderHook(() => useAppPublisher('app-2'), { wrapper: Wrapper })
    await waitFor(() => expect(theirs.result.current.isPending).toBe(false))
    expect(theirs.result.current.isPublisher).toBe(false)
  })

  it('useAppPublisher reports "not the publisher" when myApps fails', async () => {
    // A coded refusal is not retried by retryPublisher, so the query settles at once.
    fetchPublisherApps.mockRejectedValue(new PublisherApiError('FORBIDDEN', 'no', 403))
    const { Wrapper } = wrapper()
    const { result } = renderHook(() => useAppPublisher('app-1'), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.isPublisher).toBe(false)
  })

  it('useAppPublisher is not pending while signed out', () => {
    currentDid = undefined
    const { Wrapper } = wrapper()
    const { result } = renderHook(() => useAppPublisher('app-1'), { wrapper: Wrapper })
    expect(result.current).toEqual({ isPublisher: false, app: undefined, isPending: false })
  })
})
