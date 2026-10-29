import type {
  PublisherEnvironment,
  PublisherInviteCode,
  PublisherLicense,
  PublisherTerm,
} from '../types'

/** The publisher's at-a-glance numbers for one app. */
export type PublisherSummary = {
  /** People holding an active licence (one person with two licences counts once). */
  holders: number
  livePlans: number
  codesRedeemed: number
  /** Total uses the active codes allow; null when any active code is unlimited. */
  codesCapacity: number | null
  /** Environments provisioned for holders and not stopped. */
  runningEnvironments: number
}

export function publisherSummary({
  licenses,
  terms,
  inviteCodes,
  environments,
}: {
  licenses: readonly PublisherLicense[]
  terms: readonly PublisherTerm[]
  inviteCodes: readonly PublisherInviteCode[]
  environments: readonly PublisherEnvironment[]
}): PublisherSummary {
  const activeCodes = inviteCodes.filter((code) => code.active)
  return {
    holders: new Set(licenses.filter((l) => l.status === 'ACTIVE').map((l) => l.user)).size,
    livePlans: terms.filter((term) => term.status === 'ACTIVE').length,
    codesRedeemed: inviteCodes.reduce((sum, code) => sum + code.redemptions, 0),
    codesCapacity: activeCodes.some((code) => code.maxUses === null)
      ? null
      : activeCodes.reduce((sum, code) => sum + (code.maxUses ?? 0), 0),
    runningEnvironments: environments.filter((env) => !env.stoppedAt).length,
  }
}
