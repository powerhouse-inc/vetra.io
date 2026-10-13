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
import { resetOrgSyncCache } from '@/modules/cloud/org-sync'

const access = { environmentId: 'e1', ownerOrgId: 'o1', canOperate: false, canView: true }

function stubFetch() {
  const queries: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn((_url: string, init: RequestInit) => {
      queries.push((JSON.parse(init.body as string) as { query: string }).query)
      return Promise.resolve(
        new Response(JSON.stringify({ data: { syncEnvironmentOrg: access } }), {
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
