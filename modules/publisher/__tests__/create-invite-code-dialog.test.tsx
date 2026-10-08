import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import type { PublisherTerm } from '../types'

const create = vi.fn()
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../hooks/use-publisher-mutations', () => ({
  useCreateInviteCode: () => ({ mutateAsync: create, isPending: false }),
}))
vi.mock(
  '@/modules/shared/components/ui/select',
  () => import('@/modules/shared/test/native-select'),
)

import { CreateInviteCodeDialog } from '../components/invite-codes/create-invite-code-dialog'

const plans: PublisherTerm[] = [
  {
    id: 't',
    kind: 'conf',
    label: 'Conference',
    templateId: 'x',
    validityDays: 30,
    issuers: ['INVITE_CODE'],
    status: 'ACTIVE',
    activeLicenses: 0,
  },
]

describe('CreateInviteCodeDialog', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('keeps a mixed-case code with dashes and underscores intact in the shared link', async () => {
    create.mockResolvedValue({
      code: 'LFC_2026-vip',
      kind: 'conf',
      label: null,
      active: true,
      expiresAt: null,
      maxUses: null,
      redemptions: 0,
      hasAnthropicKey: false,
      createdAt: '2026-10-08T00:00:00Z',
    })
    render(<CreateInviteCodeDialog appId="app-1" plans={plans} open onOpenChange={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Custom code (optional)'), {
      target: { value: 'LFC_2026-vip' },
    })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Create code' })))
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ code: 'LFC_2026-vip' }))
    expect(screen.getByText(`${window.location.origin}/redeem/LFC_2026-vip`)).toBeTruthy()
  })

  it('sends the Claude key once and never shows it again', async () => {
    create.mockResolvedValue({
      code: 'K-1234',
      kind: 'conf',
      label: null,
      active: true,
      expiresAt: null,
      maxUses: null,
      redemptions: 0,
      hasAnthropicKey: true,
      createdAt: '2026-10-08T00:00:00Z',
    })
    render(<CreateInviteCodeDialog appId="app-1" plans={plans} open onOpenChange={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Claude API key (optional)'), {
      target: { value: 'sk-ant-secret' },
    })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Create code' })))
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ anthropicKey: 'sk-ant-secret' }))
    expect(document.body.innerHTML).not.toContain('sk-ant-secret')
    expect(screen.getByText(/includes a claude key/i)).toBeTruthy()
  })

  it('keeps the form and explains when the create fails', async () => {
    create.mockRejectedValue(new Error('boom'))
    render(<CreateInviteCodeDialog appId="app-1" plans={plans} open onOpenChange={vi.fn()} />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Create code' })))
    expect(screen.queryByText('Your code is ready')).toBeNull()
  })

  it('creates a code and then shows its link to share', async () => {
    create.mockResolvedValue({
      code: 'VIP-1',
      kind: 'conf',
      label: null,
      active: true,
      expiresAt: null,
      maxUses: 10,
      redemptions: 0,
      hasAnthropicKey: false,
      createdAt: '2026-10-08T00:00:00Z',
    })
    render(<CreateInviteCodeDialog appId="app-1" plans={plans} open onOpenChange={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Plan'), { target: { value: 'conf' } })
    fireEvent.change(screen.getByLabelText('Custom code (optional)'), {
      target: { value: 'VIP-1' },
    })
    fireEvent.change(screen.getByLabelText('Maximum uses'), { target: { value: '10' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Create code' })))
    expect(create).toHaveBeenCalledWith({
      kind: 'conf',
      label: null,
      maxUses: 10,
      expiresAt: null,
      code: 'VIP-1',
    })
    expect(screen.getByText('VIP-1')).toBeTruthy()
    expect(screen.getByText(/\/redeem\/VIP-1$/)).toBeTruthy()
  })

  it('never shows the Claude key back after typing it', () => {
    render(<CreateInviteCodeDialog appId="app-1" plans={plans} open onOpenChange={vi.fn()} />)
    expect((screen.getByLabelText('Claude API key (optional)') as HTMLInputElement).type).toBe(
      'password',
    )
  })
})
