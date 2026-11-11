import { describe, it, expect } from 'vitest'
import { rolloutProgress, splitRollouts } from '../lib/rollouts'
import type { AppRollout } from '../types'

const rollout = (over: Partial<AppRollout>): AppRollout => ({
  id: 'r1',
  artifactName: 'vault',
  version: 'sha-1',
  status: 'ACTIVE',
  applyAfter: '2026-11-12T00:00:00Z',
  promotedBy: 'did:pkh:eip155:1:0xabc',
  promotedAt: '2026-11-11T00:00:00Z',
  pausedAt: null,
  pausedReason: null,
  counts: [],
  ...over,
})

describe('rolloutProgress', () => {
  it('counts succeeded as updated, pending and applying as pending, every rollback as failed', () => {
    expect(
      rolloutProgress([
        { status: 'SUCCEEDED', count: 3 },
        { status: 'PENDING', count: 7 },
        { status: 'APPLYING', count: 1 },
        { status: 'FAILED', count: 1 },
        { status: 'REVERTED', count: 1 },
        { status: 'RESTORED', count: 1 },
        { status: 'SUPERSEDED', count: 4 },
      ]),
    ).toEqual({ total: 14, updated: 3, pending: 8, failed: 3 })
  })

  it('is all zeros without counts', () => {
    expect(rolloutProgress([])).toEqual({ total: 0, updated: 0, pending: 0, failed: 0 })
  })
})

describe('splitRollouts', () => {
  it('takes the newest ACTIVE or PAUSED rollout as current and up to 5 others, newest first', () => {
    const list = [
      rollout({ id: 'old', status: 'COMPLETE', promotedAt: '2026-11-01T00:00:00Z' }),
      rollout({ id: 'paused', status: 'PAUSED', promotedAt: '2026-11-10T00:00:00Z' }),
      ...['a', 'b', 'c', 'd', 'e'].map((id, i) =>
        rollout({ id, status: 'SUPERSEDED', promotedAt: `2026-11-0${i + 2}T00:00:00Z` }),
      ),
    ]
    const { current, previous } = splitRollouts(list)
    expect(current?.id).toBe('paused')
    expect(previous.map((r) => r.id)).toEqual(['e', 'd', 'c', 'b', 'a'])
  })

  it('has no current rollout when every one is done', () => {
    const { current, previous } = splitRollouts([rollout({ status: 'COMPLETE' })])
    expect(current).toBeNull()
    expect(previous).toHaveLength(1)
  })
})
