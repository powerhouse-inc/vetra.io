import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const pull = vi.fn(() => Promise.resolve({ state: { global: {} } }))
vi.mock('@powerhousedao/reactor-browser', () => ({
  RemoteDocumentController: { pull: (...a: unknown[]) => pull(...(a as [])), from: vi.fn() },
  createClient: () => ({}),
  useDid: () => 'did:pkh:me',
  useRenown: () => null,
}))
vi.mock('@/modules/cloud/hooks/use-can-sign', () => ({
  useCanSign: () => ({ canSign: true, signer: { user: { address: '0xme' } }, loading: false }),
}))
vi.mock('@/modules/cloud/graphql', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/modules/cloud/graphql')>()),
  getAuthToken: () => Promise.resolve('tok'),
}))

import { loadEnvironmentController } from '@/modules/cloud/controller'
import { useCanEditEnvironment } from '@/modules/cloud/hooks/use-environment-org'
import { editGateOwnerOrgId, resetOrgSyncCache } from '@/modules/cloud/org-sync'

const access = { environmentId: 'e1', ownerOrgId: 'o1', canOperate: false, canView: true }

function stubFetch(answer: unknown = access) {
  const queries: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn((_url: string, init: RequestInit) => {
      queries.push((JSON.parse(init.body as string) as { query: string }).query)
      return Promise.resolve(
        new Response(JSON.stringify({ data: { syncEnvironmentOrg: answer } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }),
  )
  return queries
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  resetOrgSyncCache()
  pull.mockClear()
})

const signer = { user: { address: '0xme' } } as never
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
)

describe('personal environments make no sync calls', () => {
  it('loads a personal (or not yet known) env without syncing', async () => {
    const queries = stubFetch()
    await loadEnvironmentController({ documentId: 'e1', parentIdentifier: 'd', signer })
    await loadEnvironmentController({
      documentId: 'e1',
      parentIdentifier: 'd',
      signer,
      ownerOrgId: null,
    })
    expect(pull).toHaveBeenCalledTimes(2)
    expect(queries).toHaveLength(0)
  })

  it('an unknown env whose first pull is refused syncs once, then retries', async () => {
    const queries = stubFetch()
    pull.mockRejectedValueOnce(new Error('Access denied'))
    await loadEnvironmentController({ documentId: 'e1', parentIdentifier: 'd', signer })
    expect(pull).toHaveBeenCalledTimes(2)
    expect(queries).toHaveLength(1)
    expect(queries[0]).toContain('syncEnvironmentOrg')
  })

  it('a known personal env never syncs, even when the pull fails', async () => {
    const queries = stubFetch()
    pull.mockRejectedValueOnce(new Error('boom'))
    await expect(
      loadEnvironmentController({
        documentId: 'e1',
        parentIdentifier: 'd',
        signer,
        ownerOrgId: null,
      }),
    ).rejects.toThrow('boom')
    expect(queries).toHaveLength(0)
  })

  it('rethrows the first refusal when the sync finds no organisation', async () => {
    const queries = stubFetch({ ...access, ownerOrgId: null, canView: false })
    pull.mockRejectedValueOnce(new Error('Document not found'))
    await expect(
      loadEnvironmentController({ documentId: 'e1', parentIdentifier: 'd', signer }),
    ).rejects.toThrow('Document not found')
    expect(queries).toHaveLength(1)
    expect(pull).toHaveBeenCalledTimes(1)
  })

  it('syncs before loading a known org env', async () => {
    const queries = stubFetch()
    await loadEnvironmentController({
      documentId: 'e1',
      parentIdentifier: 'd',
      signer,
      ownerOrgId: 'o1',
    })
    expect(queries).toHaveLength(1)
    expect(queries[0]).toContain('syncEnvironmentOrg')
  })

  it('edit gate: personal = signer, unknown = closed, org = canOperate', async () => {
    const queries = stubFetch()
    expect(renderHook(() => useCanEditEnvironment('e1', null), { wrapper }).result.current).toBe(
      true,
    )
    expect(
      renderHook(() => useCanEditEnvironment('e1', undefined), { wrapper }).result.current,
    ).toBe(false)
    expect(queries).toHaveLength(0)

    const org = renderHook(() => useCanEditEnvironment('e1', 'o1'), { wrapper })
    expect(org.result.current).toBe(false)
    await waitFor(() => expect(queries).toHaveLength(1))
    expect(org.result.current).toBe(false)
  })
})

describe('detail page edit gate input', () => {
  it('trusts a personal answer only from the signed controller', () => {
    // Read-only fetch says personal while the controller is loading: stay closed
    // (signed actions need the controller anyway).
    expect(editGateOwnerOrgId({ canSign: true, controllerLoaded: false, ownerOrgId: null })).toBe(
      undefined,
    )
    // An organisation known from the read model opens the sync-backed gate early.
    expect(editGateOwnerOrgId({ canSign: true, controllerLoaded: false, ownerOrgId: 'o1' })).toBe(
      'o1',
    )
    expect(editGateOwnerOrgId({ canSign: true, controllerLoaded: true, ownerOrgId: null })).toBe(
      null,
    )
    expect(
      editGateOwnerOrgId({ canSign: true, controllerLoaded: false, ownerOrgId: undefined }),
    ).toBe(undefined)
  })
})
