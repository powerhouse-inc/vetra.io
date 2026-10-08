import type { InviteCodeCheck, Subscription } from '../types'
import { subscriptionName, upgradeCandidates } from './subscriptions'

/**
 * What redeeming a code can do with a licence the person already holds for the code's app:
 * - `renew`: an ACTIVE licence of the code's own plan. The server renews it (time-limited plans
 *   get their time back); nothing else changes. The only safe default.
 * - `switch`: an ACTIVE licence of another plan moves to the code's plan. It can be a downgrade
 *   of a running environment, so it is never chosen for them.
 * - `restore`: an EXPIRED or REVOKED licence comes back on the code's plan, and so does its
 *   stopped environment.
 */
export type RedeemOptionKind = 'renew' | 'switch' | 'restore'

export type RedeemOption = {
  kind: RedeemOptionKind
  licenseId: string
  title: string
  detail: string
}

export const NEW_CHOICE = 'new'

const RANK: Record<RedeemOptionKind, number> = { renew: 0, switch: 1, restore: 2 }

const startMs = (s: Subscription) => (s.start ? new Date(s.start).getTime() : 0)

function option(s: Subscription, code: Pick<InviteCodeCheck, 'kind' | 'termLabel'>): RedeemOption {
  const plan = code.termLabel?.trim() || code.kind || 'the new plan'
  const env = s.environmentLabel
  if (s.status === 'ACTIVE' && s.kind === code.kind) {
    return {
      kind: 'renew',
      licenseId: s.licenseId,
      title: `Renew ${plan}`,
      detail: env ? `${env} keeps running with its data.` : 'Your access carries on.',
    }
  }
  if (s.status === 'ACTIVE') {
    return {
      kind: 'switch',
      licenseId: s.licenseId,
      title: `Switch ${subscriptionName(s)} to ${plan}`,
      detail: env
        ? `${env} keeps its data and moves to the new plan.`
        : 'Your access moves to the new plan.',
    }
  }
  return {
    kind: 'restore',
    licenseId: s.licenseId,
    title: `Bring back ${env || subscriptionName(s)}`,
    detail: env
      ? `${env} starts again with its data, on the new plan.`
      : 'Your access comes back, on the new plan.',
  }
}

/** The choices for one code, renewals first, then switches, then restores; newest first. */
export function redeemOptions(
  subs: Subscription[],
  code: Pick<InviteCodeCheck, 'appId' | 'kind' | 'termLabel'>,
): RedeemOption[] {
  if (!code.appId) return []
  return upgradeCandidates(subs, code.appId)
    .sort((a, b) => startMs(b) - startMs(a))
    .map((s) => option(s, code))
    .sort((a, b) => RANK[a.kind] - RANK[b.kind])
}

/**
 * Whether "start something new" is on offer. Always for a DEDICATED plan (a second environment
 * for another project). For SHARED, a second account next to a live one adds nothing, so only when
 * no licence is ACTIVE.
 */
export function offersNew(options: RedeemOption[], mode: string | null): boolean {
  if (mode === 'DEDICATED') return true
  return !options.some((o) => o.kind === 'renew' || o.kind === 'switch')
}

/**
 * The preselected choice, or null when they must pick. A renewal is safe; switching a live
 * licence never is; bringing one back is the likely wish when nothing is live.
 */
export function defaultRedeemChoice(options: RedeemOption[], mode: string | null): string | null {
  const renew = options.find((o) => o.kind === 'renew')
  if (renew) return renew.licenseId
  if (options.some((o) => o.kind === 'switch')) return null
  const restore = options.find((o) => o.kind === 'restore')
  if (restore) return restore.licenseId
  return offersNew(options, mode) ? NEW_CHOICE : null
}
