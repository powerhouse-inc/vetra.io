import { describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/modules/publisher/graphql', () => ({
  publisherGql: () =>
    Promise.resolve({
      vetraSubscriptions: {
        directory: [
          { appId: 'kv', name: 'bai-knowledge-note', appDid: 'did:key:kv', holders: 1, plans: 1 },
          { appId: 'studio', name: 'Vetra Studio', appDid: null, holders: 3, plans: 2 },
          { appId: 'bare', name: 'bare', appDid: 'did:key:bare', holders: 0, plans: 1 },
        ],
      },
    }),
}))
vi.mock('../lib/app-profile/api', () => ({
  fetchAppProfile: (did: string) =>
    Promise.resolve(did === 'did:key:kv' ? { name: 'Knowledge Vault' } : null),
}))

import { useAppNameOf } from '../hooks/use-app-names'

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return Wrapper
}

describe('useAppNameOf', () => {
  it('names an app by id through its Renown profile, else keeps the given name', async () => {
    const { result } = renderHook(() => useAppNameOf(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current('kv', 'bai-knowledge-note')).toBe('Knowledge Vault'))
    expect(result.current('studio', 'Vetra Studio')).toBe('Vetra Studio')
    expect(result.current('bare', 'bare')).toBe('bare')
    expect(result.current('unknown', 'Sektar')).toBe('Sektar')
  })
})
