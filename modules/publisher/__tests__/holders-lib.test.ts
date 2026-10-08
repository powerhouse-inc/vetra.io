import { describe, it, expect } from 'vitest'
import {
  addressOf,
  filterHolders,
  grantablePlans,
  isOnAllowList,
  joinHolders,
  liveLicenseOf,
  modeOfKind,
  sameUser,
  USER_PATTERN,
} from '../lib/holders'
import type { PublisherEnvironment, PublisherLicense, PublisherTemplate, PublisherTerm } from '../types'

const A = '0xAbCdEf0123456789aBcDeF0123456789AbCdEf01'
const lic = (over: Partial<PublisherLicense>): PublisherLicense => ({
  id: 'l1', user: `did:pkh:eip155:1:${A.toLowerCase()}`, kind: 'pro', issuer: 'PUBLISHER_GRANT',
  status: 'ACTIVE', start: '2026-10-01T00:00:00Z', end: null, environmentId: 'env-1', replacedBy: null, ...over,
})
const env = (over: Partial<PublisherEnvironment>): PublisherEnvironment => ({
  environmentId: 'env-1', user: 'u', licenseId: 'l1', rootLicenseId: 'l1', label: 'Acme', templateHash: 'h',
  stoppedAt: null, deleteAfter: null, ...over,
})

describe('users', () => {
  it('accepts exactly a 0x address or a did:pkh on eip155', () => {
    expect(USER_PATTERN.test(A)).toBe(true)
    expect(USER_PATTERN.test(`did:pkh:eip155:137:${A}`)).toBe(true)
    expect(USER_PATTERN.test('did:key:z6Mk')).toBe(false)
    expect(USER_PATTERN.test(`${A} `)).toBe(false)
  })

  it('compares a bare address with a did:pkh case-insensitively', () => {
    expect(addressOf(A)).toBe(A.toLowerCase())
    expect(sameUser(A, `did:pkh:eip155:1:${A.toLowerCase()}`)).toBe(true)
    expect(sameUser('did:key:z1', 'did:key:z1')).toBe(true)
    expect(sameUser('did:key:z1', A)).toBe(false)
  })
})

describe('joinHolders', () => {
  it('attaches the environment by licence id, else by environment id', () => {
    const rows = joinHolders(
      [lic({ id: 'l1' }), lic({ id: 'l2', environmentId: 'env-2' }), lic({ id: 'l3', environmentId: null })],
      [env({ licenseId: 'l1' }), env({ environmentId: 'env-2', licenseId: 'old' })],
    )
    expect(rows.find((r) => r.id === 'l1')?.environment?.environmentId).toBe('env-1')
    expect(rows.find((r) => r.id === 'l2')?.environment?.environmentId).toBe('env-2')
    expect(rows.find((r) => r.id === 'l3')?.environment).toBeNull()
  })

  it('puts live licences first, newest first', () => {
    const rows = joinHolders(
      [
        lic({ id: 'old', status: 'EXPIRED', start: '2026-01-01T00:00:00Z' }),
        lic({ id: 'a', start: '2026-09-01T00:00:00Z' }),
        lic({ id: 'b', status: 'ISSUED', start: null }),
      ],
      [],
    )
    expect(rows.map((r) => r.id)).toEqual(['b', 'a', 'old'])
  })
})

describe('filters and checks', () => {
  const rows = joinHolders([lic({ id: 'l1' }), lic({ id: 'l2', status: 'REVOKED', kind: 'free', user: 'did:pkh:eip155:1:0x1111111111111111111111111111111111111111' })], [])

  it('filters by status, plan and a search over the DID', () => {
    expect(filterHolders(rows, { status: 'REVOKED', kind: 'ALL', query: '' }).map((r) => r.id)).toEqual(['l2'])
    expect(filterHolders(rows, { status: 'ALL', kind: 'pro', query: '' }).map((r) => r.id)).toEqual(['l1'])
    expect(filterHolders(rows, { status: 'ALL', kind: 'ALL', query: '0x1111' }).map((r) => r.id)).toEqual(['l2'])
    expect(filterHolders(rows, { status: 'ALL', kind: 'ALL', query: 'ABCDEF' }).map((r) => r.id)).toEqual(['l1'])
  })

  it('finds a live licence and allow-list membership whatever the address form', () => {
    expect(liveLicenseOf([lic({})], A)?.id).toBe('l1')
    expect(liveLicenseOf([lic({ status: 'EXPIRED' })], A)).toBeUndefined()
    expect(isOnAllowList([{ user: A.toLowerCase(), addedAt: 'x' }], `did:pkh:eip155:1:${A}`)).toBe(true)
  })

  it('offers only published plans a publisher may grant', () => {
    const t = (over: Partial<PublisherTerm>): PublisherTerm => ({
      id: 'x', kind: 'k', label: null, templateId: 't', validityDays: null, issuers: ['PUBLISHER_GRANT'],
      status: 'ACTIVE', activeLicenses: 0, ...over,
    })
    const plans = [t({ id: 'a' }), t({ id: 'b', status: 'DRAFT' }), t({ id: 'c', issuers: ['INVITE_CODE'] })]
    expect(grantablePlans(plans).map((p) => p.id)).toEqual(['a'])
  })

  it('knows whether a kind provisions its own environment', () => {
    const terms = [{ kind: 'pro', templateId: 'tpl-1' } as PublisherTerm]
    const templates = [{ id: 'tpl-1', mode: 'DEDICATED' } as PublisherTemplate]
    expect(modeOfKind('pro', terms, templates)).toBe('DEDICATED')
    expect(modeOfKind('gone', terms, templates)).toBeNull()
  })
})
