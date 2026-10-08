import { describe, it, expect } from 'vitest'
import * as api from '../graphql'
import type { FetchLike } from '../graphql'

const capture = (data: unknown) => {
  const calls: Array<{ query: string; variables: unknown }> = []
  const fetchImpl = (async (_url: string, init: RequestInit) => {
    calls.push(JSON.parse(init.body as string))
    return new Response(JSON.stringify({ data }), { status: 200 })
  }) as unknown as FetchLike
  return { calls, fetchImpl }
}

// Body of the `{ ... }` that follows `field`, brace-balanced, so a variable
// declaration like `$status: String` can never satisfy a selection check.
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

type Read = {
  name: string
  field: string
  call: (f: FetchLike) => Promise<unknown>
  variables: Record<string, unknown>
  fields: string[]
}

const READS: Read[] = [
  {
    name: 'fetchPublisherApps',
    field: 'myApps',
    call: (f) => api.fetchPublisherApps('t', f),
    variables: {},
    fields: ['id', 'name', 'status'],
  },
  {
    name: 'fetchTemplates',
    field: 'templates',
    call: (f) => api.fetchTemplates('app-1', 't', f),
    variables: { appId: 'app-1' },
    fields: [
      'id',
      'name',
      'mode',
      'sharedEnvironment',
      'size',
      'baseDomain',
      'packageRegistry',
      'templateHash',
      'environmentCount',
      'services',
      'packages',
    ],
  },
  {
    name: 'fetchTerms',
    field: 'terms',
    call: (f) => api.fetchTerms('app-1', 't', f),
    variables: { appId: 'app-1' },
    fields: [
      'id',
      'kind',
      'label',
      'templateId',
      'validityDays',
      'issuers',
      'status',
      'activeLicenses',
    ],
  },
  {
    name: 'fetchAppArtifacts',
    field: 'appArtifacts',
    call: (f) => api.fetchAppArtifacts('app-1', 't', f),
    variables: { appId: 'app-1' },
    fields: ['kind', 'name', 'versions', 'channels'],
  },
  {
    name: 'fetchLicenses',
    field: 'licenses',
    call: (f) => api.fetchLicenses('app-1', null, 't', f),
    variables: { appId: 'app-1', status: null },
    fields: [
      'id',
      'user',
      'kind',
      'issuer',
      'status',
      'start',
      'end',
      'environmentId',
      'replacedBy',
    ],
  },
  {
    name: 'fetchEnvironments',
    field: 'environments',
    call: (f) => api.fetchEnvironments('app-1', 't', f),
    variables: { appId: 'app-1' },
    fields: [
      'environmentId',
      'user',
      'licenseId',
      'rootLicenseId',
      'label',
      'templateHash',
      'stoppedAt',
      'deleteAfter',
    ],
  },
  {
    name: 'fetchInviteCodes',
    field: 'inviteCodes',
    call: (f) => api.fetchInviteCodes('app-1', 't', f),
    variables: { appId: 'app-1' },
    fields: [
      'code',
      'kind',
      'label',
      'active',
      'expiresAt',
      'maxUses',
      'redemptions',
      'hasAnthropicKey',
      'createdAt',
    ],
  },
  {
    name: 'fetchAllowList',
    field: 'allowList',
    call: (f) => api.fetchAllowList('app-1', 't', f),
    variables: { appId: 'app-1' },
    fields: ['user', 'addedAt'],
  },
]

describe.each(READS)('$name', ({ field, call, variables, fields }) => {
  it('unwraps vetraPublisher.<field>, sends the variables, selects exactly the contract fields', async () => {
    const { calls, fetchImpl } = capture({ vetraPublisher: { [field]: [] } })
    await expect(call(fetchImpl)).resolves.toEqual([])
    expect(calls).toHaveLength(1)
    expect(calls[0].query).toMatch(/^query\b/)
    expect(calls[0].query).toMatch(/vetraPublisher\s*\{/)
    expect(calls[0].variables).toEqual(variables)
    expect(fieldsOf(calls[0].query, field)).toEqual(fields)
  })
})

describe('nested selections', () => {
  it('templates select every service and package field', async () => {
    const { calls, fetchImpl } = capture({ vetraPublisher: { templates: [] } })
    await api.fetchTemplates('app-1', 't', fetchImpl)
    expect(fieldsOf(calls[0].query, 'services')).toEqual([
      'id',
      'type',
      'prefix',
      'artifactName',
      'artifactChannel',
    ])
    expect(fieldsOf(calls[0].query, 'packages')).toEqual(['id', 'packageName', 'version'])
  })

  it('myApps takes no argument: ownership comes from the wallet', async () => {
    const { calls, fetchImpl } = capture({ vetraPublisher: { myApps: [] } })
    await api.fetchPublisherApps('t', fetchImpl)
    expect(calls[0].query).not.toContain('appId')
  })

  it('licences pass a status filter through untouched', async () => {
    const { calls, fetchImpl } = capture({ vetraPublisher: { licenses: [] } })
    await api.fetchLicenses('app-1', 'ACTIVE', 't', fetchImpl)
    expect(calls[0].variables).toEqual({ appId: 'app-1', status: 'ACTIVE' })
    expect(calls[0].query).toContain('licenses(appId: $appId, status: $status)')
  })
})
