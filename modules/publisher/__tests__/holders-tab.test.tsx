import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import React from 'react'
import type {
  PublisherEnvironment,
  PublisherLicense,
  PublisherTemplate,
  PublisherTerm,
} from '../types'

let licenses: PublisherLicense[] = []
let environments: PublisherEnvironment[] = []
const replaceGrant = vi.fn()
const revoke = vi.fn()

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../hooks/use-publisher', () => ({
  usePublisherLicenses: () => ({ data: licenses, isPending: false, error: null, refetch: vi.fn() }),
  usePublisherEnvironments: () => ({ data: environments, isPending: false, error: null }),
  usePublisherTerms: () => ({
    data: [
      {
        id: 't1',
        kind: 'free',
        label: 'Free',
        templateId: 'tpl-s',
        validityDays: null,
        issuers: ['PUBLISHER_GRANT'],
        status: 'ACTIVE',
        activeLicenses: 1,
      },
      {
        id: 't2',
        kind: 'pro',
        label: 'Pro',
        templateId: 'tpl-d',
        validityDays: null,
        issuers: ['PUBLISHER_GRANT'],
        status: 'ACTIVE',
        activeLicenses: 1,
      },
    ] satisfies PublisherTerm[],
    isPending: false,
    error: null,
  }),
  usePublisherTemplates: () => ({
    data: [
      { id: 'tpl-s', mode: 'SHARED' },
      { id: 'tpl-d', mode: 'DEDICATED' },
    ] as PublisherTemplate[],
    isPending: false,
    error: null,
  }),
  usePublisherAllowList: () => ({ data: [], isPending: false, error: null }),
}))
vi.mock('../hooks/use-publisher-mutations', () => ({
  useIssueGrant: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReplaceGrant: () => ({ mutateAsync: replaceGrant, isPending: false }),
  useRevokeLicense: () => ({ mutateAsync: revoke, isPending: false }),
  useAddToAllowList: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRemoveFromAllowList: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock(
  '@/modules/shared/components/ui/select',
  () => import('@/modules/shared/test/native-select'),
)

import { HoldersTab } from '../components/holders/holders-tab'

const lic = (over: Partial<PublisherLicense>): PublisherLicense => ({
  id: 'l1',
  user: 'did:pkh:eip155:1:0xabcdef0123456789abcdef0123456789abcdef01',
  kind: 'pro',
  issuer: 'PUBLISHER_GRANT',
  status: 'ACTIVE',
  start: '2026-10-01T00:00:00Z',
  end: null,
  environmentId: 'env-1',
  replacedBy: null,
  ...over,
})

describe('HoldersTab', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
    environments = []
  })

  it('invites a first grant when nobody holds a licence', () => {
    licenses = []
    render(<HoldersTab appId="app-1" />)
    expect(screen.getByText('Nobody holds a licence yet')).toBeTruthy()
  })

  it('shows each holder’s environment state as text, never as a link', () => {
    licenses = [lic({ status: 'REVOKED' })]
    environments = [
      {
        environmentId: 'env-1',
        user: 'u',
        licenseId: 'l1',
        rootLicenseId: 'l1',
        label: 'Acme vault',
        templateHash: 'h',
        stoppedAt: '2026-10-20T00:00:00Z',
        deleteAfter: '2027-01-10T00:00:00Z',
      },
    ]
    render(<HoldersTab appId="app-1" />)
    const row = screen.getByTestId('holder-l1')
    expect(within(row).getByText('Acme vault')).toBeTruthy()
    expect(within(row).getByText(/stopped/i)).toBeTruthy()
    expect(within(row).getByText(/deleted on/i)).toBeTruthy()
    expect(within(row).queryByRole('link')).toBeNull()
    expect(document.querySelector('a[href*="/user/environments"]')).toBeNull()
  })

  it('says a running environment is running', () => {
    licenses = [lic({})]
    environments = [
      {
        environmentId: 'env-1',
        user: 'u',
        licenseId: 'l1',
        rootLicenseId: 'l1',
        label: 'Acme vault',
        templateHash: 'h',
        stoppedAt: null,
        deleteAfter: null,
      },
    ]
    render(<HoldersTab appId="app-1" />)
    expect(within(screen.getByTestId('holder-l1')).getByText('Running')).toBeTruthy()
  })

  it('says a dedicated environment is on its way, and a shared plan has none of its own', () => {
    licenses = [
      lic({ id: 'l1', environmentId: null, status: 'ISSUED' }),
      lic({ id: 'l2', kind: 'free', environmentId: null }),
    ]
    render(<HoldersTab appId="app-1" />)
    expect(within(screen.getByTestId('holder-l1')).getByText('Being set up…')).toBeTruthy()
    expect(within(screen.getByTestId('holder-l2')).getByText('Shared environment')).toBeTruthy()
  })

  it('filters by status', () => {
    licenses = [lic({ id: 'l1' }), lic({ id: 'l2', status: 'EXPIRED' })]
    render(<HoldersTab appId="app-1" />)
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'EXPIRED' } })
    expect(screen.queryByTestId('holder-l1')).toBeNull()
    expect(screen.getByTestId('holder-l2')).toBeTruthy()
  })

  it('moves a holder to another plan in place', async () => {
    licenses = [lic({})]
    replaceGrant.mockResolvedValue('l9')
    render(<HoldersTab appId="app-1" />)
    fireEvent.click(
      within(screen.getByTestId('holder-l1')).getByRole('button', { name: 'Change plan' }),
    )
    fireEvent.change(screen.getByLabelText('New plan'), { target: { value: 'free' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Move to Free' })))
    expect(replaceGrant).toHaveBeenCalledWith({ licenseId: 'l1', kind: 'free' })
  })

  it('offers Change plan only on the newest ACTIVE, EXPIRED or REVOKED licence of a chain', () => {
    licenses = [
      lic({ id: 'active' }),
      lic({ id: 'issued', status: 'ISSUED' }),
      lic({ id: 'expired', status: 'EXPIRED' }),
      lic({ id: 'revoked', status: 'REVOKED' }),
      lic({ id: 'replaced', status: 'REPLACED', replacedBy: 'active' }),
    ]
    render(<HoldersTab appId="app-1" />)
    const has = (id: string, name: string) =>
      within(screen.getByTestId(`holder-${id}`)).queryByRole('button', { name }) !== null
    expect(
      ['active', 'issued', 'expired', 'revoked', 'replaced'].map((id) => has(id, 'Change plan')),
    ).toEqual([true, false, true, true, false])
    // Revoking stays for licences that are still running.
    expect(['active', 'issued', 'expired'].map((id) => has(id, 'Revoke'))).toEqual([
      true,
      true,
      false,
    ])
  })

  it('brings an expired holder back on the same plan', async () => {
    licenses = [lic({ status: 'EXPIRED' })]
    replaceGrant.mockResolvedValue('l9')
    render(<HoldersTab appId="app-1" />)
    fireEvent.click(
      within(screen.getByTestId('holder-l1')).getByRole('button', { name: 'Change plan' }),
    )
    fireEvent.change(screen.getByLabelText('New plan'), { target: { value: 'pro' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /^Move to / })))
    expect(replaceGrant).toHaveBeenCalledWith({ licenseId: 'l1', kind: 'pro' })
  })

  it('revokes with an optional reason and tells what happens to the environment', async () => {
    licenses = [lic({})]
    revoke.mockResolvedValue(true)
    render(<HoldersTab appId="app-1" />)
    fireEvent.click(within(screen.getByTestId('holder-l1')).getByRole('button', { name: 'Revoke' }))
    expect(screen.getByText(/stops in 14 days/i)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Reason (optional)'), { target: { value: 'refund' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Revoke licence' })))
    expect(revoke).toHaveBeenCalledWith({ licenseId: 'l1', reason: 'refund' })
  })
})
