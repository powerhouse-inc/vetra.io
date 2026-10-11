import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchRenownAvatarProfile, isSafeImageUrl, resolveAvatarUrl } from '../renown-avatar'

const SHA = 'ab12'.repeat(16)
const ADDRESS = '0x2BBEA0145D6FB9C6709A74C1179CA0BE71BB3AC6'

describe('isSafeImageUrl', () => {
  it('accepts http(s) URLs and inline raster images only', () => {
    expect(isSafeImageUrl('https://example.com/a.png')).toBe(true)
    expect(isSafeImageUrl('http://example.com/a.png')).toBe(true)
    expect(isSafeImageUrl('data:image/png;base64,AAAA')).toBe(true)
    expect(isSafeImageUrl('attachment://v1:' + SHA)).toBe(false)
    expect(isSafeImageUrl('ipfs://bafy')).toBe(false)
    expect(isSafeImageUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeImageUrl('data:image/svg+xml;base64,AAAA')).toBe(false)
    expect(isSafeImageUrl('')).toBe(false)
  })
})

describe('resolveAvatarUrl', () => {
  afterEach(() => {
    delete (window as unknown as { __ENV?: unknown }).__ENV
  })

  it('prefers the uploaded Renown avatar, as a versioned renown.id media URL', () => {
    expect(
      resolveAvatarUrl({
        profile: {
          documentId: 'doc-1',
          avatar: `attachment://v1:${SHA}`,
          userImage: 'https://x/y.png',
        },
        ensAvatarUrl: 'https://ens/a.png',
      }),
    ).toBe('https://www.renown.id/media/doc-1/avatar?v=ab12ab12ab12')
  })

  it('builds the media URL from the configured Renown web URL', () => {
    ;(window as unknown as { __ENV: Record<string, string> }).__ENV = {
      NEXT_PUBLIC_RENOWN_URL: 'https://renown-staging.vetra.io/',
    }
    expect(
      resolveAvatarUrl({ profile: { documentId: 'doc 9', avatar: `attachment://v1:${SHA}` } }),
    ).toBe('https://renown-staging.vetra.io/media/doc%209/avatar?v=ab12ab12ab12')
  })

  it('falls back to a safe userImage, then a safe ENS avatar', () => {
    expect(resolveAvatarUrl({ profile: { documentId: 'd', userImage: 'https://x/y.png' } })).toBe(
      'https://x/y.png',
    )
    expect(
      resolveAvatarUrl({
        profile: { documentId: 'd', userImage: 'ipfs://bafy' },
        ensAvatarUrl: 'https://ens/a.png',
      }),
    ).toBe('https://ens/a.png')
    expect(resolveAvatarUrl({ profile: null, ensAvatarUrl: 'data:image/png;base64,AAAA' })).toBe(
      'data:image/png;base64,AAAA',
    )
  })

  it('returns null when nothing is usable, so the fallback shows', () => {
    expect(resolveAvatarUrl({ profile: { documentId: 'd', avatar: null, userImage: null } })).toBe(
      null,
    )
    // An avatar ref without its document id cannot be addressed.
    expect(resolveAvatarUrl({ profile: { avatar: `attachment://v1:${SHA}` } })).toBe(null)
    expect(resolveAvatarUrl({ ensAvatarUrl: 'ipfs://bafy' })).toBe(null)
    expect(resolveAvatarUrl({})).toBe(null)
  })
})

/** A fetch stub answering every call with `body` (JSON unless a string). */
function respond(body: unknown, status = 200) {
  const text = typeof body === 'string' ? body : JSON.stringify(body)
  return vi.fn<typeof fetch>(() => Promise.resolve(new Response(text, { status })))
}

describe('fetchRenownAvatarProfile', () => {
  it('asks the Renown switchboard for the avatar fields of the lower-cased address', async () => {
    const fetchImpl = respond({
      data: {
        renownUsers: [{ documentId: 'doc-1', avatar: `attachment://v1:${SHA}`, userImage: null }],
      },
    })
    const profile = await fetchRenownAvatarProfile(ADDRESS, {
      endpoint: 'https://sb.example/graphql',
      fetchImpl,
    })
    expect(profile).toEqual({
      documentId: 'doc-1',
      avatar: `attachment://v1:${SHA}`,
      userImage: null,
    })
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://sb.example/graphql')
    const body = JSON.parse(init?.body as string) as {
      query: string
      variables: { input: { driveId: string; ethAddresses: string[] } }
    }
    expect(body.query).toMatch(/renownUsers/)
    expect(body.query).toMatch(/\bavatar\b/)
    expect(body.query).toMatch(/\bdocumentId\b/)
    const lower = ADDRESS.toLowerCase()
    expect(body.variables.input).toEqual({ driveId: `renown-${lower}`, ethAddresses: [lower] })
  })

  it('returns null when the address has no Renown profile', async () => {
    const fetchImpl = respond({ data: { renownUsers: [] } })
    expect(await fetchRenownAvatarProfile(ADDRESS, { fetchImpl })).toBe(null)
  })

  it('throws on HTTP and GraphQL failures, so callers keep what they had', async () => {
    await expect(
      fetchRenownAvatarProfile(ADDRESS, { fetchImpl: respond('nope', 502) }),
    ).rejects.toThrow()
    await expect(
      fetchRenownAvatarProfile(ADDRESS, {
        fetchImpl: respond({ data: null, errors: [{ message: 'x' }] }),
      }),
    ).rejects.toThrow()
  })
})
