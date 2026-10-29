import { describe, expect, it } from 'vitest'
import { environmentActivity, transitionMessage } from '@/modules/cloud/lib/activity'
import type { ArgoHealthStatus, ArgoSyncStatus, CloudEnvironment } from '@/modules/cloud/types'

function env(
  id: string,
  status: string,
  health?: { argoHealthStatus: ArgoHealthStatus; argoSyncStatus: ArgoSyncStatus },
): CloudEnvironment {
  return {
    id,
    name: `${id}-doc`,
    state: { label: id, status },
    health: health ?? null,
  } as unknown as CloudEnvironment
}

const HEALTHY = { argoHealthStatus: 'HEALTHY', argoSyncStatus: 'SYNCED' } as const
const SYNCING = { argoHealthStatus: 'PROGRESSING', argoSyncStatus: 'SYNCED' } as const
const DEGRADED = { argoHealthStatus: 'DEGRADED', argoSyncStatus: 'SYNCED' } as const

describe('environmentActivity', () => {
  it('lists the environments in motion', () => {
    const { inMotion } = environmentActivity(null, [
      env('a', 'DEPLOYING'),
      env('b', 'READY'),
      env('c', 'TERMINATING'),
      env('d', 'READY', SYNCING),
      env('e', 'CHANGES_PUSHED'),
    ])
    expect(inMotion.map((e) => [e.id, e.meta.label])).toEqual([
      ['a', 'Deploying'],
      ['c', 'Terminating'],
      ['d', 'Syncing'],
      ['e', 'Deploying'],
    ])
  })

  it('reports nothing as finished on first load', () => {
    const { finished } = environmentActivity(null, [
      env('a', 'READY'),
      env('b', 'DEPLOYMENt_FAILED'),
    ])
    expect(finished).toEqual([])
  })

  it('reports a deploy that landed as success', () => {
    const { finished } = environmentActivity([env('a', 'DEPLOYING')], [env('a', 'READY')])
    expect(finished).toHaveLength(1)
    expect(finished[0]).toMatchObject({ id: 'a', name: 'a', outcome: 'success' })
    expect(transitionMessage(finished[0])).toBe('a is ready')
  })

  it('reports a sync that went healthy as success', () => {
    const { finished } = environmentActivity(
      [env('a', 'READY', SYNCING)],
      [env('a', 'READY', HEALTHY)],
    )
    expect(finished[0]).toMatchObject({ outcome: 'success', meta: { label: 'Healthy' } })
    expect(transitionMessage(finished[0])).toBe('a is ready')
  })

  it('reports a failed deploy and a degraded sync as failures', () => {
    const { finished } = environmentActivity(
      [env('a', 'DEPLOYING'), env('b', 'READY', SYNCING)],
      [env('a', 'DEPLOYMENt_FAILED'), env('b', 'READY', DEGRADED)],
    )
    expect(finished.map((t) => t.outcome)).toEqual(['failure', 'failure'])
    expect(finished.map(transitionMessage)).toEqual(['a failed to deploy', 'b is degraded'])
  })

  it('ignores envs that were not moving, and moves to neutral states', () => {
    const { finished } = environmentActivity(
      [env('a', 'READY'), env('b', 'DEPLOYMENt_FAILED'), env('c', 'TERMINATING')],
      [env('a', 'READY', DEGRADED), env('b', 'READY'), env('c', 'DESTROYED')],
    )
    expect(finished).toEqual([])
  })

  it('ignores an env it has not seen before', () => {
    const { finished } = environmentActivity(
      [env('a', 'READY')],
      [env('a', 'READY'), env('b', 'READY')],
    )
    expect(finished).toEqual([])
  })

  it('falls back to the document name when there is no label', () => {
    const unlabeled = { ...env('a', 'DEPLOYING'), state: { label: null, status: 'DEPLOYING' } }
    const { inMotion } = environmentActivity(null, [unlabeled as unknown as CloudEnvironment])
    expect(inMotion[0].name).toBe('a-doc')
  })
})
