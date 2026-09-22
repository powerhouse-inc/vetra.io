import { describe, it, expect } from 'vitest'
import {
  resolveGenericHost,
  effectiveApexType,
  isTypeAtApex,
  type ServiceLike,
} from '@/modules/cloud/lib/env-host'

const svc = (type: string, enabled = true, prefix?: string): ServiceLike => ({
  type,
  enabled,
  prefix: prefix ?? type.toLowerCase(),
})

describe('resolveGenericHost', () => {
  it('apex → bare subdomain', () => {
    expect(resolveGenericHost('tall-duck-ab12', 'vetra-agent', true, 'vetra.io')).toBe(
      'tall-duck-ab12.vetra.io',
    )
  })
  it('non-apex → subdomain-prefix flattened (single label)', () => {
    const h = resolveGenericHost('tall-duck-ab12', 'connect', false, 'vetra.io')
    expect(h).toBe('tall-duck-ab12-connect.vetra.io')
    expect(h.split('.')[0]).toBe('tall-duck-ab12-connect')
  })
})

describe('effectiveApexType', () => {
  it('sole enabled service is apex by default', () => {
    expect(effectiveApexType([svc('CLINT')], null)).toBe('CLINT')
  })
  it('multi-service, none pinned → null', () => {
    expect(effectiveApexType([svc('CONNECT'), svc('SWITCHBOARD')], null)).toBeNull()
  })
  it('explicit apexService wins', () => {
    expect(effectiveApexType([svc('CONNECT'), svc('SWITCHBOARD')], 'CONNECT')).toBe('CONNECT')
  })
  it('ignores disabled services when counting', () => {
    expect(effectiveApexType([svc('CLINT'), svc('CONNECT', false)], null)).toBe('CLINT')
  })
})

describe('isTypeAtApex', () => {
  it('sole CLINT studio → CLINT at apex', () => {
    expect(isTypeAtApex([svc('CLINT')], null, 'CLINT')).toBe(true)
  })
  it('explicit apex type matches', () => {
    const s = [svc('CONNECT'), svc('SWITCHBOARD')]
    expect(isTypeAtApex(s, 'CONNECT', 'CONNECT')).toBe(true)
    expect(isTypeAtApex(s, 'CONNECT', 'SWITCHBOARD')).toBe(false)
  })
  it('false when the type has multiple enabled instances', () => {
    const s = [svc('CLINT', true, 'a'), svc('CLINT', true, 'b')]
    expect(isTypeAtApex(s, 'CLINT', 'CLINT')).toBe(false)
  })
  it('sole CONNECT product env with apexService unset → CONNECT at apex', () => {
    // A CONNECT-only "product" environment leaves apexService null and relies
    // on the lone-service auto-claim.
    expect(isTypeAtApex([svc('CONNECT')], null, 'CONNECT')).toBe(true)
    expect(isTypeAtApex([svc('CONNECT')], undefined, 'CONNECT')).toBe(true)
  })
})

// Regression (coral-quail-16b2d931, 2026-08-14): a CONNECT-only env leaves
// apexService unset; CONNECT auto-claims the apex, so its URL MUST be the bare
// subdomain, not `<sub>-connect`. The bug was a caller computing apex as
// `apexService === type` (misses the auto-claim) instead of using isTypeAtApex.
// This locks the full data flow the UI uses: isTypeAtApex → resolveGenericHost.
describe('CONNECT-only env host resolution (regression)', () => {
  const connectOnly: ServiceLike[] = [svc('CONNECT')]
  it('resolves to the bare subdomain, never <sub>-connect', () => {
    const host = resolveGenericHost(
      'coral-quail-16b2d931',
      'connect',
      isTypeAtApex(connectOnly, null, 'CONNECT'),
      'vetra.io',
    )
    expect(host).toBe('coral-quail-16b2d931.vetra.io')
    expect(host).not.toContain('-connect')
  })
  it('the buggy `apexService === type` check would have regressed this', () => {
    // Documents WHY the manual check is wrong: null === "CONNECT" is false,
    // which would have produced the -connect host.
    const apexService: string | null = null
    expect(apexService === 'CONNECT').toBe(false) // the old, wrong signal
    expect(isTypeAtApex(connectOnly, apexService, 'CONNECT')).toBe(true) // the correct one
  })
})
