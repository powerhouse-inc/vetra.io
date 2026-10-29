import { describe, expect, it } from 'vitest'
import { pendingChanges } from '../lib/pending-changes'

const op = (type: string, input: Record<string, unknown> = {}) => ({ action: { type, input } })

describe('pendingChanges', () => {
  it('lists only config changes made after the last approval', () => {
    const changes = pendingChanges([
      op('ADD_PACKAGE', { packageName: '@acme/old' }),
      op('APPROVE_CHANGES'),
      op('MARK_CHANGES_PUSHED'),
      op('REPORT_DEPLOYMENT_SUCCEEDED'),
      op('ADD_PACKAGE', { packageName: '@acme/crm', version: '0.9.1' }),
      op('SET_PACKAGE_VERSION', { packageName: '@acme/crm', version: '1.0.0' }),
    ])
    expect(changes).toEqual([
      { key: 'package:@acme/crm', kind: 'add', label: 'Install @acme/crm 0.9.1' },
    ])
  })

  it('treats a studio wake and the first initialize as approvals', () => {
    expect(pendingChanges([op('SET_LABEL', { label: 'a' }), op('WAKE_ENVIRONMENT')])).toEqual([])
    expect(pendingChanges([op('SET_LABEL', { label: 'a' }), op('INITIALIZE')])).toEqual([])
  })

  it('keeps the latest edit when the same thing changes twice', () => {
    const changes = pendingChanges([
      op('SET_LABEL', { label: 'first' }),
      op('ADD_PACKAGE', { packageName: '@acme/crm' }),
      op('SET_LABEL', { label: 'second' }),
    ])
    expect(changes.map((c) => c.label)).toEqual(['Install @acme/crm', 'Rename to “second”'])
  })

  it('cancels a package that was added and then removed', () => {
    const changes = pendingChanges([
      op('ADD_PACKAGE', { packageName: '@acme/crm' }),
      op('REMOVE_PACKAGE', { packageName: '@acme/crm' }),
    ])
    expect(changes).toEqual([])
  })

  it('shows a removed and re-added package as a change', () => {
    const [change] = pendingChanges([
      op('REMOVE_PACKAGE', { packageName: '@acme/crm' }),
      op('ADD_PACKAGE', { packageName: '@acme/crm', version: '2.0.0' }),
    ])
    expect(change).toMatchObject({ kind: 'change', label: 'Install @acme/crm 2.0.0' })
  })

  it('names services found by prefix from the current state', () => {
    const changes = pendingChanges(
      [op('SET_SERVICE_SIZE', { prefix: 'triage', size: 'VETRA_AGENT_M' })],
      [{ type: 'CLINT', prefix: 'triage', enabled: true }],
    )
    expect(changes[0].label).toBe('Agent: triage size: VETRA_AGENT_M')
  })

  it('says which way a toggled service ends up', () => {
    const changes = pendingChanges(
      [op('TOGGLE_SERVICE', { type: 'FUSION' })],
      [{ type: 'FUSION', prefix: 'fusion', enabled: false }],
    )
    expect(changes[0].label).toBe('Turn off Fusion')
  })

  it('ignores status and housekeeping actions', () => {
    expect(
      pendingChanges([
        op('SET_DNS_RECORDS'),
        op('SET_SERVICE_STATUS'),
        op('SET_BACKUP_SCHEDULE'),
        op('SYNC_ORG_OPERATORS'),
      ]),
    ).toEqual([])
  })
})
