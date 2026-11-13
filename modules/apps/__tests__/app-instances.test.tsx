import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AppInstance, AppPlan, AppRelease, InstanceBackup } from '../types'

type QueryState = { data: AppInstance[] | undefined; isPending: boolean; error: Error | null }
let state: QueryState
const useAppInstances = vi.fn((appId: string, enabled?: boolean) => {
  void appId
  void enabled
  return { ...state, refetch: vi.fn(), isRefetching: false }
})
const releases: AppRelease[] = []
let plans: AppPlan[] = []
let accessData: { release: boolean } | undefined
let backups: InstanceBackup[] = []

vi.mock('@/modules/shared/hooks/use-person-name', () => ({
  usePersonName: (v: string) =>
    v === '0x1234567890abcdef1234567890abcdef12345678'
      ? { name: 'Frank', avatarUrl: null, address: v }
      : { name: null, avatarUrl: null, address: null },
}))

vi.mock('../hooks/use-apps', () => ({
  useAppAccess: () => ({ data: accessData }),
  useWithdrawRelease: () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false, error: null }),
  usePinInstance: () => ({ mutate: vi.fn(), isPending: false, error: null }),
  useInstanceBackups: () => ({ data: backups, isPending: false, error: null }),
  useInstanceRestores: () => ({ data: [], isPending: false, error: null }),
  useBackUpInstance: () => ({ mutate: vi.fn(), isPending: false, error: null }),
  useRestoreInstanceBackup: () => ({
    mutate: vi.fn(),
    isPending: false,
    error: null,
    reset: vi.fn(),
  }),
  useAppInstances: (appId: string, enabled?: boolean) => useAppInstances(appId, enabled),
  useAppPlans: () => ({ data: plans, isPending: false, error: null }),
  useAppReleases: () => ({
    data: releases,
    isPending: false,
    error: null,
    refetch: vi.fn(),
    isRefetching: false,
  }),
  instancesPollInterval: (data: AppInstance[] | undefined) =>
    data?.some((i) => i.status === 'pending' || i.status === 'updating') ? 10_000 : false,
}))

import { AppInstances } from '../components/app-instances'
import { AppReleases } from '../components/app-releases'
import { instancesPollInterval } from '../hooks/use-apps'

function instance(over: Partial<AppInstance> = {}): AppInstance {
  return {
    id: 'i1',
    kind: 'branch',
    name: 'next',
    branch: 'next',
    pr: null,
    url: 'https://next.shop.vetra.io',
    status: 'ready',
    reason: null,
    targetVersion: '1.1.0-next.4',
    targetDigest: 'sha256:aa',
    runningVersion: '1.1.0-next.4',
    runningDigest: 'sha256:aa',
    environmentId: 'env-1',
    updatedAt: '2026-11-10T12:00:00Z',
    ...over,
  }
}

describe('AppInstances', () => {
  beforeEach(() => {
    cleanup()
    state = { data: [instance()], isPending: false, error: null }
  })

  it('shows branch, https link and status', () => {
    render(<AppInstances appId="a1" />)
    const row = screen.getByTestId('instance-i1')
    expect(within(row).getByText('next')).toBeTruthy()
    const link = within(row).getByRole('link', { name: /next\.shop\.vetra\.io/ })
    expect(link.getAttribute('href')).toBe('https://next.shop.vetra.io')
    expect(within(row).getByText('ready')).toBeTruthy()
    // same version running and targeted: no arrow
    expect(row.textContent).not.toContain('→')
  })

  it('shows running -> target when they differ, with the reason', () => {
    state.data = [
      instance({
        status: 'failed',
        reason: 'image pull failed',
        runningVersion: '1.1.0-next.3',
        targetVersion: '1.1.0-next.4',
      }),
    ]
    render(<AppInstances appId="a1" />)
    const row = screen.getByTestId('instance-i1')
    expect(within(row).getByText('failed')).toBeTruthy()
    expect(row.textContent).toContain('image pull failed')
    expect(row.textContent).toContain('1.1.0-next.3 → 1.1.0-next.4')
  })

  it('does not link a non-https or missing url', () => {
    state.data = [instance({ url: 'javascript:alert(1)' }), instance({ id: 'i2', url: null })]
    render(<AppInstances appId="a1" />)
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })

  it('shows "settings pending" while the instance has not run the latest settings', () => {
    state.data = [
      instance({ settingsRevision: 'bbbb', runningSettingsRevision: 'aaaa' }),
      instance({ id: 'i2', settingsRevision: 'aaaa', runningSettingsRevision: 'aaaa' }),
    ]
    render(<AppInstances appId="a1" />)
    expect(within(screen.getByTestId('instance-i1')).getByText('settings pending')).toBeTruthy()
    expect(within(screen.getByTestId('instance-i2')).queryByText('settings pending')).toBeNull()
  })

  it('shows a failure after a settings change as such, without "settings pending"', () => {
    state.data = [
      instance({
        status: 'failed',
        reason: 'after a settings change: crash loop (3 restarts)',
        settingsRevision: 'bbbb',
        runningSettingsRevision: 'aaaa',
      }),
    ]
    render(<AppInstances appId="a1" />)
    const row = screen.getByTestId('instance-i1')
    expect(within(row).getByText('After a settings change:')).toBeTruthy()
    expect(row.textContent).toContain('crash loop (3 restarts)')
    expect(row.textContent).not.toContain('after a settings change: crash')
    expect(within(row).queryByText('settings pending')).toBeNull()
  })

  it('shows the empty state', () => {
    state.data = []
    render(<AppInstances appId="a1" />)
    expect(
      screen.getByText(
        'No instances yet — they appear when a release branch has a build, or a plan has holders.',
      ),
    ).toBeTruthy()
  })
})

