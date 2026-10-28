import { describe, expect, it } from 'vitest'

import {
  IN_FLIGHT_POLL_MS,
  appHeadlineStatus,
  appPollInterval,
  appsPollInterval,
  canRollback,
  deploymentRowStatus,
  deploymentStatusMeta,
  deploymentsPollInterval,
  displayHost,
  githubCommitUrl,
  identityState,
  isAppReadOnly,
  isDeploymentInFlight,
  primaryUrl,
  refLabel,
  shortSha,
} from '@/modules/apps/lib/status'
import type { AppDeployment, AppPreview } from '@/modules/apps/types'

const deployment = (over: Partial<AppDeployment> = {}): AppDeployment => ({
  id: 'd1',
  appId: 'a1',
  environmentId: 'e1',
  kind: 'PRODUCTION',
  prNumber: null,
  gitRef: 'refs/heads/main',
  sha: 'abcdef1234567890',
  packages: [],
  imageTag: null,
  status: 'READY',
  actorDid: null,
  actorGithub: null,
  runUrl: null,
  error: null,
  createdAt: '2026-10-02T10:00:00Z',
  updatedAt: '2026-10-02T10:00:00Z',
  urls: { app: null, connect: null, switchboard: null },
  ...over,
})

const preview = (status: AppPreview['status']): AppPreview => ({
  environmentId: 'p1',
  prNumber: 1,
  gitRef: 'feature',
  prUrl: 'https://github.com/o/r/pull/1',
  lastDeployedAt: null,
  status,
  urls: { app: null, connect: null, switchboard: null },
})

describe('deployment status helpers', () => {
  it('marks only PENDING and DEPLOYING as in flight', () => {
    expect(isDeploymentInFlight('PENDING')).toBe(true)
    expect(isDeploymentInFlight('DEPLOYING')).toBe(true)
    expect(isDeploymentInFlight('READY')).toBe(false)
    expect(isDeploymentInFlight('FAILED')).toBe(false)
    expect(isDeploymentInFlight('SUPERSEDED')).toBe(false)
    expect(isDeploymentInFlight(null)).toBe(false)
  })

  it('labels and tones each status', () => {
    expect(deploymentStatusMeta('READY')).toEqual({
      label: 'Ready',
      tone: 'success',
      active: false,
    })
    expect(deploymentStatusMeta('FAILED').tone).toBe('danger')
    expect(deploymentStatusMeta('DEPLOYING').active).toBe(true)
    expect(deploymentStatusMeta(null).label).toBe('Not deployed')
  })

  it('prefers app-level problems over the latest deployment', () => {
    expect(
      appHeadlineStatus({ status: 'PENDING_IDENTITY', latestDeployment: deployment() }).label,
    ).toBe('Needs authorization')
    expect(appHeadlineStatus({ status: 'DISCONNECTED', latestDeployment: null }).tone).toBe(
      'danger',
    )
    expect(appHeadlineStatus({ status: 'ACTIVE', latestDeployment: null }).label).toBe(
      'No deployments',
    )
    expect(
      appHeadlineStatus({ status: 'ACTIVE', latestDeployment: deployment({ status: 'FAILED' }) })
        .label,
    ).toBe('Failed')
  })

  it('polls only while something is in flight', () => {
    expect(deploymentsPollInterval([deployment(), deployment({ status: 'PENDING' })])).toBe(
      IN_FLIGHT_POLL_MS,
    )
    expect(deploymentsPollInterval([deployment(), deployment({ status: 'FAILED' })])).toBe(false)
    expect(deploymentsPollInterval(undefined)).toBe(false)

    expect(
      appPollInterval({ latestDeployment: deployment({ status: 'DEPLOYING' }), previews: [] }),
    ).toBe(IN_FLIGHT_POLL_MS)
    expect(
      appPollInterval({ latestDeployment: deployment(), previews: [preview('PENDING')] }),
    ).toBe(IN_FLIGHT_POLL_MS)
    expect(appPollInterval({ latestDeployment: null, previews: [preview('READY')] })).toBe(false)
    expect(appsPollInterval([{ latestDeployment: null, previews: [] }])).toBe(false)
  })

  it('allows rollback only to READY production deployments', () => {
    expect(canRollback(deployment())).toBe(true)
    expect(canRollback(deployment({ kind: 'PREVIEW' }))).toBe(false)
    expect(canRollback(deployment({ status: 'FAILED' }))).toBe(false)
    expect(canRollback(deployment({ status: 'SUPERSEDED' }))).toBe(false)
  })
})

describe('git + url helpers', () => {
  it('formats refs', () => {
    expect(refLabel('refs/heads/main')).toBe('main')
    expect(refLabel('refs/tags/v1.2.0')).toBe('v1.2.0')
    expect(refLabel('refs/pull/42/merge')).toBe('PR #42')
    expect(refLabel('feature/x')).toBe('feature/x')
    expect(refLabel(null)).toBe('')
  })

  it('shortens shas and builds GitHub links', () => {
    expect(shortSha('abcdef1234567890')).toBe('abcdef1')
    expect(githubCommitUrl('o/r', 'abc')).toBe('https://github.com/o/r/commit/abc')
  })

  it('picks the most useful URL', () => {
    expect(primaryUrl({ app: null, connect: 'https://c', switchboard: 'https://s' })).toBe(
      'https://c',
    )
    expect(primaryUrl({ app: 'https://a', connect: 'https://c', switchboard: null })).toBe(
      'https://a',
    )
    expect(primaryUrl({ app: null, connect: null, switchboard: null })).toBeNull()
    expect(displayHost('https://foo-connect.vetra.io/')).toBe('foo-connect.vetra.io')
  })
})

