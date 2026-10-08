import { describe, it, expect } from 'vitest'
import { defaultRedeemChoice, NEW_CHOICE, offersNew, redeemOptions } from '../lib/redeem-options'
import type { Subscription } from '../types'

const sub = (over: Partial<Subscription>): Subscription => ({
  licenseId: 'l1',
  appId: 'kv',
  appName: 'Knowledge Vault',
  kind: 'kv-free',
  termLabel: 'Free',
  issuer: 'INVITE_CODE',
  status: 'ACTIVE',
  start: '2026-10-01T00:00:00Z',
  end: null,
  mode: 'DEDICATED',
  environmentId: 'env-1',
  environmentLabel: 'Acme',
  openUrl: null,
  stoppedAt: null,
  deleteAfter: null,
  warnings: [],
  ...over,
})
const code = { appId: 'kv', kind: 'kv-pro', termLabel: 'Pro' }
const kinds = (subs: Subscription[]) => redeemOptions(subs, code).map((o) => [o.kind, o.licenseId])

describe('redeem options', () => {
  it('offers nothing to build on without licences of this app', () => {
    const options = redeemOptions([sub({ appId: 'other' })], code)
    expect(options).toEqual([])
    expect(defaultRedeemChoice(options, 'DEDICATED')).toBe(NEW_CHOICE)
    expect(defaultRedeemChoice(options, 'SHARED')).toBe(NEW_CHOICE)
    expect(redeemOptions([sub({})], { ...code, appId: null })).toEqual([])
  })

  it('never offers an ISSUED or REPLACED licence', () => {
    expect(
      kinds([
        sub({ licenseId: 'i', status: 'ISSUED' }),
        sub({ licenseId: 'r', status: 'REPLACED' }),
      ]),
    ).toEqual([])
  })

  it('renews the same plan and preselects that', () => {
    const options = redeemOptions([sub({ licenseId: 'same', kind: 'kv-pro' })], code)
    expect(options).toMatchObject([
      {
        kind: 'renew',
        licenseId: 'same',
        title: 'Renew Pro',
        detail: 'Acme keeps running with its data.',
      },
    ])
    expect(defaultRedeemChoice(options, 'DEDICATED')).toBe('same')
    expect(offersNew(options, 'DEDICATED')).toBe(true)
    expect(offersNew(options, 'SHARED')).toBe(false)
  })

  it('switches another live plan, but never by default', () => {
    const options = redeemOptions([sub({ licenseId: 'free' })], code)
    expect(options).toMatchObject([
      { kind: 'switch', licenseId: 'free', title: 'Switch Free to Pro' },
    ])
    expect(defaultRedeemChoice(options, 'DEDICATED')).toBeNull()
    expect(defaultRedeemChoice(options, 'SHARED')).toBeNull()
    expect(offersNew(options, 'SHARED')).toBe(false)
  })

  it('brings back an EXPIRED or REVOKED licence, by default only when nothing is live', () => {
    const ended = [
      sub({ licenseId: 'exp', status: 'EXPIRED', start: '2026-09-01T00:00:00Z' }),
      sub({ licenseId: 'rev', status: 'REVOKED', environmentLabel: null, termLabel: 'Trial' }),
    ]
    const options = redeemOptions(ended, code)
    expect(options.map((o) => [o.kind, o.licenseId, o.title])).toEqual([
      ['restore', 'rev', 'Bring back Trial'],
      ['restore', 'exp', 'Bring back Acme'],
    ])
    expect(defaultRedeemChoice(options, 'DEDICATED')).toBe('rev')
    expect(offersNew(options, 'SHARED')).toBe(true)

    const withLive = redeemOptions([...ended, sub({ licenseId: 'free' })], code)
    expect(defaultRedeemChoice(withLive, 'DEDICATED')).toBeNull()
  })

  it('orders renewals, then switches, then restores, and prefers a renewal', () => {
    const options = redeemOptions(
      [
        sub({ licenseId: 'rev', status: 'REVOKED' }),
        sub({ licenseId: 'free' }),
        sub({ licenseId: 'same', kind: 'kv-pro' }),
      ],
      code,
    )
    expect(options.map((o) => o.kind)).toEqual(['renew', 'switch', 'restore'])
    expect(defaultRedeemChoice(options, 'SHARED')).toBe('same')
  })

  it('falls back to the plan id when the code has no label', () => {
    const [o] = redeemOptions([sub({ kind: 'kv-pro' })], { ...code, termLabel: null })
    expect(o.title).toBe('Renew kv-pro')
  })
})
