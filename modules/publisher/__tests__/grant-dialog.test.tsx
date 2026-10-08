import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import type { PublisherLicense, PublisherTemplate, PublisherTerm } from '../types'

const issueGrant = vi.fn()
const addToAllowList = vi.fn()
const toastError = vi.fn()
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: (...a: unknown[]) => toastError(...a) } }))
vi.mock('../hooks/use-publisher-mutations', () => ({
  useIssueGrant: () => ({ mutateAsync: issueGrant, isPending: false }),
  useAddToAllowList: () => ({ mutateAsync: addToAllowList, isPending: false }),
}))
vi.mock('@/modules/shared/components/ui/select', () => import('@/modules/shared/test/native-select'))

import { GrantDialog } from '../components/holders/grant-dialog'
import { PublisherApiError } from '../graphql'

const A = '0xAbCdEf0123456789aBcDeF0123456789AbCdEf01'
const terms: PublisherTerm[] = [
  { id: 't1', kind: 'pro', label: 'Pro', templateId: 'tpl-1', validityDays: null, issuers: ['PUBLISHER_GRANT'], status: 'ACTIVE', activeLicenses: 0 },
  { id: 't2', kind: 'conf', label: 'Conf', templateId: 'tpl-1', validityDays: null, issuers: ['INVITE_CODE'], status: 'ACTIVE', activeLicenses: 0 },
]
const templates = [{ id: 'tpl-1', mode: 'DEDICATED' } as PublisherTemplate]

function renderDialog(
  licenses: PublisherLicense[] = [],
  allowList = [{ user: A.toLowerCase(), addedAt: 'x' }],
  extra: { loadError?: boolean; loadFailed?: boolean; onRetry?: () => void } = {},
) {
  return render(
    <GrantDialog appId="app-1" open onOpenChange={vi.fn()} licenses={licenses} terms={terms} templates={templates} allowList={allowList} {...extra} />,
  )
}

describe('GrantDialog', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('offers only plans a publisher may grant', () => {
    renderDialog()
    const options = Array.from((screen.getByLabelText('Plan') as HTMLSelectElement).options).map((o) => o.textContent)
    expect(options).toEqual(['', 'Pro'])
  })

  it('refuses DIDs the server will refuse', async () => {
    renderDialog()
    fireEvent.change(screen.getByLabelText('Wallet address or DID'), { target: { value: 'did:key:z6Mk' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Grant licence' })))
    expect(screen.getByText(/0x wallet address or a did:pkh/i)).toBeTruthy()
    expect(issueGrant).not.toHaveBeenCalled()
  })

  it('grants with a project name for a dedicated plan', async () => {
    issueGrant.mockResolvedValue('lic-1')
    renderDialog()
    fireEvent.change(screen.getByLabelText('Wallet address or DID'), { target: { value: A } })
    fireEvent.change(screen.getByLabelText('Plan'), { target: { value: 'pro' } })
    fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'Acme vault' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Grant licence' })))
    expect(addToAllowList).not.toHaveBeenCalled()
    expect(issueGrant).toHaveBeenCalledWith({ kind: 'pro', user: A, label: 'Acme vault' })
  })

  it('adds someone to the allow list first when they are not on it', async () => {
    issueGrant.mockResolvedValue('lic-1')
    addToAllowList.mockResolvedValue(true)
    renderDialog([], [])
    fireEvent.change(screen.getByLabelText('Wallet address or DID'), { target: { value: A } })
    expect(screen.getByText(/added to your allow list/i)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Plan'), { target: { value: 'pro' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Add to allow list and grant' })))
    expect(addToAllowList).toHaveBeenCalledWith({ user: A })
    expect(issueGrant).toHaveBeenCalledOnce()
    expect(addToAllowList.mock.invocationCallOrder[0]).toBeLessThan(issueGrant.mock.invocationCallOrder[0])
  })

  it('points to Change plan when they already hold a licence', () => {
    const live: PublisherLicense = {
      id: 'l1', user: `did:pkh:eip155:1:${A.toLowerCase()}`, kind: 'pro', issuer: 'PUBLISHER_GRANT',
      status: 'ACTIVE', start: null, end: null, environmentId: null, replacedBy: null,
    }
    renderDialog([live])
    fireEvent.change(screen.getByLabelText('Wallet address or DID'), { target: { value: A } })
    expect(screen.getByText(/already holds pro/i)).toBeTruthy()
  })

  it('shows the reducer sentence when the grant is refused as invalid input', async () => {
    issueGrant.mockRejectedValue(new PublisherApiError('INVALID_INPUT', 'pro cannot be granted', 200))
    renderDialog()
    fireEvent.change(screen.getByLabelText('Wallet address or DID'), { target: { value: A } })
    fireEvent.change(screen.getByLabelText('Plan'), { target: { value: 'pro' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Grant licence' })))
    expect(toastError).toHaveBeenCalledWith('pro cannot be granted')
  })

  it('pauses granting with a visible reason and a retry when plans or the allow list failed to load', () => {
    const retry = vi.fn()
    renderDialog([], [], { loadError: true, loadFailed: true, onRetry: retry })
    fireEvent.change(screen.getByLabelText('Wallet address or DID'), { target: { value: A } })
    expect(screen.getByText(/granting is paused/i)).toBeTruthy()
    expect(screen.queryByText(/added to your allow list/i)).toBeNull()
    expect((screen.getByRole('button', { name: 'Grant licence' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(retry).toHaveBeenCalledOnce()
  })
})
