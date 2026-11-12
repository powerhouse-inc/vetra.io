import { afterEach, describe, expect, it, vi } from 'vitest'
import { isVerifiedPublisherUrl, loadVerifiedDomains, publisherHref } from '../verified-publishers'

describe('publisherHref', () => {
  it('keeps http(s) links and drops everything else', () => {
    expect(publisherHref('https://web3.berlin')).toBe('https://web3.berlin')
    expect(publisherHref(' http://acme.example/about ')).toBe('http://acme.example/about')
    expect(publisherHref('javascript:alert(1)')).toBeNull()
    expect(publisherHref('acme.example')).toBeNull()
    expect(publisherHref('')).toBeNull()
    expect(publisherHref(undefined)).toBeNull()
  })
})

describe('isVerifiedPublisherUrl', () => {
  const verified = ['acme.example']

  it('accepts the verified domain and its subdomains', () => {
    expect(isVerifiedPublisherUrl('https://acme.example', verified)).toBe(true)
    expect(isVerifiedPublisherUrl('https://WWW.Acme.Example/about', verified)).toBe(true)
    expect(isVerifiedPublisherUrl('http://docs.acme.example.', verified)).toBe(true)
  })

  it('rejects look-alikes, other schemes and unverified publishers', () => {
    expect(isVerifiedPublisherUrl('https://evilacme.example', verified)).toBe(false)
    expect(isVerifiedPublisherUrl('https://acme.example.evil.test', verified)).toBe(false)
    expect(isVerifiedPublisherUrl('https://acme.example@evil.test', verified)).toBe(false)
    expect(isVerifiedPublisherUrl('javascript:alert(1)', verified)).toBe(false)
    expect(isVerifiedPublisherUrl('not a url', verified)).toBe(false)
    expect(isVerifiedPublisherUrl('https://acme.example', [])).toBe(false)
  })
})

describe('loadVerifiedDomains', () => {
  afterEach(() => vi.unstubAllGlobals())

  const page = (items: unknown[], next: string | null) =>
    new Response(JSON.stringify({ data: { organizationSearch: { items, next } } }))

  it('collects the verified domains of active organisations across pages', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        page(
          [
            { verifiedDomains: ['web3.berlin'], archived: false, takenDown: false },
            { verifiedDomains: ['old.example'], archived: true, takenDown: false },
          ],
          'p2',
        ),
      )
      .mockResolvedValueOnce(
        page(
          [
            { verifiedDomains: ['Acme.Example'], archived: false, takenDown: false },
            { verifiedDomains: ['gone.example'], archived: false, takenDown: true },
          ],
          null,
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    expect(await loadVerifiedDomains()).toEqual(['web3.berlin', 'acme.example'])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const calls = fetchMock.mock.calls as [string, RequestInit][]
    expect(calls[0][0]).toMatch(/\/graphql\/renown-orgs$/)
    const second = JSON.parse(calls[1][1].body as string) as { variables: { after: string | null } }
    expect(second.variables.after).toBe('p2')
  })

  it('treats an unreachable Renown as no verified domains', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')))
    expect(await loadVerifiedDomains()).toEqual([])
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('oops', { status: 502 })))
    expect(await loadVerifiedDomains()).toEqual([])
  })
})