describe('instancesPollInterval', () => {
  it('polls every 10 s only while pending or updating', () => {
    expect(instancesPollInterval([instance({ status: 'pending' })])).toBe(10_000)
    expect(instancesPollInterval([instance(), instance({ status: 'updating' })])).toBe(10_000)
    expect(instancesPollInterval([instance(), instance({ status: 'failed' })])).toBe(false)
    expect(instancesPollInterval(undefined)).toBe(false)
  })
})

describe('AppReleases instances panel', () => {
  beforeEach(() => {
    cleanup()
    state = { data: [instance()], isPending: false, error: null }
    useAppInstances.mockClear()
  })

  it('shows branch instances only when instances are enabled', () => {
    const { rerender } = render(
      <AppReleases appId="a1" repository="o/r" instancesEnabled={false} />,
    )
    expect(screen.queryByText('Instances')).toBeNull()
    rerender(<AppReleases appId="a1" repository="o/r" instancesEnabled />)
    expect(screen.getByText('Instances')).toBeTruthy()
    expect(screen.getByTestId('instance-i1')).toBeTruthy()
  })

  it("shows plans' instances even without branch instances", () => {
    state.data = [instance({ kind: 'shared', planId: 'p1', branch: null, name: 'pro' })]
    render(<AppReleases appId="a1" repository="o/r" instancesEnabled={false} />)
    expect(screen.getByTestId('instance-i1')).toBeTruthy()
  })
})

describe('AppInstances of plans', () => {
  beforeEach(() => {
    cleanup()
    plans = [{ id: 'p1', name: 'Pro' } as AppPlan]
  })

  it('names a shared instance by its plan', () => {
    state = {
      data: [instance({ kind: 'shared', planId: 'p1', branch: null, name: 'pro' })],
      isPending: false,
      error: null,
    }
    render(<AppInstances appId="a1" />)
    const row = screen.getByTestId('instance-i1')
    expect(within(row).getByText('Pro')).toBeTruthy()
    expect(within(row).getByText('shared')).toBeTruthy()
  })

  it("shows an own instance's holder by Renown name, never the address", () => {
    const holder = '0x1234567890abcdef1234567890abcdef12345678'
    state = {
      data: [instance({ kind: 'own', planId: 'p1', holder, branch: null, name: 'pro-x' })],
      isPending: false,
      error: null,
    }
    render(<AppInstances appId="a1" />)
    const row = screen.getByTestId('instance-i1')
    expect(within(row).getByText('Frank')).toBeTruthy()
    expect(row.textContent).not.toContain(holder)
  })

  it('says why an instance is stopped', () => {
    state = {
      data: [
        instance({
          kind: 'own',
          planId: 'p1',
          status: 'stopped',
          reason: 'licence ended',
          branch: null,
        }),
      ],
      isPending: false,
      error: null,
    }
    render(<AppInstances appId="a1" />)
    expect(screen.getByTestId('instance-i1').textContent).toContain('stopped: licence ended')
  })
})

describe('AppInstances health', () => {
  beforeEach(() => cleanup())
  const row = (over: Partial<AppInstance>) => {
    state = { data: [instance(over)], isPending: false, error: null }
    render(<AppInstances appId="a1" />)
    return screen.getByTestId('instance-i1')
  }

  it('shows a degraded badge', () => {
    expect(within(row({ status: 'degraded' })).getByText('degraded').className).toContain(
      'text-warning',
    )
  })

  it('shows unhealthy check, reason and checked time', () => {
    const r = row({
      health: 'unhealthy',
      healthCheck: 'pod',
      healthReason: 'the container does not start (CrashLoopBackOff)',
      healthCheckedAt: '2026-11-10T12:00:00Z',
    })
    expect(within(r).getByText('pod')).toBeTruthy()
    expect(within(r).getByText(/CrashLoopBackOff/)).toBeTruthy()
    expect(
      within(r)
        .getByText(/^checked /)
        .getAttribute('title'),
    ).toBeTruthy()
  })

  it('shows unknown and healthy without a reason', () => {
    expect(
      within(row({ health: 'unknown', healthCheck: 'ready' })).getByText('unknown'),
    ).toBeTruthy()
    cleanup()
    const r = row({ health: 'healthy', healthCheck: 'data', healthReason: 'hidden reason' })
    expect(within(r).getByText('healthy')).toBeTruthy()
    expect(within(r).queryByText('hidden reason')).toBeNull()
  })

  it('shows the observed digest when it differs from the target', () => {
    const r = row({ observedDigest: 'sha256:bbccddeeff', observedDigestSource: 'pod' })
    expect(within(r).getByText('running bbccdde (pod)')).toBeTruthy()
  })

  it('does not show it when the digest matches', () => {
    expect(within(row({ observedDigest: 'sha256:aa' })).queryByText(/running /)).toBeNull()
  })

  it('notes a revert when failed but healthy', () => {
    const r = row({ status: 'failed', health: 'healthy' })
    expect(within(r).getByText('reverted to the last healthy build')).toBeTruthy()
  })

  it('renders nothing extra without health fields', () => {
    const r = row({})
    expect(within(r).queryByText(/checked |reverted|running /)).toBeNull()
  })
})

