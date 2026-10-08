import { describe, it, expect } from 'vitest'
import {
  environmentHref,
  groupByApp,
  subscriptionName,
  subscriptionStatusMeta,
  upgradeCandidates,
  validityLine,
  warningTone,
} from '../lib/subscriptions'
import type { Subscription } from '../types'

const sub = (over: Partial<Subscription>): Subscription => ({
  licenseId: 'l1',
  appId: 'kv',
  appName: 'Knowledge Vault',
  kind: 'kv-pro',
  termLabel: 'Pro',
  issuer: 'INVITE_CODE',
  status: 'ACTIVE',
  start: '2026-10-01T00:00:00Z',
  end: null,
  mode: 'DEDICATED',
  environmentId: 'env-1',
  environmentLabel: 'Acme',
  openUrl: 'https://acme.kv',
  stoppedAt: null,
  deleteAfter: null,
  warnings: [],
  ...over,
})

describe('subscriptions lib', () => {
  it('groups by app, apps with something live first, then by name', () => {
    const groups = groupByApp([
      sub({ licenseId: 'a', appId: 'z', appName: 'Zeta', status: 'EXPIRED' }),
      sub({ licenseId: 'b', appId: 'kv' }),
      sub({ licenseId: 'c', appId: 'kv', status: 'REPLACED' }),
      sub({ licenseId: 'd', appId: 'al', appName: 'Alpha' }),
    ])
    expect(groups.map((g) => g.appName)).toEqual(['Alpha', 'Knowledge Vault', 'Zeta'])
    const kv = groups[1]
    expect(kv.live.map((s) => s.licenseId)).toEqual(['b'])
    expect(kv.past.map((s) => s.licenseId)).toEqual(['c'])
  })

  it('offers only live licences of the same app as upgrade targets', () => {
    const subs = [
      sub({ licenseId: 'live' }),
      sub({ licenseId: 'issued', status: 'ISSUED' }),
      sub({ licenseId: 'ended', status: 'EXPIRED' }),
      sub({ licenseId: 'revoked', status: 'REVOKED' }),
      sub({ licenseId: 'replaced', status: 'REPLACED' }),
      sub({ licenseId: 'other', appId: 'other' }),
    ]
    expect(upgradeCandidates(subs, 'kv').map((s) => s.licenseId)).toEqual(['live', 'issued'])
  })

  it('reads validity in plain words', () => {
    const now = new Date('2026-10-08T00:00:00Z')
    expect(validityLine(sub({ end: null }), now)).toMatch(/^Since .* · no end date$/)
    expect(validityLine(sub({ end: '2026-11-01T00:00:00Z' }), now)).toMatch(/· until /)
    expect(validityLine(sub({ status: 'EXPIRED', end: '2026-10-02T00:00:00Z' }), now)).toMatch(
      /^Ended /,
    )
    expect(validityLine(sub({ status: 'ISSUED', start: null }), now)).toBe('Starting now')
  })

  it('names, statuses, tones and links', () => {
    expect(subscriptionName(sub({ termLabel: null }))).toBe('kv-pro')
    expect(subscriptionStatusMeta('REVOKED').label).toBe('Ended')
    expect(subscriptionStatusMeta('ISSUED').label).toBe('Setting up')
    expect(warningTone('EXPIRING')).toBe('warning')
    expect(warningTone('DELETE_IMMINENT')).toBe('danger')
    expect(environmentHref(sub({}))).toBe('/user/environments/env-1')
    expect(environmentHref(sub({ environmentId: null }))).toBeNull()
  })
})
