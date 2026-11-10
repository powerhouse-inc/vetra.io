import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@powerhousedao/reactor-browser', () => ({ useDid: () => 'did:me', useRenown: () => null }))
vi.mock('@/modules/cloud/graphql', () => ({ getAuthToken: () => Promise.resolve('tok') }))
vi.mock('../graphql', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../graphql')>()),
  deleteApp: () => Promise.resolve(true),
}))

import { useDeleteApp } from '../hooks/use-apps'

describe('useDeleteApp', () => {
  it('drops a deleted licensing-only app from the publisher list and its apps record', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    qc.setQueryData(['publisher', 'apps', 'did:me', null], [{ id: 'dao', status: 'ACTIVE' }])
    qc.setQueryData(['apps', 'record', 'dao', 'did:me'], { id: 'dao', status: 'ACTIVE' })
    const invalidate = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useDeleteApp(), {
      wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>,
    })
    await act(() => result.current.mutateAsync({ appId: 'dao', deleteEnvironments: false }))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['publisher', 'apps'] })
    expect(qc.getQueryData(['apps', 'record', 'dao', 'did:me'])).toBeUndefined()
  })
})
