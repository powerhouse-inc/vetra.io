import { describe, it, expect } from 'vitest'
import * as api from '../graphql'
import type { FetchLike } from '../graphql'

const capture = (data: unknown) => {
  const calls: Array<{ query: string; variables: Record<string, unknown> }> = []
  const fetchImpl = (async (_url: string, init: RequestInit) => {
    calls.push(JSON.parse(init.body as string))
    return new Response(JSON.stringify({ data }), { status: 200 })
  }) as unknown as FetchLike
  return { calls, fetchImpl }
}

type Writer = (input: never, token: string | null, f?: FetchLike) => Promise<unknown>

const INPUT_WRITES: Array<[keyof typeof api, string, Record<string, unknown>, unknown]> = [
  ['addTemplate', 'AddTemplateInput', { appId: 'a', name: 'Free', mode: 'SHARED' }, 'tpl-1'],
  ['setTemplateDetails', 'SetTemplateDetailsInput', { appId: 'a', templateId: 't', size: null }, true],
  ['addTemplateService', 'AddTemplateServiceInput', { appId: 'a', templateId: 't', type: 'FUSION', artifactName: 'kv', artifactChannel: 'LATEST' }, true],
  ['removeTemplateService', 'RemoveTemplateEntryInput', { appId: 'a', templateId: 't', id: 's1' }, true],
  ['addTemplatePackage', 'AddTemplatePackageInput', { appId: 'a', templateId: 't', packageName: '@acme/kv' }, true],
  ['removeTemplatePackage', 'RemoveTemplateEntryInput', { appId: 'a', templateId: 't', id: 'p1' }, true],
  ['addTerm', 'AddTermInput', { appId: 'a', kind: '2026-free', issuers: ['INVITE_CODE'] }, 'term-1'],
  ['setTermDetails', 'SetTermDetailsInput', { appId: 'a', termId: 'term-1', validityDays: null }, true],
  ['issueGrant', 'IssueGrantInput', { appId: 'a', kind: '2026-free', user: '0xabc', label: null }, 'lic-1'],
  ['replaceGrant', 'ReplaceGrantInput', { licenseId: 'lic-1', kind: '2026-pro' }, 'lic-2'],
  ['revokeLicense', 'RevokeLicenseInput', { licenseId: 'lic-1', reason: null }, true],
]

describe.each(INPUT_WRITES)('%s', (field, inputType, input, result) => {
  it(`sends $input typed ${inputType}! and returns the field value`, async () => {
    const { calls, fetchImpl } = capture({ vetraPublisher: { [field]: result } })
    const fn = api[field] as unknown as Writer
    await expect(fn(input as never, 't', fetchImpl)).resolves.toEqual(result)
    expect(calls[0].query).toMatch(/^mutation\b/)
    expect(calls[0].query).toContain(`($input: ${inputType}!)`)
    expect(calls[0].query).toMatch(new RegExp(`vetraPublisher\\s*\\{\\s*${field}\\(input: \\$input\\)`))
    // Passed through untouched: null stays null, absent stays absent.
    expect(calls[0].variables).toEqual({ input })
  })
})

describe('createInviteCode', () => {
  it('selects the created code back, never the key', async () => {
    const code = {
      code: 'LFC-2026', kind: 'conf', label: null, active: true, expiresAt: null, maxUses: 50,
      redemptions: 0, hasAnthropicKey: true, createdAt: '2026-10-08T00:00:00Z',
    }
    const { calls, fetchImpl } = capture({ vetraPublisher: { createInviteCode: code } })
    const input = { appId: 'a', kind: 'conf', anthropicKey: 'sk-secret', maxUses: 50 }
    await expect(api.createInviteCode(input, 't', fetchImpl)).resolves.toEqual(code)
    expect(calls[0].query).toContain('($input: CreateInviteCodeInput!)')
    expect(calls[0].query).toContain('createInviteCode(input: $input) {')
    expect(calls[0].query).not.toContain('anthropicKey')
    expect(calls[0].variables).toEqual({ input })
  })
})

const ARG_WRITES: Array<[keyof typeof api, Record<string, unknown>, string, string]> = [
  ['deleteTemplate', { appId: 'a', templateId: 't' }, '($appId: String!, $templateId: String!)', 'deleteTemplate(appId: $appId, templateId: $templateId)'],
  ['publishTerm', { appId: 'a', termId: 'x' }, '($appId: String!, $termId: String!)', 'publishTerm(appId: $appId, termId: $termId)'],
  ['retireTerm', { appId: 'a', termId: 'x' }, '($appId: String!, $termId: String!)', 'retireTerm(appId: $appId, termId: $termId)'],
  ['setInviteCodeActive', { appId: 'a', code: 'C', active: false }, '($appId: String!, $code: String!, $active: Boolean!)', 'setInviteCodeActive(appId: $appId, code: $code, active: $active)'],
  ['addToAllowList', { appId: 'a', user: '0xabc' }, '($appId: String!, $user: String!)', 'addToAllowList(appId: $appId, user: $user)'],
  ['removeFromAllowList', { appId: 'a', user: '0xabc' }, '($appId: String!, $user: String!)', 'removeFromAllowList(appId: $appId, user: $user)'],
]

describe.each(ARG_WRITES)('%s', (field, args, decl, call) => {
  it('passes bare arguments, not an input object', async () => {
    const { calls, fetchImpl } = capture({ vetraPublisher: { [field]: true } })
    const fn = api[field] as unknown as Writer
    await expect(fn(args as never, 't', fetchImpl)).resolves.toBe(true)
    expect(calls[0].query).toContain(`mutation ${decl}`)
    expect(calls[0].query).toContain(call)
    expect(calls[0].variables).toEqual(args)
  })
})
