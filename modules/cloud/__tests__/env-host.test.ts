import { describe, it, expect } from 'vitest'
import {
  resolveGenericHost,
  effectiveApexType,
  isTypeAtApex,
  customDomainServiceHost,
  isPinnedToCustomApex,
  envHeaderHost,
  customDomainDnsRecords,
  INGRESS_IP,
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

// ---------------------------------------------------------------------------
// Parity with the gitops processor (vetra-cloud-package gitops.ts):
// only routable types (CONNECT/SWITCHBOARD/FUSION/CLINT) take part in the
// lone-service apex claim, and custom domains follow their own rule.
// ---------------------------------------------------------------------------

describe('effectiveApexType — non-routable add-ons', () => {
  it('a DOCLING/PAPERLESS add-on does not take the apex away from a lone CONNECT', () => {
    expect(effectiveApexType([svc('CONNECT'), svc('DOCLING'), svc('PAPERLESS')], null)).toBe(
      'CONNECT',
    )
  })
  it('an add-on alone never claims the apex', () => {
    expect(effectiveApexType([svc('DOCLING')], null)).toBeNull()
  })
})

describe('customDomainServiceHost', () => {
  const two = [svc('CONNECT', true, 'app'), svc('SWITCHBOARD', true, 'api')]

  it('non-apex: fixed connect./switchboard. prefixes, not the service prefix', () => {
    expect(customDomainServiceHost(two, null, 'kv.example', 'CONNECT')).toBe('connect.kv.example')
    expect(customDomainServiceHost(two, null, 'kv.example', 'SWITCHBOARD')).toBe(
      'switchboard.kv.example',
    )
  })
  it('the bare domain only for an explicitly pinned service', () => {
    expect(customDomainServiceHost(two, 'CONNECT', 'kv.example', 'CONNECT')).toBe('kv.example')
    expect(customDomainServiceHost(two, 'CONNECT', 'kv.example', 'SWITCHBOARD')).toBe(
      'switchboard.kv.example',
    )
  })
  it('no lone-service auto-claim for custom domains', () => {
    expect(customDomainServiceHost([svc('CONNECT')], null, 'kv.example', 'CONNECT')).toBe(
      'connect.kv.example',
    )
  })
  it('null for types the chart renders no custom ingress for, or disabled/absent services', () => {
    expect(customDomainServiceHost([svc('FUSION')], null, 'kv.example', 'FUSION')).toBeNull()
    expect(
      customDomainServiceHost([svc('CONNECT', false)], null, 'kv.example', 'CONNECT'),
    ).toBeNull()
    expect(customDomainServiceHost(two, null, null, 'CONNECT')).toBeNull()
  })
})

describe('isPinnedToCustomApex', () => {
  it('true only for the enabled service pinned at the custom domain', () => {
    const s = [svc('CONNECT'), svc('SWITCHBOARD')]
    expect(isPinnedToCustomApex(s, 'CONNECT', 'kv.example', 'CONNECT')).toBe(true)
    expect(isPinnedToCustomApex(s, 'CONNECT', 'kv.example', 'SWITCHBOARD')).toBe(false)
    expect(isPinnedToCustomApex(s, 'CONNECT', null, 'CONNECT')).toBe(false)
  })
})

describe('envHeaderHost', () => {
  const base = { subdomain: 'light-colt-c497cfbd', baseDomain: 'vetra.io' }
  it('shows nothing when no service owns an apex (two services, no pin)', () => {
    expect(
      envHeaderHost({ ...base, services: [svc('CONNECT'), svc('SWITCHBOARD')], apexService: null }),
    ).toBeNull()
  })
  it('shows the generic apex when one service owns it', () => {
    expect(envHeaderHost({ ...base, services: [svc('CONNECT')], apexService: null })).toBe(
      'light-colt-c497cfbd.vetra.io',
    )
  })
  it('prefers the custom domain when a service is pinned there', () => {
    expect(
      envHeaderHost({
        ...base,
        services: [svc('CONNECT'), svc('SWITCHBOARD')],
        apexService: 'CONNECT',
        customDomain: 'kv.example',
      }),
    ).toBe('kv.example')
  })
})

describe('customDomainDnsRecords', () => {
  it('one A record per served host — fixed prefixes, no add-ons, no FUSION', () => {
    const s = [
      svc('CONNECT', true, 'app'),
      svc('SWITCHBOARD', true, 'api'),
      svc('FUSION'),
      svc('DOCLING'),
      svc('PAPERLESS'),
      svc('CLINT', true, 'vetra-agent'),
    ]
    expect(customDomainDnsRecords(s, null, 'kv.example')).toEqual([
      { type: 'A', host: 'connect.kv.example', value: INGRESS_IP },
      { type: 'A', host: 'switchboard.kv.example', value: INGRESS_IP },
    ])
  })
  it('the bare domain for a pinned service', () => {
    const s = [svc('CONNECT'), svc('SWITCHBOARD')]
    expect(customDomainDnsRecords(s, 'CONNECT', 'kv.example').map((r) => r.host)).toEqual([
      'kv.example',
      'switchboard.kv.example',
    ])
  })
  it('nothing without a domain or without routable services', () => {
    expect(customDomainDnsRecords([svc('CONNECT')], null, null)).toEqual([])
    expect(customDomainDnsRecords([svc('DOCLING')], null, 'kv.example')).toEqual([])
  })
})
