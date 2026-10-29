import { describe, expect, it } from 'vitest'
import type { CloudEnvironment } from '@/modules/cloud/types'
import type { Subscription } from '@/modules/subscriptions/types'
import { attentionItems } from '../lib/attention'

const env = (id: string, status: string, argoHealthStatus?: string): CloudEnvironment =>
  ({
    id,
    name: id,
    state: { status },
    health: argoHealthStatus ? { argoHealthStatus, argoSyncStatus: 'SYNCED' } : null,
  }) as unknown as CloudEnvironment

const sub = (warnings: Subscription['warnings']): Subscription =>
  ({
    licenseId: 'lic-1',
    appName: 'Invoicing',
    kind: 'TEAM',
    termLabel: 'Team',
    warnings,
  }) as unknown as Subscription

describe('attentionItems', () => {
  it('lists failed and degraded environments, not healthy or moving ones', () => {
    const items = attentionItems(
      [
        env('ok', 'READY', 'HEALTHY'),
        env('slow', 'READY', 'DEGRADED'),
        env('down', 'READY', 'MISSING'),
        env('broken', 'DEPLOYMENt_FAILED'),
        env('busy', 'DEPLOYING'),
        env('leaving', 'TERMINATING'),
      ],
      [],
    )
    expect(items.map((i) => [i.title, i.detail])).toEqual([
      ['down', 'Down'],
      ['broken', 'Failed'],
      ['slow', 'Degraded'],
    ])
  })

  it('adds subscription warnings, urgent ones first', () => {
    const items = attentionItems(
      [env('slow', 'READY', 'DEGRADED')],
      [
        sub([
          { kind: 'EXPIRING', at: '2026-11-01', message: 'Ends in 3 days' },
          { kind: 'DELETE_IMMINENT', at: '2026-11-02', message: 'Data is deleted tomorrow' },
        ]),
      ],
    )
    expect(items[0]).toMatchObject({ tone: 'danger', detail: 'Data is deleted tomorrow' })
    expect(items.map((i) => i.href)).toContain('/user/subscriptions?highlight=lic-1')
  })

  it('is empty when nothing needs attention', () => {
    expect(attentionItems([env('ok', 'READY', 'HEALTHY')], [sub([])])).toEqual([])
  })
})
