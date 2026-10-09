import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { buildSchema, parse, validate } from 'graphql'
import * as publisher from '../graphql'
import * as subscriptions from '@/modules/subscriptions/graphql'

/**
 * Every operation string the client builds must validate against the binding contract, so a
 * renamed field or argument fails here instead of on a deploy. The fixture is the contract's
 * vetraPublisher and vetraSubscriptions SDL.
 */
const schema = buildSchema(
  readFileSync(join(__dirname, 'fixtures', 'licensing-contract.graphql'), 'utf8'),
)

type Sent = { query: string; variables: Record<string, unknown> }

/** Runs one client call against a fake transport and returns what it would have sent. */
async function sent(call: (f: publisher.FetchLike) => Promise<unknown>): Promise<Sent> {
  let body: Sent | null = null
  const fake: publisher.FetchLike = (_url, init) => {
    body = JSON.parse(init.body as string) as Sent
    return Promise.resolve(new Response(JSON.stringify({ data: null }), { status: 200 }))
  }
  await call(fake).catch(() => undefined) // the empty answer is refused; only the request matters
  if (!body) throw new Error('nothing was sent')
  return body
}

const A = 'app-1'
const CALLS: Record<string, (f: publisher.FetchLike) => Promise<unknown>> = {
  fetchPublisherApps: (f) => publisher.fetchPublisherApps('t', f),
  fetchTemplates: (f) => publisher.fetchTemplates(A, 't', f),
  fetchTerms: (f) => publisher.fetchTerms(A, 't', f),
  fetchAppArtifacts: (f) => publisher.fetchAppArtifacts(A, 't', f),
  fetchLicenses: (f) => publisher.fetchLicenses(A, null, 't', f),
  fetchLicensesByStatus: (f) => publisher.fetchLicenses(A, 'ACTIVE', 't', f),
  fetchEnvironments: (f) => publisher.fetchEnvironments(A, 't', f),
  fetchInviteCodes: (f) => publisher.fetchInviteCodes(A, 't', f),
  fetchAllowList: (f) => publisher.fetchAllowList(A, 't', f),
  addTemplate: (f) => publisher.addTemplate({ appId: A, name: 'Pro', mode: 'DEDICATED' }, 't', f),
  setTemplateDetails: (f) =>
    publisher.setTemplateDetails(
      {
        appId: A,
        templateId: 'tpl',
        name: 'Pro',
        mode: 'SHARED',
        sharedEnvironment: null,
        size: null,
        baseDomain: null,
        packageRegistry: null,
      },
      't',
      f,
    ),
  addTemplateService: (f) =>
    publisher.addTemplateService(
      {
        appId: A,
        templateId: 'tpl',
        type: 'FUSION',
        prefix: null,
        artifactName: 'img',
        artifactChannel: 'LATEST',
      },
      't',
      f,
    ),
  removeTemplateService: (f) =>
    publisher.removeTemplateService({ appId: A, templateId: 'tpl', id: 's1' }, 't', f),
  addTemplatePackage: (f) =>
    publisher.addTemplatePackage(
      { appId: A, templateId: 'tpl', packageName: '@a/b', version: null },
      't',
      f,
    ),
  removeTemplatePackage: (f) =>
    publisher.removeTemplatePackage({ appId: A, templateId: 'tpl', id: 'p1' }, 't', f),
  deleteTemplate: (f) => publisher.deleteTemplate({ appId: A, templateId: 'tpl' }, 't', f),
  addTerm: (f) =>
    publisher.addTerm(
      {
        appId: A,
        kind: 'pro',
        label: 'Pro',
        templateId: 'tpl',
        validityDays: 30,
        issuers: ['INVITE_CODE'],
      },
      't',
      f,
    ),
  setTermDetails: (f) =>
    publisher.setTermDetails(
      {
        appId: A,
        termId: 'term',
        label: 'Pro',
        templateId: 'tpl',
        validityDays: null,
        issuers: [],
      },
      't',
      f,
    ),
  publishTerm: (f) => publisher.publishTerm({ appId: A, termId: 'term' }, 't', f),
  retireTerm: (f) => publisher.retireTerm({ appId: A, termId: 'term' }, 't', f),
  issueGrant: (f) =>
    publisher.issueGrant(
      { appId: A, kind: 'pro', user: '0x' + 'a'.repeat(40), label: null },
      't',
      f,
    ),
  replaceGrant: (f) => publisher.replaceGrant({ licenseId: 'l1', kind: 'pro' }, 't', f),
  revokeLicense: (f) => publisher.revokeLicense({ licenseId: 'l1', reason: null }, 't', f),
  createInviteCode: (f) =>
    publisher.createInviteCode(
      {
        appId: A,
        kind: 'pro',
        label: null,
        maxUses: 5,
        expiresAt: null,
        code: 'VIP-2026',
        anthropicKey: 'k',
      },
      't',
      f,
    ),
  setInviteCodeActive: (f) =>
    publisher.setInviteCodeActive({ appId: A, code: 'VIP-2026', active: false }, 't', f),
  addToAllowList: (f) =>
    publisher.addToAllowList({ appId: A, user: '0x' + 'a'.repeat(40) }, 't', f),
  removeFromAllowList: (f) =>
    publisher.removeFromAllowList({ appId: A, user: '0x' + 'a'.repeat(40) }, 't', f),
  updateAppProfile: (f) =>
    publisher.updateAppProfile(
      { appId: A, name: 'Vault', logoRef: '', links: [{ id: 'l1', label: 'Docs', url: 'https://docs.example' }] },
      't',
      f,
    ),
  fetchInviteCodeCheck: (f) => subscriptions.fetchInviteCodeCheck('VIP-2026', f),
  fetchMySubscriptions: (f) => subscriptions.fetchMySubscriptions('t', f),
  fetchStudioAccess: (f) => subscriptions.fetchStudioAccess('t', f),
  redeemNew: (f) => subscriptions.redeemInviteCode({ code: 'VIP-2026', label: 'Acme' }, 't', f),
  redeemUpgrade: (f) =>
    subscriptions.redeemInviteCode({ code: 'VIP-2026', upgrades: 'l1' }, 't', f),
  cancelSubscription: (f) => subscriptions.cancelSubscription('l1', 't', f),
  applyStudioKey: (f) => subscriptions.applyStudioKey('tenant', ['ANTHROPIC_API_KEY'], 't', f),
}

describe('client operations against the licensing contract', () => {
  it('covers every write the client exports', () => {
    const writes = Object.entries(publisher)
      .filter(([, v]) => typeof v === 'function')
      .map(([k]) => k)
      .filter((k) => !/^(fetch|is|to|describe|retry|reset|publisherGql|PublisherApiError)/.test(k))
    for (const w of writes) expect(CALLS, `missing a call for ${w}`).toHaveProperty(w)
  })

  it('would catch a field the contract does not have', () => {
    const bad = parse('query { vetraSubscriptions { studioAccess { allowed licenceId } } }')
    expect(validate(schema, bad)).not.toHaveLength(0)
  })

  for (const [name, call] of Object.entries(CALLS)) {
    it(`${name} is valid against the contract`, async () => {
      const { query } = await sent(call)
      expect(validate(schema, parse(query)).map((e) => e.message)).toEqual([])
    })
  }
})
