import { cleanup, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AppInstance, AppRelease } from '../types'

type QueryState = { data: AppInstance[] | undefined; isPending: boolean; error: Error | null }
let state: QueryState
const useAppInstances = vi.fn((appId: string, enabled?: boolean) => {
  void appId
  void enabled
  return { ...state, refetch: vi.fn(), isRefetching: false }
})
const releases: AppRelease[] = []

vi.mock('../hooks/use-apps', () => ({
  useAppInstances: (appId: string, enabled?: boolean) => useAppInstances(appId, enabled),
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

  it('shows the empty state', () => {
    state.data = []
    render(<AppInstances appId="a1" />)
    expect(
      screen.getByText('No instances yet — they appear when a release branch has a build.'),
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

  it('shows the panel only when instances are enabled', () => {
    const { rerender } = render(
      <AppReleases appId="a1" repository="o/r" instancesEnabled={false} />,
    )
    expect(screen.queryByText('Instances')).toBeNull()
    expect(useAppInstances).not.toHaveBeenCalled()
    rerender(<AppReleases appId="a1" repository="o/r" instancesEnabled />)
    expect(screen.getByText('Instances')).toBeTruthy()
    expect(screen.getByTestId('instance-i1')).toBeTruthy()
  })
})
