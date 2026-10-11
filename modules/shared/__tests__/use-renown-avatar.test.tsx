import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { type ReactNode } from 'react'

const SHA = 'cd34'.repeat(16)
let auth: {
  address: string | undefined
  user:
    | { profile?: { documentId: string; userImage: string | null }; ens?: { avatarUrl?: string } }
    | undefined
}
vi.mock('@powerhousedao/reactor-browser', () => ({ useRenownAuth: () => auth }))

import { useRenownAvatarUrl } from '../hooks/use-renown-avatar'

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

function answer(renownUsers: unknown[] | null, ok = true) {
  return vi.fn(() =>
    Promise.resolve(
      ok
        ? new Response(JSON.stringify({ data: { renownUsers } }), { status: 200 })
        : new Response('down', { status: 503 }),
    ),
  )
}

describe('useRenownAvatarUrl', () => {
  beforeEach(() => {
    auth = {
      address: '0xAbC0000000000000000000000000000000000001',
      // Stale seed from the session cookie.
      user: { profile: { documentId: 'doc-1', userImage: 'https://old.example/me.png' } },
    }
  })
  afterEach(() => vi.unstubAllGlobals())

  it('paints the seed first, then switches to the uploaded avatar from Renown', async () => {
    const fetchMock = answer([
      { documentId: 'doc-1', avatar: `attachment://v1:${SHA}`, userImage: null },
    ])
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useRenownAvatarUrl(), { wrapper })
    expect(result.current).toBe('https://old.example/me.png')
    await waitFor(() =>
      expect(result.current).toBe('https://www.renown.id/media/doc-1/avatar?v=cd34cd34cd34'),
    )
  })

  it('drops a stale seeded image once Renown says there is none', async () => {
    vi.stubGlobal('fetch', answer([{ documentId: 'doc-1', avatar: null, userImage: null }]))
    const { result } = renderHook(() => useRenownAvatarUrl(), { wrapper })
    await waitFor(() => expect(result.current).toBeUndefined())
  })

  it('keeps the seed when Renown is unreachable', async () => {
    const fetchMock = answer(null, false)
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useRenownAvatarUrl(), { wrapper })
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(result.current).toBe('https://old.example/me.png')
  })

  it('does not query without an address', () => {
    auth = { address: undefined, user: undefined }
    const fetchMock = answer([])
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useRenownAvatarUrl(), { wrapper })
    expect(result.current).toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