describe('DELETED apps', () => {
  it('has its own neutral headline', () => {
    expect(appHeadlineStatus({ status: 'DELETED', latestDeployment: deployment() })).toEqual({
      label: 'Deleted',
      tone: 'neutral',
      active: false,
    })
  })

  it('never polls a deleted app', () => {
    expect(
      appPollInterval({
        status: 'DELETED',
        latestDeployment: deployment({ status: 'DEPLOYING' }),
        previews: [],
      }),
    ).toBe(false)
  })
})

describe('isAppReadOnly', () => {
  it('locks every action on a deleted app only', () => {
    expect(isAppReadOnly({ status: 'DELETED' })).toBe(true)
    expect(isAppReadOnly({ status: 'ACTIVE' })).toBe(false)
    expect(isAppReadOnly({ status: 'DISCONNECTED' })).toBe(false)
    expect(isAppReadOnly({ status: 'PENDING_IDENTITY' })).toBe(false)
  })
})

describe('identityState', () => {
  const now = new Date('2026-10-02T00:00:00Z')
  const days = (n: number) => new Date(now.getTime() + n * 86_400_000).toISOString()

  it('is valid with more than 30 days left', () => {
    expect(
      identityState(
        { status: 'ACTIVE', identityExpiresAt: days(200), latestDeployment: null },
        now,
      ),
    ).toEqual({
      kind: 'valid',
      expiresAt: days(200),
      daysLeft: 200,
    })
  })

  it('warns when fewer than 30 days are left', () => {
    expect(
      identityState({ status: 'ACTIVE', identityExpiresAt: days(12), latestDeployment: null }, now)
        .kind,
    ).toBe('expiring')
    expect(
      identityState({ status: 'ACTIVE', identityExpiresAt: days(30), latestDeployment: null }, now)
        .kind,
    ).toBe('valid')
  })

  it('is expired when the date passed', () => {
    expect(
      identityState({ status: 'ACTIVE', identityExpiresAt: days(-1), latestDeployment: null }, now)
        .kind,
    ).toBe('expired')
  })

  it('treats PENDING_IDENTITY after having been active as expired', () => {
    expect(
      identityState(
        { status: 'PENDING_IDENTITY', identityExpiresAt: days(-3), latestDeployment: null },
        now,
      ).kind,
    ).toBe('expired')
    expect(
      identityState(
        { status: 'PENDING_IDENTITY', identityExpiresAt: null, latestDeployment: deployment() },
        now,
      ).kind,
    ).toBe('expired')
  })

  it('is pending for a never-authorized app', () => {
    expect(
      identityState(
        { status: 'PENDING_IDENTITY', identityExpiresAt: null, latestDeployment: null },
        now,
      ).kind,
    ).toBe('pending')
  })

  it('tolerates backends without the field', () => {
    expect(identityState({ status: 'ACTIVE', latestDeployment: null }, now)).toEqual({
      kind: 'unknown',
    })
    expect(
      identityState({ status: 'DELETED', identityExpiresAt: days(1), latestDeployment: null }, now)
        .kind,
    ).toBe('unknown')
  })
})

describe('deploymentRowStatus', () => {
  it('keeps the live production deployment Ready', () => {
    const d = deployment({ id: 'live', status: 'READY' })
    expect(deploymentRowStatus(d, 'live')).toEqual({
      meta: { label: 'Ready', tone: 'success', active: false },
      note: null,
    })
  })

  it('shows an older READY production deployment as Superseded', () => {
    const d = deployment({ id: 'old', status: 'READY' })
    expect(deploymentRowStatus(d, 'live').meta).toEqual({
      label: 'Superseded',
      tone: 'neutral',
      active: false,
    })
  })

  it.each(['pull request #2 closed', 'pull request #12 is closed'])(
    'shows a preview torn down because "%s" as Closed with a muted note',
    (reason) => {
      const d = deployment({ kind: 'PREVIEW', prNumber: 2, status: 'SUPERSEDED', error: reason })
      expect(deploymentRowStatus(d, 'live')).toEqual({
        meta: { label: 'Closed', tone: 'neutral', active: false },
        note: { text: reason, tone: 'muted' },
      })
    },
  )

  it('keeps a preview replaced by a newer push Superseded', () => {
    const d = deployment({ kind: 'PREVIEW', prNumber: 2, status: 'SUPERSEDED', error: null })
    expect(deploymentRowStatus(d, 'live')).toEqual({
      meta: { label: 'Superseded', tone: 'neutral', active: false },
      note: null,
    })
  })

  it('shows any other superseded reason as a muted note, not an error', () => {
    const d = deployment({ status: 'SUPERSEDED', error: 'app deleted' })
    expect(deploymentRowStatus(d, 'live').note).toEqual({ text: 'app deleted', tone: 'muted' })
  })

  it('keeps failures red', () => {
    const d = deployment({ status: 'FAILED', error: 'image pull failed' })
    expect(deploymentRowStatus(d, 'live')).toEqual({
      meta: { label: 'Failed', tone: 'danger', active: false },
      note: { text: 'image pull failed', tone: 'danger' },
    })
  })

  it('leaves in-flight and READY previews alone', () => {
    expect(deploymentRowStatus(deployment({ status: 'DEPLOYING' }), 'live').meta.label).toBe(
      'Deploying',
    )
    expect(
      deploymentRowStatus(deployment({ kind: 'PREVIEW', prNumber: 3, status: 'READY' }), 'live')
        .meta.label,
    ).toBe('Ready')
  })
})
