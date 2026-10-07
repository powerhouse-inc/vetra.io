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

// Body of the `{ ... }` that follows `field` (optionally with an argument list),
// brace-balanced. Asserting against this, not the whole document, matters: a
// variable declaration such as `$status: String` would otherwise satisfy a check
// that `status` is in the selection.
const selectionOf = (query: string, field: string): string => {
  const m = new RegExp(`\\b${field}\\s*(\\([^)]*\\))?\\s*\\{`).exec(query)
  if (!m) throw new Error(`no selection for ${field} in: ${query}`)
  let depth = 1
  let i = m.index + m[0].length
  const start = i
  for (; i < query.length && depth > 0; i++) {
    if (query[i] === '{') depth++
    else if (query[i] === '}') depth--
  }
  return query.slice(start, i - 1)
}

// Field names selected at the top level of a selection, with nested blocks
// reduced to their field name. Compared for exact equality so dropping OR
// adding any field fails.
const topLevelFields = (selection: string): string[] => {
  let flat = selection
  let prev: string
  do {
    prev = flat
    flat = flat.replace(/\{[^{}]*\}/g, '')
  } while (flat !== prev)
  return flat.split(/\s+/).filter(Boolean)
}

const fieldsOf = (query: string, field: string) => topLevelFields(selectionOf(query, field))
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
    expect(fieldsOf(calls[0].query, 'myApps')).toEqual(['id', 'name', 'status'])
  })

  it('fetchLicenseTypes passes appId and selects every field including nested services and packages', async () => {
    const { calls, fetchImpl } = capture({ vetraPublisher: { licenseTypes: [] } })
    await fetchLicenseTypes('app-1', 't', fetchImpl)
    expect(calls[0].variables).toEqual({ appId: 'app-1' })
    expect(calls[0].query).toContain('licenseTypes(appId: $appId)')
    const sel = selectionOf(calls[0].query, 'licenseTypes')
    expect(topLevelFields(sel)).toEqual([
      'id',
      'kind',
      'label',
      'status',
      'validityDays',
      'templateHash',
      'size',
      'baseDomain',
      'packageRegistry',
      'services',
      'packages',
    ])
    expect(topLevelFields(selectionOf(sel, 'services'))).toEqual(['id', 'type', 'prefix'])
    expect(topLevelFields(selectionOf(sel, 'packages'))).toEqual(['id', 'packageName', 'version'])
  })

  it('fetchLicenses passes a null status when none is given and selects every field', async () => {
    const { calls, fetchImpl } = capture({ vetraPublisher: { licenses: [] } })
    await fetchLicenses('app-1', null, 't', fetchImpl)
    expect(calls[0].variables).toEqual({ appId: 'app-1', status: null })
    expect(calls[0].query).toContain('licenses(appId: $appId, status: $status)')
    expect(fieldsOf(calls[0].query, 'licenses')).toEqual([
      'id',
      'user',
      'licenseTypeId',
      'status',
      'start',
      'end',
      'environmentId',
    ])
  })

  it('fetchLicenses forwards a given status', async () => {
    const { calls, fetchImpl } = capture({ vetraPublisher: { licenses: [] } })
    await fetchLicenses('app-1', 'ACTIVE', 't', fetchImpl)
    expect(calls[0].variables).toEqual({ appId: 'app-1', status: 'ACTIVE' })
  })

  it('fetchEnvironments unwraps vetraPublisher.environments, passes appId and selects every field', async () => {
    const row = {
      appId: 'app-1',
      user: '0xa',
      environmentId: 'e1',
      licenseId: 'l1',
      templateHash: 'h',
    }
    const { calls, fetchImpl } = capture({ vetraPublisher: { environments: [row] } })
    expect(await fetchEnvironments('app-1', 't', fetchImpl)).toEqual([row])
    expect(calls[0].variables).toEqual({ appId: 'app-1' })
    expect(calls[0].query).toContain('environments(appId: $appId)')
    expect(fieldsOf(calls[0].query, 'environments')).toEqual([
      'appId',
      'user',
      'environmentId',
      'licenseId',
      'templateHash',
    ])
  })
})
