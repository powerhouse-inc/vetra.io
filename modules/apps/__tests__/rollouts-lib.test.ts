import { describe, expect, it } from 'vitest'

import {
  backupReasonLabel,
  canRestore,
  compareVersions,
  followBranch,
  formatBytes,
  isHeld,
  isRestoring,
  newerRelease,
  rollableReleases,
  rollbackLosesData,
  rolloutControls,
  stepActions,
  warmCostEstimate,
  windowText,
} from '../lib/rollouts'
import { isDomainName, isMountPath, settingNameProblem, sortedNotices } from '../lib/holder'
import type { AppPlan, AppRelease, AppRollout, AppRolloutStep } from '../types'

const rel = (version: string, over: Partial<AppRelease> = {}) =>
  ({ version, kind: 'release', migrates: false, ...over }) as AppRelease
const plan = (over: Partial<AppPlan> = {}) =>
  ({ id: 'p1', targetVersion: '1.2.0', ...over }) as AppPlan
const step = (over: Partial<AppRolloutStep> = {}) =>
  ({ id: 's1', status: 'pending', position: 0, ...over }) as AppRolloutStep
const rollout = (over: Partial<AppRollout> = {}) =>
  ({
    id: 'r1',
    version: '1.3.0',
    status: 'active',
    direction: 'forward',
    steps: [],
    ...over,
  }) as AppRollout

describe('versions', () => {
  it('orders like semver, prereleases before their release', () => {
    expect(['1.10.0', '1.2.0', '1.2.0-rc.1', '1.2.1'].sort(compareVersions)).toEqual([
      '1.2.0-rc.1',
      '1.2.0',
      '1.2.1',
      '1.10.0',
    ])
  })

  it('offers releases newest first, never builds or withdrawn ones', () => {
    const list = [
      rel('1.1.0'),
      rel('1.3.0', { withdrawnAt: '2026-11-12T00:00:00Z' }),
      rel('1.2.0'),
      rel('1.4.0-next.1', { kind: 'build' }),
    ]
    expect(rollableReleases(list).map((r) => r.version)).toEqual(['1.2.0', '1.1.0'])
  })

  it('says a newer release is available only when there is one', () => {
    expect(newerRelease(plan(), [rel('1.2.0'), rel('1.3.0')])).toBe('1.3.0')
    expect(newerRelease(plan(), [rel('1.2.0'), rel('1.1.0')])).toBeNull()
    expect(newerRelease(plan({ targetVersion: null }), [rel('1.0.0')])).toBe('1.0.0')
    expect(newerRelease(plan(), [rel('1.3.0', { withdrawnAt: 'x' })])).toBeNull()
  })
})

describe('rollout controls', () => {
  it('pauses an active rollout and resumes a paused one', () => {
    expect(rolloutControls(rollout()).pause).toBe(true)
    const paused = rolloutControls(rollout({ status: 'paused' }))
    expect(paused.resume).toBe(true)
    expect(paused.pause).toBe(false)
  })

  it('blocks resume while a step is failed', () => {
    const r = rollout({ status: 'paused', steps: [step({ status: 'failed' })] })
    expect(rolloutControls(r).resumeBlocked).toBe(true)
  })

  it('offers roll back only for a forward rollout that moved something', () => {
    expect(rolloutControls(rollout()).rollBack).toBe(false)
    expect(
      rolloutControls(rollout({ status: 'complete', steps: [step({ status: 'succeeded' })] }))
        .rollBack,
    ).toBe(true)
    expect(
      rolloutControls(
        rollout({ direction: 'back', status: 'complete', steps: [step({ status: 'succeeded' })] }),
      ).rollBack,
    ).toBe(false)
  })

  it('retries failed steps and skips failed or waiting ones, only while live', () => {
    expect(stepActions(step({ status: 'failed' }), true)).toEqual({ retry: true, skip: true })
    expect(stepActions(step({ status: 'pending' }), true)).toEqual({ retry: false, skip: true })
    expect(stepActions(step({ status: 'succeeded' }), true)).toEqual({ retry: false, skip: false })
    expect(stepActions(step({ status: 'failed' }), false)).toEqual({ retry: false, skip: false })
  })

  it('asks for data loss acceptance only when the release migrates', () => {
    const releases = [rel('1.3.0', { migrates: true }), rel('1.2.0')]
    expect(rollbackLosesData({ version: '1.3.0' }, releases)).toBe(true)
    expect(rollbackLosesData({ version: '1.2.0' }, releases)).toBe(false)
    expect(rollbackLosesData({ version: '9.9.9' }, releases)).toBe(false)
  })
})

