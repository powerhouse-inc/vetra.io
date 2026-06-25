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
})
