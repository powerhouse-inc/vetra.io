import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import React from 'react'
import type {
  AppRollout,
  PublisherEnvironment,
  PublisherLicense,
  PublisherTemplate,
  PublisherTerm,
} from '../types'

let licenses: PublisherLicense[] = []
let environments: PublisherEnvironment[] = []
let rolloutsQuery: { data: AppRollout[] | undefined; isPending: boolean; error: Error | null } = {
  data: [],
  isPending: false,
  error: null,
}
const replaceGrant = vi.fn()
const revoke = vi.fn()

vi.mock('@/modules/shared/hooks/use-person-name', async () => {
  const { addressOf } = await vi.importActual<typeof import('@/modules/shared/lib/renown-person')>(
    '@/modules/shared/lib/renown-person',
  )
  return {
    usePersonName: (v: string | null | undefined) => ({
      name: null,
      avatarUrl: null,
      address: addressOf(v),
    }),
  }
})
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
  usePublisherRollouts: () => ({ ...rolloutsQuery, refetch: vi.fn() }),
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

const env = (over: Partial<PublisherEnvironment>): PublisherEnvironment => ({
  environmentId: 'env-1',
  user: 'u',
  licenseId: 'l1',
  rootLicenseId: 'l1',
  label: 'Acme vault',
  templateHash: 'h',
  stoppedAt: null,
  deleteAfter: null,
  runningVersion: 'sha-cac9276bc10b',
  isCanary: false,
  update: null,
  ...over,
})

const rollout = (over: Partial<AppRollout>): AppRollout => ({
  id: 'r1',
  artifactName: 'vault-fusion',
  version: 'sha-0123456789ab',
  status: 'ACTIVE',
  applyAfter: new Date(Date.now() + 2 * 3600_000 + 60_000).toISOString(),
  promotedBy: 'did:pkh:eip155:1:0xabcdef0123456789abcdef0123456789abcdef01',
  promotedAt: '2026-11-10T00:00:00Z',
  pausedAt: null,
  pausedReason: null,
  counts: [
    { status: 'SUCCEEDED', count: 3 },
    { status: 'PENDING', count: 8 },
  ],
  ...over,
})

const versionCell = (id = 'l1') =>
  within(screen.getByTestId(`holder-${id}`)).getByTestId('environment-version')

