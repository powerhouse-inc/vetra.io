import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { App } from '../types'
import { AppsApiError } from '../graphql'

const mutate = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../hooks/use-apps', () => ({
  useUpdateApp: () => ({ mutate, isPending: false }),
  useDeleteApp: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock('../components/setup-deploys', () => ({ SetupDeploys: () => null }))
vi.mock('@/modules/orgs/components/org-badge', () => ({ OrgBadge: () => null }))
vi.mock('@/modules/orgs/hooks/use-orgs', () => ({
  useMyOrgs: () => ({ data: [] }),
  useOrgSummary: () => ({ data: undefined }),
}))
vi.mock('../hooks/use-app-profile', () => ({ useAppName: (_d: string, n: string) => n }))

import { AppSettings } from '../components/app-settings'

const app = (over: Partial<App> = {}) =>
  ({
    id: 'a1',
    name: 'Shop',
    slug: 'shop',
    status: 'ACTIVE',
    productionBranch: 'main',
    previewsEnabled: false,
    previewLimit: 5,
    previewTtlDays: 7,
    identityDid: 'did:key:z',
    harborProject: 'p',
    releaseBranches: [],
    instancesEnabled: false,
    updatedAt: 't',
    ...over,
  }) as App

const renderSettings = (a = app()) => render(<AppSettings app={a} onAuthorize={() => {}} canEdit />)

beforeEach(() => {
  mutate.mockReset()
})
afterEach(cleanup)

describe('Branch instances setting', () => {
  it('explains the switch', () => {
    renderSettings()
    expect(screen.getByLabelText('Branch instances')).toBeTruthy()
    expect(
      screen.getByText(
        'Run every release branch at its newest build, at its own URL. Feature branches and PRs come later.',
      ),
    ).toBeTruthy()
  })

  it('sends instancesEnabled on save', () => {
    renderSettings()
    fireEvent.click(screen.getByLabelText('Branch instances'))
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(mutate.mock.calls[0][0]).toEqual({ instancesEnabled: true })
  })

  it('shows the server error inline', () => {
    mutate.mockImplementation((_input: unknown, opts: { onError: (e: Error) => void }) => {
      opts.onError(new AppsApiError('BAD_USER_INPUT', 'App has no repository'))
    })
    renderSettings()
    fireEvent.click(screen.getByLabelText('Branch instances'))
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(screen.getByRole('alert').textContent).toContain('App has no repository')
  })

  it('is hidden when the backend does not serve the field', () => {
    renderSettings(app({ instancesEnabled: undefined }))
    expect(screen.queryByLabelText('Branch instances')).toBeNull()
  })
})
