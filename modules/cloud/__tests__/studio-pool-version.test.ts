import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchStudioPoolVersion } from '@/modules/invites/lib/client'

function mockFetch(impl: () => Promise<unknown>) {
  global.fetch = vi.fn(impl) as unknown as typeof fetch
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('fetchStudioPoolVersion', () => {
  it('returns the version the backend reports', async () => {
    mockFetch(async () => ({
      ok: true,
      json: async () => ({
        data: { VetraStudioPool: { config: { version: '0.0.1-dev.42' } } },
      }),
    }))
    expect(await fetchStudioPoolVersion()).toBe('0.0.1-dev.42')
  })

  it('returns null on transport failure (caller falls back to the constant)', async () => {
    mockFetch(async () => {
      throw new Error('network')
    })
    expect(await fetchStudioPoolVersion()).toBeNull()
  })

  it('returns null on a GraphQL error / older backend without the field', async () => {
    mockFetch(async () => ({
      ok: true,
      json: async () => ({ errors: [{ message: 'Cannot query field config' }] }),
    }))
    expect(await fetchStudioPoolVersion()).toBeNull()
  })
})
