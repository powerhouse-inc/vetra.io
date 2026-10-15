import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

const setBudget = vi.fn()
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../hooks/use-publisher-mutations', () => ({
  useSetInviteCodeLlmBudget: () => ({ mutateAsync: setBudget, isPending: false }),
}))

import { SetInviteCodeBudgetDialog } from '../components/invite-codes/set-invite-code-budget-dialog'

function setup(current: number | null = null) {
  const onOpenChange = vi.fn()
  render(
    <SetInviteCodeBudgetDialog
      appId="app-1"
      code="VIP-2026"
      current={current}
      open
      onOpenChange={onOpenChange}
    />,
  )
  return onOpenChange
}

describe('SetInviteCodeBudgetDialog', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('prefills the current budget, saves a new one in USD, then closes', async () => {
    setBudget.mockResolvedValue(true)
    const onOpenChange = setup(20)
    const input = screen.getByLabelText(/monthly llm budget/i) as HTMLInputElement
    expect(input.value).toBe('20')
    fireEvent.change(input, { target: { value: '35.50' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save budget/i }))
    })
    expect(setBudget).toHaveBeenCalledWith({ code: 'VIP-2026', llmBudgetUsd: 35.5 })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('goes back to the plan default by sending null', async () => {
    setBudget.mockResolvedValue(true)
    setup(20)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /use plan default/i }))
    })
    expect(setBudget).toHaveBeenCalledWith({ code: 'VIP-2026', llmBudgetUsd: null })
  })

  it('refuses a malformed or over-cap amount without sending', async () => {
    setup()
    const input = screen.getByLabelText(/monthly llm budget/i)
    for (const bad of ['-1', 'abc', '10000.01', '1.234']) {
      fireEvent.change(input, { target: { value: bad } })
      expect(
        (screen.getByRole('button', { name: /save budget/i }) as HTMLButtonElement).disabled,
      ).toBe(true)
    }
    expect(setBudget).not.toHaveBeenCalled()
  })
})