describe('backups', () => {
  it('words the reason, with the release for a pre-update backup', () => {
    expect(backupReasonLabel({ reason: 'pre_update', version: '1.3.0' })).toBe(
      'Before update 1.3.0',
    )
    expect(backupReasonLabel({ reason: 'daily', version: null })).toBe('Daily')
    expect(backupReasonLabel({ reason: 'pre_restore', version: null })).toBe('Before restore')
  })

  it('restores only ready backups of the release the instance runs', () => {
    expect(canRestore({ status: 'ready', version: '1.2.0' }, '1.2.0')).toBe(true)
    expect(canRestore({ status: 'ready', version: '1.1.0' }, '1.2.0')).toBe(false)
    expect(canRestore({ status: 'pending', version: '1.2.0' }, '1.2.0')).toBe(false)
  })

  it('reads the maintenance marker', () => {
    expect(isRestoring('restore:abc')).toBe(true)
    expect(isHeld('held:abc')).toBe(true)
    expect(isRestoring('held:abc')).toBe(false)
    expect(isHeld(null)).toBe(false)
  })

  it('formats sizes', () => {
    expect(formatBytes(null)).toBe('-')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(5 * 1024 * 1024 * 1024)).toBe('5.0 GB')
  })
})

describe('plan settings', () => {
  it('reads the followed branch', () => {
    expect(followBranch('follow:next')).toBe('next')
    expect(followBranch('manual')).toBeNull()
  })

  it('summarises an update window', () => {
    expect(
      windowText({ days: [1, 2], start: '02:00', end: '04:00', timeZone: 'Europe/Berlin' }),
    ).toBe('Mon, Tue 02:00-04:00 (Europe/Berlin)')
    expect(
      windowText({ days: [1, 2, 3, 4, 5, 6, 7], start: '00:00', end: '00:00', timeZone: 'UTC' }),
    ).toBe('Every day, all day (UTC)')
  })

  it('scales the warm pool estimate from the current one', () => {
    const p = plan({ warmPoolEffective: 2, warmPoolEurPerMonth: 30, warmPoolSize: 2 })
    expect(warmCostEstimate(p, 4)).toBe(60)
    expect(warmCostEstimate(p, 0)).toBe(0)
    expect(warmCostEstimate(plan({ warmPoolEffective: 0 }), 3)).toBeNull()
  })
})

describe('holder helpers', () => {
  it('orders notices by urgency', () => {
    const kinds = sortedNotices([
      { kind: 'EXPIRING', at: null, message: 'a' },
      { kind: 'DELETE_IMMINENT', at: null, message: 'b' },
      { kind: 'STOPPED', at: null, message: 'c' },
    ]).map((n) => n.kind)
    expect(kinds).toEqual(['DELETE_IMMINENT', 'STOPPED', 'EXPIRING'])
  })

  it('validates setting names against what Vetra reserves', () => {
    const reserved = { reservedNames: ['ADMINS'], reservedPrefixes: ['VETRA_'] }
    expect(settingNameProblem('my_key', reserved)).toMatch(/capitals/i)
    expect(settingNameProblem('ADMINS', reserved)).toMatch(/set by Vetra/)
    expect(settingNameProblem('VETRA_X', reserved)).toMatch(/VETRA_/)
    expect(settingNameProblem('MY_KEY', reserved)).toBeNull()
  })

  it('validates mount paths and domain names', () => {
    expect(isMountPath('/etc/app/c.json')).toBe(true)
    expect(isMountPath('etc/app')).toBe(false)
    expect(isMountPath('/etc/../x')).toBe(false)
    expect(isDomainName('notes.example.com')).toBe(true)
    expect(isDomainName('localhost')).toBe(false)
    expect(isDomainName('https://x.com')).toBe(false)
  })
})
