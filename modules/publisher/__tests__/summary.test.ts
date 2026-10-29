import { describe, expect, it } from 'vitest'
import { publisherSummary } from '../lib/summary'
import type {
  PublisherEnvironment,
  PublisherInviteCode,
  PublisherLicense,
  PublisherTerm,
} from '../types'

const license = (user: string, status: PublisherLicense['status']) =>
  ({ id: `${user}-${status}`, user, status }) as PublisherLicense
const term = (status: PublisherTerm['status']) => ({ id: status, status }) as PublisherTerm
const code = (active: boolean, maxUses: number | null, redemptions: number) =>
  ({ code: `${active}-${maxUses}`, active, maxUses, redemptions }) as PublisherInviteCode
const env = (stoppedAt: string | null) =>
  ({ environmentId: String(stoppedAt), stoppedAt }) as PublisherEnvironment

describe('publisherSummary', () => {
  it('counts each active holder once, and only live plans', () => {
    const s = publisherSummary({
      licenses: [
        license('did:a', 'ACTIVE'),
        license('did:a', 'ACTIVE'),
        license('did:b', 'ACTIVE'),
        license('did:c', 'REVOKED'),
      ],
      terms: [term('ACTIVE'), term('DRAFT'), term('RETIRED')],
      inviteCodes: [],
      environments: [env(null), env('2026-10-01')],
    })
    expect(s).toMatchObject({ holders: 2, livePlans: 1, runningEnvironments: 1 })
  })

  it('totals redemptions against the active codes’ limits', () => {
    const s = publisherSummary({
      licenses: [],
      terms: [],
      inviteCodes: [code(true, 50, 18), code(true, 10, 4), code(false, 100, 30)],
      environments: [],
    })
    expect(s).toMatchObject({ codesRedeemed: 52, codesCapacity: 60 })
  })

  it('has no capacity when an active code is unlimited', () => {
    const s = publisherSummary({
      licenses: [],
      terms: [],
      inviteCodes: [code(true, null, 3), code(true, 10, 1)],
      environments: [],
    })
    expect(s.codesCapacity).toBeNull()
  })
})
