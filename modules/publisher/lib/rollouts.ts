import type { AppRollout } from '../types'

export type RolloutProgress = { total: number; updated: number; pending: number; failed: number }

const PENDING = new Set(['PENDING', 'APPLYING'])
// REVERTED and RESTORED rolled the environment back: the update did not land, and it paused the rollout.
const FAILED = new Set(['FAILED', 'REVERTED', 'RESTORED'])

/** Environments of a rollout per outcome. SUPERSEDED updates belong to a newer rollout and do not count. */
export function rolloutProgress(counts: AppRollout['counts']): RolloutProgress {
  const p: RolloutProgress = { total: 0, updated: 0, pending: 0, failed: 0 }
  for (const { status, count } of counts) {
    if (status === 'SUCCEEDED') p.updated += count
    else if (PENDING.has(status)) p.pending += count
    else if (FAILED.has(status)) p.failed += count
    else continue
    p.total += count
  }
  return p
}

const PREVIOUS_SHOWN = 5

/** The newest ACTIVE or PAUSED rollout, and the last few others, newest first. */
export function splitRollouts(rollouts: AppRollout[]): {
  current: AppRollout | null
  previous: AppRollout[]
} {
  const sorted = [...rollouts].sort((a, b) => b.promotedAt.localeCompare(a.promotedAt))
  const current = sorted.find((r) => r.status === 'ACTIVE' || r.status === 'PAUSED') ?? null
  return {
    current,
    previous: sorted.filter((r) => r !== current).slice(0, PREVIOUS_SHOWN),
  }
}
