import { describe, expect, it } from 'vitest'

import {
  auditDetail,
  auditGithubActor,
  auditSourceLabel,
  describeAuditEntry,
  filterAudit,
} from '@/modules/apps/lib/audit'
import type { AppAuditEntry } from '@/modules/apps/types'

const PERSON = '0x' + 'c'.repeat(40)

function entry(action: string, subject: string, detail: unknown): AppAuditEntry {
  return {
    id: `${action}-${subject}`,
    appId: 'app-1',
    at: '2026-11-12T10:00:00Z',
    actor: PERSON,
    source: 'console',
    action,
    subject,
    detail: JSON.stringify(detail),
  }
}

const text = (e: AppAuditEntry) =>
  describeAuditEntry(e)
    .map((p) => (typeof p === 'string' ? p : `<${p.person}>`))
    .join('')

describe('describeAuditEntry', () => {
  it('words plan changes', () => {
    const created = entry('plan.created', 'plan:p1', {
      slug: 'pro',
      name: 'Pro',
      access: 'shared',
      size: 'VETRA_AGENT_S',
      targetVersion: '1.4.0',
    })
    expect(text(created)).toBe('created plan Pro (shared, S), targeting 1.4.0')
    const updated = entry('plan.updated', 'plan:p1', {
      slug: 'pro',
      changes: { size: { from: 'VETRA_AGENT_S', to: 'VETRA_AGENT_M' } },
    })
    expect(text(updated)).toBe('changed plan pro: size from S to M')
    const retarget = entry('plan.target_set', 'plan:p1', {
      slug: 'pro',
      from: '1.4.0',
      to: '1.5.0',
    })
    expect(text(retarget)).toBe('retargeted pro from 1.4.0 to 1.5.0')
    const first = entry('plan.target_set', 'plan:p1', { slug: 'pro', from: null, to: '1.5.0' })
    expect(text(first)).toBe('targeted pro at 1.5.0')
    expect(text(entry('plan.retired', 'plan:p1', { slug: 'pro' }))).toBe('retired plan pro')
  })

  it('words settings without values', () => {
    const secret = entry('setting.set', 'setting:ALL/TOKEN', {
      name: 'TOKEN',
      scope: 'ALL',
      secret: true,
      replaced: false,
    })
    expect(text(secret)).toBe('set secret TOKEN (all instances)')
    const replaced = entry('setting.set', 'setting:BRANCH/API_URL', {
      name: 'API_URL',
      scope: 'BRANCH',
      secret: false,
      replaced: true,
    })
    expect(text(replaced)).toBe('replaced setting API_URL (branch instances)')
    const deleted = entry('setting.deleted', 'setting:PREVIEW/X', { name: 'X', scope: 'PREVIEW' })
    expect(text(deleted)).toBe('deleted setting X (preview instances)')
  })

  it('names role holders as people', () => {
    const a = '0x' + 'd'.repeat(40)
    const granted = entry('role.granted', `role:${a}`, { address: a, role: 'release_manager' })
    expect(text(granted)).toBe(`named <${a}> release manager`)
    expect(text(entry('role.removed', `role:${a}`, { address: a }))).toBe(
      `removed <${a}> as release manager`,
    )
  })

  it('words instance status changes and recorded releases', () => {
    const status = entry('instance.status', 'instance:i1', {
      name: 'main',
      from: 'updating',
      to: 'failed',
      reason: 'CrashLoopBackOff',
    })
    expect(text(status)).toBe('instance main: updating → failed (CrashLoopBackOff)')
    const release = entry('release.recorded', 'release:1.5.0', {
      version: '1.5.0',
      branch: 'main',
      githubActor: 'octocat',
    })
    expect(text(release)).toBe('recorded release 1.5.0 from main')
    expect(auditGithubActor(release)).toBe('octocat')
    const build = entry('build.recorded', 'release:1.5.0-dev.1', { version: '1.5.0-dev.1', pr: 12 })
    expect(text(build)).toBe('recorded build 1.5.0-dev.1 from PR #12')
  })

  it('falls back to the action and subject for anything new', () => {
    expect(text(entry('rollout.started', 'rollout:r1', {}))).toBe('rollout.started rollout:r1')
  })
})

describe('audit helpers', () => {
  it('survives a detail that is not JSON', () => {
    expect(auditDetail({ detail: 'nope' })).toEqual({})
    expect(auditGithubActor(entry('release.recorded', 'release:1', {}))).toBeNull()
  })

  it('labels sources and filters by subject prefix', () => {
    expect(auditSourceLabel('system')).toBe('Vetra')
    expect(auditSourceLabel('ci')).toBe('CI')
    expect(auditSourceLabel('later')).toBe('later')
    const rows = [
      entry('plan.retired', 'plan:p1', {}),
      entry('setting.deleted', 'setting:ALL/X', {}),
    ]
    expect(filterAudit(rows, 'plan:').map((e) => e.action)).toEqual(['plan.retired'])
    expect(filterAudit(rows, null)).toHaveLength(2)
  })
})
