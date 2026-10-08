import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import React from 'react'
import type { PublisherInviteCode, PublisherTerm } from '../types'

let codes: PublisherInviteCode[] = []
let terms: PublisherTerm[] = []
const setActive = vi.fn()
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
let codesQuery: { isPending?: boolean; error?: Error | null } = {}
let termsQuery: { isPending?: boolean; error?: Error | null } = {}
const refetchCodes = vi.fn()
const refetchTerms = vi.fn()
vi.mock('../hooks/use-publisher', () => ({
  usePublisherInviteCodes: () => ({
    data: codesQuery.error || codesQuery.isPending ? undefined : codes,
    isPending: false,
    error: null,
    refetch: refetchCodes,
    ...codesQuery,
  }),
  usePublisherTerms: () => ({
    data: termsQuery.error || termsQuery.isPending ? undefined : terms,
    isPending: false,
    error: null,
    refetch: refetchTerms,
    ...termsQuery,
  }),
}))
vi.mock('../hooks/use-publisher-mutations', () => ({
  useCreateInviteCode: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSetInviteCodeActive: () => ({ mutateAsync: setActive, isPending: false }),
}))

import { InviteCodesTab } from '../components/invite-codes/invite-codes-tab'

const code = (over: Partial<PublisherInviteCode> = {}): PublisherInviteCode => ({
  code: 'LFC_2026-vip',
  kind: 'conf',
  label: 'Speakers',
  active: true,
  expiresAt: null,
  maxUses: 50,
  redemptions: 12,
  hasAnthropicKey: true,
  createdAt: '2026-10-01T00:00:00Z',
  ...over,
})

describe('InviteCodesTab', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
    codesQuery = {}
    termsQuery = {}
    terms = [
      {
        id: 't',
        kind: 'conf',
        label: 'Conference',
        templateId: 'x',
        validityDays: 30,
        issuers: ['INVITE_CODE'],
        status: 'ACTIVE',
        activeLicenses: 12,
      },
    ]
  })

  it('sends a publisher without code-ready plans to Plans first', () => {
    codes = []
    terms = []
    render(<InviteCodesTab appId="app-1" />)
    expect(screen.getByText('No invite codes yet')).toBeTruthy()
    expect(screen.getByRole('link', { name: /set up a plan first/i }).getAttribute('href')).toBe(
      '?tab=plans',
    )
  })

  it('shows usage, status, the plan and a copyable redeem link', () => {
    codes = [code()]
    render(<InviteCodesTab appId="app-1" />)
    const row = screen.getByTestId('code-LFC_2026-vip')
    expect(within(row).getByText('12 of 50')).toBeTruthy()
    expect(within(row).getByText('Conference')).toBeTruthy()
    expect(within(row).getByText('Active')).toBeTruthy()
    expect(within(row).getByLabelText('Includes a Claude key')).toBeTruthy()
    expect(within(row).getByRole('button', { name: /copy redeem link/i })).toBeTruthy()
  })

  it('pauses a code', async () => {
    codes = [code()]
    setActive.mockResolvedValue(true)
    render(<InviteCodesTab appId="app-1" />)
    await act(async () =>
      fireEvent.click(
        within(screen.getByTestId('code-LFC_2026-vip')).getByRole('switch', {
          name: /accepting redemptions/i,
        }),
      ),
    )
    expect(setActive).toHaveBeenCalledWith({ code: 'LFC_2026-vip', active: false })
  })

  it('shows retry, not an empty list, when codes fail to load', () => {
    codesQuery = { error: new Error('down') }
    render(<InviteCodesTab appId="app-1" />)
    expect(screen.queryByText('No invite codes yet')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /try again|retry/i }))
    expect(refetchCodes).toHaveBeenCalled()
  })

  it('does not claim there are no plans when plans fail to load', () => {
    codes = []
    termsQuery = { error: new Error('down') }
    render(<InviteCodesTab appId="app-1" />)
    expect(screen.queryByRole('link', { name: /set up a plan first/i })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /plans did not load/i }))
    expect(refetchTerms).toHaveBeenCalled()
  })

  it('copies a link that keeps the code unchanged', () => {
    codes = [code({ code: 'Team_A-1' })]
    render(<InviteCodesTab appId="app-1" />)
    expect(screen.getByRole('button', { name: 'Copy redeem link for Team_A-1' })).toBeTruthy()
  })
})
