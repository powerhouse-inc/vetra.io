import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

const fetchAppProfile = vi.fn()
vi.mock('../lib/app-profile/api', () => ({
  fetchAppProfile: (did: string) => fetchAppProfile(did) as unknown,
}))

import { useAppLogo, useAppName } from '../hooks/use-app-profile'

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return Wrapper
}

describe('useAppName', () => {
  beforeEach(() => fetchAppProfile.mockReset())

  it("is the Renown profile's name once it loads", async () => {
    fetchAppProfile.mockResolvedValue({ name: 'Knowledge Vault' })
    const { result } = renderHook(() => useAppName('did:key:kv', 'bai-knowledge-note'), {
      wrapper: wrapper(),
    })
    await waitFor(() => expect(result.current).toBe('Knowledge Vault'))
  })

  it('keeps the app name without a profile, a profile name, or an identity', async () => {
    fetchAppProfile.mockResolvedValue(null)
    const none = renderHook(() => useAppName('did:key:x', 'shop'), { wrapper: wrapper() })
    await waitFor(() => expect(fetchAppProfile).toHaveBeenCalled())
    expect(none.result.current).toBe('shop')

    fetchAppProfile.mockResolvedValue({ name: '  ' })
    const blank = renderHook(() => useAppName('did:key:y', 'shop'), { wrapper: wrapper() })
    await waitFor(() => expect(fetchAppProfile).toHaveBeenCalledTimes(2))
    expect(blank.result.current).toBe('shop')

    const noDid = renderHook(() => useAppName(null, 'shop'), { wrapper: wrapper() })
    expect(noDid.result.current).toBe('shop')
  })
})

describe('useAppLogo', () => {
  beforeEach(() => fetchAppProfile.mockReset())

  it("is the Renown profile's uploaded logo, versioned by its ref", async () => {
    const ref = `attachment://v1:${'a'.repeat(64)}`
    fetchAppProfile.mockResolvedValue({ documentId: 'doc-kv', logoRef: ref, logo: null })
    const { result } = renderHook(() => useAppLogo('did:key:kv'), { wrapper: wrapper() })
    await waitFor(() => expect(result.current).toMatch(/\/media\/doc-kv\/logo\?v=aaaaaaaaaaaa$/))
  })

  it('takes a safe legacy logo, and nothing without a profile or an identity', async () => {
    fetchAppProfile.mockResolvedValue({
      documentId: 'd',
      logoRef: null,
      logo: 'https://x.test/l.png',
    })
    const legacy = renderHook(() => useAppLogo('did:key:a'), { wrapper: wrapper() })
    await waitFor(() => expect(legacy.result.current).toBe('https://x.test/l.png'))

    fetchAppProfile.mockResolvedValue({
      documentId: 'd',
      logoRef: null,
      logo: 'javascript:alert(1)',
    })
    const unsafe = renderHook(() => useAppLogo('did:key:b'), { wrapper: wrapper() })
    await waitFor(() => expect(fetchAppProfile).toHaveBeenCalledTimes(2))
    expect(unsafe.result.current).toBeNull()

    expect(renderHook(() => useAppLogo(null), { wrapper: wrapper() }).result.current).toBeNull()
  })
})
