import { describe, expect, it } from 'vitest'
import { apexCandidateServices, apexServiceForCustomDomain } from '../lib/env-host'

const svc = (type: string, enabled = true) => ({ type, enabled }) as never

describe('apexCandidateServices', () => {
  it('offers enabled CONNECT, SWITCHBOARD and FUSION for the custom-domain apex', () => {
    expect(
      apexCandidateServices([
        svc('CONNECT'),
        svc('SWITCHBOARD'),
        svc('FUSION'),
        svc('CLINT'),
        svc('DOCLING'),
        svc('FUSION', false),
      ]),
    ).toEqual(['CONNECT', 'SWITCHBOARD', 'FUSION'])
  })
})

describe('apexServiceForCustomDomain', () => {
  it('keeps FUSION as a valid custom-domain apex', () => {
    expect(apexServiceForCustomDomain('FUSION')).toBe('FUSION')
    expect(apexServiceForCustomDomain('CLINT')).toBeNull()
    expect(apexServiceForCustomDomain(null)).toBeNull()
  })
})
