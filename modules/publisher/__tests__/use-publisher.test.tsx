import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import React from 'react'

const fetchMyApps = vi.fn()
const fetchLicenseTypes = vi.fn()
const fetchLicenses = vi.fn()
const fetchEnvironments = vi.fn()
const getAuthToken = vi.fn()
let currentDid: string | undefined = 'did:key:z1'

vi.mock('../graphql', async (orig) => ({
  ...(await orig<typeof import('../graphql')>()),
  fetchMyApps: (...a: unknown[]) => fetchMyApps(...a),
  fetchLicenseTypes: (...a: unknown[]) => fetchLicenseTypes(...a),
  fetchLicenses: (...a: unknown[]) => fetchLicenses(...a),
  fetchEnvironments: (...a: unknown[]) => fetchEnvironments(...a),
}))
vi.mock('@/modules/cloud/graphql', () => ({
  getAuthToken: (...a: unknown[]) => getAuthToken(...a),
}))
vi.mock('@/modules/cloud/query/use-authed-query', () => ({
  useAuthedQuery: (
    key: readonly unknown[],
    fetcher: (t: string | null) => Promise<unknown>,
    options?: object,
  ) => useQuery({ queryKey: key, queryFn: () => fetcher('tok'), ...options }),
}))
vi.mock('@powerhousedao/reactor-browser', () => ({
  useDid: () => currentDid,
  useRenown: () => ({ user: { did: currentDid } }),
}))

import {
  useMyApps,
  usePublisherLicenseTypes,
  usePublisherLicenses,
  usePublisherEnvironments,
  usePublisherToken,
} from '../hooks/use-publisher'
import { publisherKeys } from '../hooks/keys'

function makeWrapper(qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return { qc, Wrapper }
}

beforeEach(() => {
  for (const f of [fetchMyApps, fetchLicenseTypes, fetchLicenses, fetchEnvironments, getAuthToken])
    f.mockReset()
  currentDid = 'did:key:z1'
})

describe('publisher read hooks', () => {
  it('useMyApps returns the apps the wallet owns, passing the token through', async () => {
    fetchMyApps.mockResolvedValue([{ id: 'a1', name: 'Vault', status: 'ACTIVE' }])
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useMyApps(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.data).toHaveLength(1))
    expect(result.current.data![0].name).toBe('Vault')
    expect(fetchMyApps).toHaveBeenCalledWith('tok')
  })

  it('useMyApps returns an empty array rather than undefined when the wallet owns none', async () => {
    fetchMyApps.mockResolvedValue([])
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useMyApps(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })

  it('useMyApps coerces a null server list to an empty array', async () => {
    fetchMyApps.mockResolvedValue(null)
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useMyApps(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })

  it.each([
    ['usePublisherLicenseTypes', () => usePublisherLicenseTypes(null), fetchLicenseTypes],
    ['usePublisherLicenses', () => usePublisherLicenses(null, null), fetchLicenses],
    ['usePublisherEnvironments', () => usePublisherEnvironments(null), fetchEnvironments],
  ] as ReadonlyArray<readonly [string, () => { fetchStatus: string }, ReturnType<typeof vi.fn>]>)(
    '%s does not fire without an appId',
    async (_n, useHook, fetcher) => {
      const { Wrapper } = makeWrapper()
      const { result } = renderHook(useHook, { wrapper: Wrapper })
      await waitFor(() => expect(result.current.fetchStatus).toBe('idle'))
      expect(fetcher).not.toHaveBeenCalled()
    },
  )

  it('fires with the appId and status when one is given', async () => {
    fetchLicenseTypes.mockResolvedValue([])
    fetchLicenses.mockResolvedValue([])
    fetchEnvironments.mockResolvedValue([])
    const { Wrapper } = makeWrapper()
    const t = renderHook(() => usePublisherLicenseTypes('app-1'), { wrapper: Wrapper })
    const l = renderHook(() => usePublisherLicenses('app-1', 'ACTIVE'), { wrapper: Wrapper })
    const e = renderHook(() => usePublisherEnvironments('app-1'), { wrapper: Wrapper })
    await waitFor(() =>
      expect(
        t.result.current.isSuccess && l.result.current.isSuccess && e.result.current.isSuccess,
      ).toBe(true),
    )
    expect(fetchLicenseTypes).toHaveBeenCalledWith('app-1', 'tok')
    expect(fetchLicenses).toHaveBeenCalledWith('app-1', 'ACTIVE', 'tok')
    expect(fetchEnvironments).toHaveBeenCalledWith('app-1', 'tok')
  })

  it('two wallets on one QueryClient never share a cache entry', async () => {
    fetchLicenseTypes.mockImplementation(async () => [{ id: `t-for-${currentDid}` }])
    const { qc, Wrapper } = makeWrapper()

    currentDid = 'did:key:A'
    const a = renderHook(() => usePublisherLicenseTypes('app-1'), { wrapper: Wrapper })
    await waitFor(() => expect(a.result.current.isSuccess).toBe(true))
    a.unmount()

    currentDid = 'did:key:B'
    const b = renderHook(() => usePublisherLicenseTypes('app-1'), { wrapper: Wrapper })
    // B must not be served A's cached tiers, not even transiently.
    expect(b.result.current.data).toBeUndefined()
    await waitFor(() => expect(b.result.current.isSuccess).toBe(true))
    expect(fetchLicenseTypes).toHaveBeenCalledTimes(2)
    expect(b.result.current.data).toEqual([{ id: 't-for-did:key:B' }])
    expect(qc.getQueryData(publisherKeys.types('app-1', 'did:key:A'))).toEqual([
      { id: 't-for-did:key:A' },
    ])
  })

  it('licenses are cached per status', async () => {
    fetchLicenses.mockResolvedValue([])
    const { qc, Wrapper } = makeWrapper()
    const all = renderHook(() => usePublisherLicenses('app-1', null), { wrapper: Wrapper })
    const act = renderHook(() => usePublisherLicenses('app-1', 'ACTIVE'), { wrapper: Wrapper })
    await waitFor(() =>
      expect(all.result.current.isSuccess && act.result.current.isSuccess).toBe(true),
    )
    expect(fetchLicenses).toHaveBeenCalledTimes(2)
    expect(qc.getQueryData(publisherKeys.licenses('app-1', null, 'did:key:z1'))).toBeDefined()
    expect(qc.getQueryData(publisherKeys.licenses('app-1', 'ACTIVE', 'did:key:z1'))).toBeDefined()
  })

  it('keys embed the viewer did', () => {
    expect(publisherKeys.apps('did:key:z1')).not.toEqual(publisherKeys.apps('did:key:z2'))
    expect(publisherKeys.types('app-1', 'did:a')).not.toEqual(publisherKeys.types('app-1', 'did:b'))
    expect(publisherKeys.licenses('app-1', null, 'did:a')).not.toEqual(
      publisherKeys.licenses('app-1', null, 'did:b'),
    )
    expect(publisherKeys.environments('app-1', 'did:a')).not.toEqual(
      publisherKeys.environments('app-1', 'did:b'),
    )
  })
})

describe('usePublisherToken', () => {
  it('waits for a token that is not minted yet instead of returning null at once', async () => {
    getAuthToken.mockResolvedValueOnce(null).mockResolvedValueOnce('late-token')
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => usePublisherToken(), { wrapper: Wrapper })
    await expect(result.current()).resolves.toBe('late-token')
    expect(getAuthToken).toHaveBeenCalledTimes(2)
  })
})