describe('HoldersTab', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
    environments = []
    rolloutsQuery = { data: [], isPending: false, error: null }
  })

  describe('Version column', () => {
    it('shows the running version as is', () => {
      licenses = [lic({})]
      environments = [env({})]
      render(<HoldersTab appId="app-1" />)
      expect(screen.getByRole('columnheader', { name: 'Version' })).toBeTruthy()
      const cell = versionCell()
      expect(within(cell).getByText('sha-cac9276bc10b').className).toMatch(/font-mono/)
      expect(within(cell).queryByText(/canary/i)).toBeNull()
      expect(within(cell).queryByText(/→/)).toBeNull()
    })

    it('marks a canary', () => {
      licenses = [lic({})]
      environments = [env({ isCanary: true })]
      render(<HoldersTab appId="app-1" />)
      expect(within(versionCell()).getByText('canary')).toBeTruthy()
    })

    it('shows a pending update’s target, due time (exact on hover) and status', () => {
      const dueAt = new Date(Date.now() + 2 * 3600_000 + 60_000).toISOString()
      licenses = [lic({})]
      environments = [
        env({ update: { status: 'PENDING', toVersion: 'sha-0123456789ab', dueAt, error: null } }),
      ]
      render(<HoldersTab appId="app-1" />)
      const cell = versionCell()
      expect(within(cell).getByText('→ sha-0123456789ab')).toBeTruthy()
      const due = within(cell).getByText(/in 2 hours/)
      expect(due.getAttribute('title')).toBeTruthy()
      expect(within(cell).getByText('Pending')).toBeTruthy()
    })

    it('shows an applying update as applying', () => {
      licenses = [lic({})]
      environments = [
        env({
          update: {
            status: 'APPLYING',
            toVersion: 'sha-0123456789ab',
            dueAt: new Date(Date.now() - 60_000).toISOString(),
            error: null,
          },
        }),
      ]
      render(<HoldersTab appId="app-1" />)
      expect(within(versionCell()).getByText('Applying')).toBeTruthy()
      expect(within(versionCell()).getByText('→ sha-0123456789ab')).toBeTruthy()
    })

    it('shows a failed update’s error in muted red', () => {
      licenses = [lic({})]
      environments = [
        env({
          update: {
            status: 'FAILED',
            toVersion: 'sha-0123456789ab',
            dueAt: '2026-11-10T00:00:00Z',
            error: 'deployment failed: image pull backoff',
          },
        }),
      ]
      render(<HoldersTab appId="app-1" />)
      const err = within(versionCell()).getByText(/image pull backoff/)
      expect(err.className).toMatch(/text-destructive/)
    })

    it('says nothing about a finished update', () => {
      licenses = [lic({})]
      environments = [
        env({
          update: {
            status: 'SUCCEEDED',
            toVersion: 'sha-cac9276bc10b',
            dueAt: '2026-11-10T00:00:00Z',
            error: null,
          },
        }),
      ]
      render(<HoldersTab appId="app-1" />)
      expect(within(versionCell()).queryByText(/→/)).toBeNull()
    })

    it('shows a dash without a running version or without an environment', () => {
      licenses = [lic({ id: 'l1' }), lic({ id: 'l2', environmentId: 'env-x', kind: 'free' })]
      environments = [env({ runningVersion: null })]
      render(<HoldersTab appId="app-1" />)
      expect(versionCell('l1').textContent).toBe('—')
      expect(versionCell('l2').textContent).toBe('—')
    })
  })

  describe('rollout panel', () => {
    it('shows the active rollout with its notice, progress and how it applies', () => {
      licenses = [lic({})]
      rolloutsQuery = { data: [rollout({})], isPending: false, error: null }
      render(<HoldersTab appId="app-1" />)
      const panel = screen.getByTestId('rollout-panel')
      expect(within(panel).getByText('vault-fusion')).toBeTruthy()
      expect(within(panel).getByText('sha-0123456789ab')).toBeTruthy()
      expect(within(panel).getByText('Active')).toBeTruthy()
      expect(
        within(panel)
          .getByText(/in 2 hours/)
          .getAttribute('title'),
      ).toBeTruthy()
      expect(within(panel).getByText('3 of 11 updated · 8 pending · 0 failed')).toBeTruthy()
      expect(within(panel).getByRole('progressbar').getAttribute('aria-valuenow')).toBe('3')
      expect(within(panel).getByText(/one at a time/i)).toBeTruthy()
      expect(within(panel).getByText(/failure pauses the rollout/i)).toBeTruthy()
      expect(panel.textContent).not.toMatch(/0xabcdef0123456789abcdef0123456789abcdef01/)
    })

    it('shows why a paused rollout stopped', () => {
      licenses = [lic({})]
      rolloutsQuery = {
        data: [rollout({ status: 'PAUSED', pausedReason: 'env-7 failed: image pull backoff' })],
        isPending: false,
        error: null,
      }
      render(<HoldersTab appId="app-1" />)
      const panel = screen.getByTestId('rollout-panel')
      expect(within(panel).getByText('Paused')).toBeTruthy()
      expect(within(panel).getByText(/env-7 failed: image pull backoff/)).toBeTruthy()
    })

    it('lists earlier rollouts with their status under a disclosure', () => {
      licenses = [lic({})]
      rolloutsQuery = {
        data: [
          rollout({}),
          rollout({ id: 'r0', version: 'sha-old', status: 'SUPERSEDED', promotedAt: '2026-11-01' }),
        ],
        isPending: false,
        error: null,
      }
      render(<HoldersTab appId="app-1" />)
      const panel = screen.getByTestId('rollout-panel')
      fireEvent.click(within(panel).getByText(/previous rollouts/i))
      expect(within(panel).getByText('sha-old')).toBeTruthy()
      expect(within(panel).getByText('Superseded')).toBeTruthy()
    })

    it('is absent without an active or paused rollout', () => {
      licenses = [lic({})]
      rolloutsQuery = { data: [rollout({ status: 'COMPLETE' })], isPending: false, error: null }
      render(<HoldersTab appId="app-1" />)
      expect(screen.queryByTestId('rollout-panel')).toBeNull()
    })

    it('leaves the holders table in place when rollouts fail to load', () => {
      licenses = [lic({})]
      environments = [env({})]
      rolloutsQuery = { data: undefined, isPending: false, error: new Error('boom') }
      render(<HoldersTab appId="app-1" />)
      expect(screen.getByTestId('holder-l1')).toBeTruthy()
      expect(screen.queryByTestId('rollout-panel')).toBeNull()
      expect(screen.getByText(/rollout did not load/i)).toBeTruthy()
    })
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
        runningVersion: null,
        isCanary: false,
        update: null,
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
        runningVersion: null,
        isCanary: false,
        update: null,
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
