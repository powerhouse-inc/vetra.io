import { type PackageInfo } from '@powerhousedao/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { legacyQuery, listPackages, npmName } from '../registry'

function pkg(
  name: string,
  manifest: Partial<NonNullable<PackageInfo['manifest']>> | null,
  path = `/-/cdn/${name}`,
): PackageInfo {
  return {
    name,
    path,
    manifest: manifest as PackageInfo['manifest'],
    documentTypes: [],
    version: '1.0.0',
  }
}

const all = [
  pkg('@acme/billing', {
    name: 'Billing',
    description: 'Invoices',
    category: 'finance',
    publisher: { name: 'Acme', url: '' },
    documentModels: [{ id: 'acme/invoice', name: 'Invoice' }],
  } as never),
  pkg('@acme/notes', {
    name: 'Notes',
    description: 'Billing notes',
    category: 'productivity',
    publisher: { name: 'Acme', url: '' },
    editors: [{ id: 'notes-editor', name: 'Notes Editor' }],
  } as never),
  pkg('Ledger App', { name: 'Ledger App', category: 'finance' }, '/-/cdn/@other/ledger'),
  pkg('@acme/raw', null),
]

describe('legacyQuery', () => {
  it('drops packages without a manifest and sorts by name', () => {
    expect(legacyQuery(all, {}).items.map((p) => p.name)).toEqual([
      '@acme/billing',
      '@acme/notes',
      'Ledger App',
    ])
  })

  it('ranks name matches before text matches', () => {
    expect(legacyQuery(all, { search: 'BILL' }).items.map((p) => p.name)).toEqual([
      '@acme/billing',
      '@acme/notes',
    ])
  })

  it('ORs within a filter and ANDs across filters', () => {
    const q = { categories: ['finance', 'productivity'], moduleTypes: ['editors' as const] }
    expect(legacyQuery(all, q).items.map((p) => p.name)).toEqual(['@acme/notes'])
  })

  it('computes facets over the name-restricted set only', () => {
    const page = legacyQuery(all, { names: ['@ACME/notes'], search: 'nothing' })
    expect(page.total).toBe(0)
    expect(page.facets).toEqual({ categories: ['productivity'], publishers: ['Acme'] })
  })

  it('slices a page', () => {
    const page = legacyQuery(all, { limit: 2, offset: 1 })
    expect(page).toMatchObject({ total: 3, limit: 2, offset: 1, hasMore: false })
    expect(page.items.map((p) => p.name)).toEqual(['@acme/notes', 'Ledger App'])
  })
})

describe('npmName', () => {
  it('reads the npm name from the CDN path', () => {
    expect(npmName(all[2])).toBe('@other/ledger')
  })
})

describe('listPackages', () => {
  afterEach(() => vi.unstubAllGlobals())

  function stubFetch(...bodies: unknown[]) {
    const fetch = vi.fn()
    for (const body of bodies) fetch.mockResolvedValueOnce(Response.json(body))
    vi.stubGlobal('fetch', fetch)
    return fetch
  }

  it('returns a paginated reply as is', async () => {
    const reply = { items: [], total: 0, limit: 5, offset: 0, hasMore: false, facets: {} }
    const fetch = stubFetch(reply)
    const page = await listPackages(
      { search: 'x', names: ['a', 'b'], categories: ['finance'], limit: 5 },
      { registryUrl: 'https://r.test', detail: 'full' },
    )
    expect(page).toEqual(reply)
    expect(fetch).toHaveBeenCalledOnce()
    expect(fetch.mock.calls[0][0]).toBe(
      'https://r.test/packages?facets=true&detail=full&limit=5&search=x&name=a&name=b&category=finance',
    )
  })

  it('queries a bare array in-process', async () => {
    stubFetch(all)
    const page = await listPackages({ search: 'ledger' }, { registryUrl: 'https://r.test' })
    expect(page.items).toEqual([
      {
        name: 'Ledger App',
        path: '/-/cdn/@other/ledger',
        version: '1.0.0',
        description: undefined,
        category: 'finance',
        publisher: undefined,
      },
    ])
  })

  it('refetches the full list when the reply has no facets', async () => {
    const fetch = stubFetch({ items: [], total: 0, limit: 30, offset: 0, hasMore: false }, all)
    const page = await listPackages({ limit: 30 }, { registryUrl: 'https://r.test' })
    expect(fetch.mock.calls[1][0]).toBe('https://r.test/packages')
    expect(page.total).toBe(3)
  })
})
