import { describe, it, expect } from 'vitest'
import { fetchMyApps, fetchLicenseTypes, fetchLicenses, fetchEnvironments } from '../graphql'
import type { FetchLike } from '../graphql'

const capture = (data: unknown) => {
  const calls: Array<{ query: string; variables: unknown }> = []
  const fetchImpl = (async (_url: string, init: RequestInit) => {
    calls.push(JSON.parse(init.body as string))
    return new Response(JSON.stringify({ data }), { status: 200 })
  }) as unknown as FetchLike
  return { calls, fetchImpl }
}

const has = (query: string, words: string[]) => {
  for (const w of words) expect(query).toMatch(new RegExp(`\\b${w}\\b`))
}

describe('publisher query fetchers', () => {
  it('fetchMyApps unwraps vetraPublisher.myApps, sends no variables and no argument', async () => {
    const { calls, fetchImpl } = capture({
      vetraPublisher: { myApps: [{ id: 'a1', name: 'Vault', status: 'ACTIVE' }] },
    })
    const apps = await fetchMyApps('t', fetchImpl)
    expect(apps).toEqual([{ id: 'a1', name: 'Vault', status: 'ACTIVE' }])
    expect(calls[0].variables).toEqual({})
    expect(calls[0].query).toMatch(/myApps\s*\{/)
    expect(calls[0].query).not.toContain('appId')
    has(calls[0].query, ['id', 'name', 'status'])
  })

  it('fetchLicenseTypes passes appId and selects every field including nested services and packages', async () => {
    const { calls, fetchImpl } = capture({ vetraPublisher: { licenseTypes: [] } })
    await fetchLicenseTypes('app-1', 't', fetchImpl)
    expect(calls[0].variables).toEqual({ appId: 'app-1' })
    expect(calls[0].query).toContain('licenseTypes(appId: $appId)')
    has(calls[0].query, ['id', 'kind', 'label', 'status', 'validityDays', 'templateHash'])
    expect(calls[0].query).toMatch(/services\s*\{[^}]*\bid\b[^}]*\btype\b[^}]*\bprefix\b[^}]*\}/)
    expect(calls[0].query).toMatch(
      /packages\s*\{[^}]*\bid\b[^}]*\bpackageName\b[^}]*\bversion\b[^}]*\}/,
    )
  })

  it('fetchLicenses passes a null status when none is given and selects every field', async () => {
    const { calls, fetchImpl } = capture({ vetraPublisher: { licenses: [] } })
    await fetchLicenses('app-1', null, 't', fetchImpl)
    expect(calls[0].variables).toEqual({ appId: 'app-1', status: null })
    expect(calls[0].query).toContain('licenses(appId: $appId, status: $status)')
    has(calls[0].query, ['id', 'user', 'licenseTypeId', 'status', 'start', 'end', 'environmentId'])
  })

  it('fetchLicenses forwards a given status', async () => {
    const { calls, fetchImpl } = capture({ vetraPublisher: { licenses: [] } })
    await fetchLicenses('app-1', 'ACTIVE', 't', fetchImpl)
    expect(calls[0].variables).toEqual({ appId: 'app-1', status: 'ACTIVE' })
  })

  it('fetchEnvironments unwraps vetraPublisher.environments, passes appId and selects every field', async () => {
    const row = { appId: 'app-1', user: '0xa', environmentId: 'e1', licenseId: 'l1', templateHash: 'h' }
    const { calls, fetchImpl } = capture({ vetraPublisher: { environments: [row] } })
    expect(await fetchEnvironments('app-1', 't', fetchImpl)).toEqual([row])
    expect(calls[0].variables).toEqual({ appId: 'app-1' })
    expect(calls[0].query).toContain('environments(appId: $appId)')
    has(calls[0].query, ['appId', 'user', 'environmentId', 'licenseId', 'templateHash'])
  })
})
