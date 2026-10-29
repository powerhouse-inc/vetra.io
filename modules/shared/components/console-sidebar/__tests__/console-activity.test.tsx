import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import type { CloudEnvironment } from '@/modules/cloud/types'

let environments: CloudEnvironment[] = []
let fetched = true
const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/user',
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('@/modules/shared/components/command-palette/command-palette', () => ({
  useCommandPalette: () => null,
}))
vi.mock('@/modules/shared/state/use-prefetch-on-intent', () => ({
  usePrefetchOnIntent: () => ({}),
}))
vi.mock('@/modules/cloud/hooks/use-environment', () => ({
  useEnvironments: () => ({
    environments,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
    isFetchedAfterMount: fetched,
  }),
}))
vi.mock('@/modules/orgs/hooks/use-orgs', () => ({
  useActiveOrg: () => ({
    orgId: null,
    org: null,
    orgs: [],
    isLoading: false,
    setActiveOrg: vi.fn(),
  }),
}))
vi.mock('sonner', () => ({ toast: { success: toastSuccess, error: toastError } }))

import { ActivityToasts } from '../activity-toasts'
import { ConsoleSidebar } from '../console-sidebar'

function env(id: string, status: string): CloudEnvironment {
  return { id, name: id, state: { label: id, status }, health: null } as unknown as CloudEnvironment
}

describe('console sidebar activity', () => {
  beforeEach(() => {
    cleanup()
    fetched = true
  })

  it('lists environments in motion, linking to each', () => {
    environments = [env('acme-prod', 'DEPLOYING'), env('acme-dev', 'READY')]
    render(<ConsoleSidebar />)
    expect(screen.getByText('Activity')).toBeTruthy()
    const link = screen.getByRole('link', { name: /acme-prod/ })
    expect(link.getAttribute('href')).toBe('/user/environments/acme-prod')
    expect(link.textContent).toContain('Deploying')
    expect(screen.queryByRole('link', { name: /acme-dev/ })).toBeNull()
  })

  it('shows no Activity block when nothing is moving', () => {
    environments = [env('acme-dev', 'READY')]
    render(<ConsoleSidebar />)
    expect(screen.queryByText('Activity')).toBeNull()
  })
})

describe('activity toasts', () => {
  beforeEach(() => {
    cleanup()
    toastSuccess.mockClear()
    toastError.mockClear()
    fetched = true
  })

  it('does not toast on first load, then toasts finished transitions', () => {
    environments = [env('acme-prod', 'DEPLOYING'), env('acme-dev', 'DEPLOYING')]
    const { rerender } = render(<ActivityToasts />)
    expect(toastSuccess).not.toHaveBeenCalled()
    expect(toastError).not.toHaveBeenCalled()

    environments = [env('acme-prod', 'READY'), env('acme-dev', 'DEPLOYMENt_FAILED')]
    rerender(<ActivityToasts />)
    expect(toastSuccess).toHaveBeenCalledWith('acme-prod is ready', expect.any(Object))
    expect(toastError).toHaveBeenCalledWith('acme-dev failed to deploy', expect.any(Object))
  })

  it('does not take a cache-restored list as the baseline', () => {
    fetched = false
    environments = [env('acme-prod', 'DEPLOYING')]
    const { rerender } = render(<ActivityToasts />)
    fetched = true
    environments = [env('acme-prod', 'READY')]
    rerender(<ActivityToasts />)
    expect(toastSuccess).not.toHaveBeenCalled()
  })
})
