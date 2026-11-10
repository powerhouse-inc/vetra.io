import { describe, expect, it, vi } from 'vitest'
import { loadAppsDirectory } from '../directory'

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })

const DIRECTORY = [
  { appId: 'studio', name: 'Vetra Studio', appDid: null, holders: 36, plans: 1 },
  { appId: 'sektar', name: 'Sektar', appDid: 'did:key:sektar', holders: 12, plans: 2 },
  { appId: 'vault', name: 'knowledge-vault', appDid: 'did:key:vault', holders: 0, plans: 1 },
]

const PROFILES: Record<string, unknown> = {
  'did:key:sektar': {
    appDid: 'did:key:sektar',
    documentId: 'doc-sektar',
    name: 'Sektar Cloud',
    tagline: 'Budgets for DAOs',
    logo: null,
    logoRef: null,
    category: 'Productivity',
  },
}

/** The licensing directory, then one Renown profile read per app with an identity. */
function fakeFetch(opts: { directoryFails?: boolean; profileFails?: boolean } = {}) {
  return vi.fn((_url: string, init?: RequestInit): Promise<Response> => {
    const body = JSON.parse(init?.body as string) as {
      query: string
      variables?: { appDid?: string }
    }
    if (body.query.includes('directory')) {
      if (opts.directoryFails) return Promise.resolve(new Response('down', { status: 503 }))
      return Promise.resolve(json({ data: { vetraSubscriptions: { directory: DIRECTORY } } }))
    }
    if (opts.profileFails) return Promise.reject(new Error('renown down'))
    return Promise.resolve(
      json({ data: { appProfile: PROFILES[body.variables?.appDid ?? ''] ?? null } }),
    )
  })
}

describe('loadAppsDirectory', () => {
  it('keeps the ranking and adds each Renown profile where there is one', async () => {
    const apps = await loadAppsDirectory(fakeFetch() as unknown as typeof fetch)
    expect(apps.map((a) => [a.appId, a.holders])).toStrictEqual([
      ['studio', 36],
      ['sektar', 12],
      ['vault', 0],
    ])
    expect(apps[1]).toMatchObject({
      name: 'Sektar Cloud',
      tagline: 'Budgets for DAOs',
      category: 'Productivity',
    })
    expect(apps[1]?.pageUrl).toContain('/app/did:key:sektar')
    expect(apps[0]).toMatchObject({ name: 'Vetra Studio', tagline: null, pageUrl: null })
    expect(apps[2]).toMatchObject({ name: 'knowledge-vault', pageUrl: null })
  })

  it('asks Renown only about apps that have an identity', async () => {
    const fetchImpl = fakeFetch()
    await loadAppsDirectory(fetchImpl as unknown as typeof fetch)
    const asked = fetchImpl.mock.calls
      .map(([, init]) => JSON.parse(init?.body as string) as { variables?: { appDid?: string } })
      .flatMap((b) => (b.variables?.appDid ? [b.variables.appDid] : []))
    expect(asked.sort()).toStrictEqual(['did:key:sektar', 'did:key:vault'])
  })

  it('still lists every app when Renown cannot be read', async () => {
    const apps = await loadAppsDirectory(
      fakeFetch({ profileFails: true }) as unknown as typeof fetch,
    )
    expect(apps.map((a) => a.name)).toStrictEqual(['Vetra Studio', 'Sektar', 'knowledge-vault'])
    expect(apps.every((a) => a.pageUrl === null)).toBe(true)
  })

  it('throws when the directory itself cannot be read', async () => {
    await expect(
      loadAppsDirectory(fakeFetch({ directoryFails: true }) as unknown as typeof fetch),
    ).rejects.toThrow()
  })
})
