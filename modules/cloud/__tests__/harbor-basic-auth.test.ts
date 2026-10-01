import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchHarborTags } from '../registry/harbor'

afterEach(() => vi.unstubAllGlobals())

describe('fetchHarborTags with credentials', () => {
  it('sends basic auth on the first request when credentials are given', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ tags: ['sha-1'] })))
    vi.stubGlobal('fetch', fetchMock)
    const tags = await fetchHarborTags('achra/frontend', { username: 'robot$r', password: 'p' })
    expect(tags).toEqual(['sha-1'])
    const init = (fetchMock.mock.calls[0] as unknown[])[1] as RequestInit
    expect((init.headers as Record<string, string>).authorization).toBe(
      `Basic ${Buffer.from('robot$r:p').toString('base64')}`,
    )
  })
})
