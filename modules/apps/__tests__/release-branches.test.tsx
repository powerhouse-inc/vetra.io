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
import { validateReleaseBranch } from '../components/release-branches-field'

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
    releaseBranches: ['next', '1.x'],
    updatedAt: 't',
    ...over,
  }) as App

const field = () => screen.getByLabelText('Release branches')
const type = (text: string, key?: string) => {
  fireEvent.change(field(), { target: { value: text } })
  if (key) fireEvent.keyDown(field(), { key })
}
const renderSettings = (a = app(), canEdit?: boolean) =>
  render(<AppSettings app={a} onAuthorize={() => {}} canEdit={canEdit} />)

beforeEach(() => {
  mutate.mockReset()
})
afterEach(cleanup)

describe('validateReleaseBranch', () => {
  it('mirrors the server rules', () => {
    expect(validateReleaseBranch('next', [])).toBeNull()
    expect(validateReleaseBranch('release/*', [])).toBeNull()
    expect(validateReleaseBranch('a/**', [])).toMatch(/\*\*/)
    expect(validateReleaseBranch('a b', [])).toMatch(/spaces/)
    expect(validateReleaseBranch('x'.repeat(256), [])).toMatch(/255/)
    expect(validateReleaseBranch('next', ['next'])).toMatch(/already/)
    expect(
      validateReleaseBranch(
        'n',
        Array.from({ length: 20 }, (_, i) => `b${i}`),
      ),
    ).toMatch(/20/)
  })
})

describe('Release branches setting', () => {
  it('renders the current list with the explanation', () => {
    renderSettings()
    expect(screen.getByText('next')).toBeTruthy()
    expect(screen.getByText('1.x')).toBeTruthy()
    expect(screen.getByText(/production branch always can/i)).toBeTruthy()
  })

  it('adds a chip on Enter and on comma, and removes with x', () => {
    renderSettings(app({ releaseBranches: [] }))
    type('next', 'Enter')
    type('release/*,')
    expect(screen.getByText('next')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Remove release/*' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Remove next' }))
    expect(screen.queryByText('next')).toBeNull()
  })

  it('rejects invalid entries client-side', () => {
    renderSettings(app({ releaseBranches: [] }))
    type('a/**', 'Enter')
    expect(screen.getByRole('alert').textContent).toMatch(/\*\*/)
    expect(screen.queryByRole('button', { name: /Remove a/ })).toBeNull()
  })

  it('sends releaseBranches (and only that) on save', () => {
    renderSettings()
    type('beta', 'Enter')
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(mutate.mock.calls[0][0]).toEqual({ releaseBranches: ['next', '1.x', 'beta'] })
  })

  it('sends an empty list to clear', () => {
    renderSettings()
    fireEvent.click(screen.getByRole('button', { name: 'Remove next' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove 1.x' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(mutate.mock.calls[0][0]).toEqual({ releaseBranches: [] })
  })

  it('shows the server error inline', () => {
    mutate.mockImplementation((_input: unknown, opts: { onError: (e: Error) => void }) => {
      opts.onError(new AppsApiError('BAD_USER_INPUT', "Invalid release branch 'x'"))
    })
    renderSettings()
    type('x', 'Enter')
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(screen.getByRole('alert').textContent).toContain("Invalid release branch 'x'")
  })

  it('is read-only when the user cannot edit', () => {
    renderSettings(app(), false)
    expect(screen.getByText('next')).toBeTruthy()
    expect(screen.queryByLabelText('Release branches')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Remove next' })).toBeNull()
  })

  it('treats a backend without the field as an empty list', () => {
    renderSettings(app({ releaseBranches: undefined }))
    expect(screen.getByLabelText('Release branches')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
  })
})