describe('AppInstances plan features', () => {
  beforeEach(() => {
    cleanup()
    accessData = { release: true }
    backups = []
    releases.length = 0
    plans = [{ id: 'p1', name: 'Pro' } as AppPlan]
  })

  const own = (over: Partial<AppInstance> = {}) =>
    instance({
      id: 'o1',
      kind: 'own',
      planId: 'p1',
      holder: '0x1234567890abcdef1234567890abcdef12345678',
      name: 'pro-frank',
      runningVersion: '1.2.0',
      targetVersion: '1.2.0',
      ...over,
    })

  it('lets a release manager pin an own instance, and shows what it is pinned at', () => {
    releases.push({ version: '1.2.0', kind: 'release' } as AppRelease)
    state = { data: [own({ pinnedVersion: '1.1.0' })], isPending: false, error: null }
    render(<AppInstances appId="a1" />)
    const row = screen.getByTestId('instance-o1')
    expect(row.textContent).toContain('pinned at 1.1.0')
    expect(within(row).getByRole('button', { name: 'Change pin' })).toBeTruthy()
    expect(within(row).getByRole('button', { name: 'Unpin' })).toBeTruthy()
    expect(within(row).getByText('Frank')).toBeTruthy()
  })

  it('offers no pin or backups without the release permission', () => {
    accessData = { release: false }
    state = { data: [own()], isPending: false, error: null }
    render(<AppInstances appId="a1" />)
    const row = screen.getByTestId('instance-o1')
    expect(within(row).queryByRole('button', { name: 'Pin' })).toBeNull()
    expect(within(row).queryByRole('button', { name: 'Backups' })).toBeNull()
  })

  it('warns when an instance still runs a withdrawn release', () => {
    releases.push({
      version: '1.2.0',
      kind: 'release',
      withdrawnAt: '2026-11-12T00:00:00Z',
      withdrawnReason: 'bad migration',
    } as AppRelease)
    state = { data: [own()], isPending: false, error: null }
    render(<AppInstances appId="a1" />)
    expect(screen.getByText('runs a withdrawn release')).toBeTruthy()
  })

  it('labels warm instances and claimed ones', () => {
    state = {
      data: [
        own({ id: 'w1', holder: null, warm: true }),
        own({ id: 'c1', claimedAt: '2026-11-13T08:00:00Z' }),
      ],
      isPending: false,
      error: null,
    }
    render(<AppInstances appId="a1" />)
    expect(screen.getByTestId('instance-w1').textContent).toContain('Warm (no holder yet)')
    expect(
      within(screen.getByTestId('instance-w1')).queryByRole('button', { name: 'Pin' }),
    ).toBeNull()
    expect(screen.getByTestId('instance-c1').textContent).toContain('from the warm pool')
  })

  it('says an instance is stopped after a failed restore and shows restore progress', () => {
    state = {
      data: [
        own({ id: 'h1', maintenance: 'held:r1' }),
        own({ id: 'r1', maintenance: 'restore:r2' }),
      ],
      isPending: false,
      error: null,
    }
    render(<AppInstances appId="a1" />)
    expect(screen.getByRole('alert').textContent).toContain('Stopped after a failed restore')
    expect(screen.getByTestId('restore-progress-r1').textContent).toContain('Restoring a backup')
  })

  it('shows the backups of a plan instance on demand', () => {
    backups = [
      {
        id: 'b1',
        instanceId: 'o1',
        reason: 'daily',
        status: 'ready',
        version: '1.2.0',
        sizeBytes: 1024,
        error: null,
        requestedBy: 'vetra',
        createdAt: '2026-11-13T00:00:00Z',
        finishedAt: null,
        expiresAt: '2026-12-13T00:00:00Z',
        rolloutStepId: null,
      },
    ]
    state = { data: [own()], isPending: false, error: null }
    render(<AppInstances appId="a1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Backups' }))
    expect(screen.getByTestId('backup-b1').textContent).toContain('Daily')
  })
})
