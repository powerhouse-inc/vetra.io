import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

const setKey = vi.fn()
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../hooks/use-publisher-mutations', () => ({
  useSetInviteCodeAnthropicKey: () => ({ mutateAsync: setKey, isPending: false }),
}))

import { SetInviteCodeKeyDialog } from '../components/invite-codes/set-invite-code-key-dialog'

function setup() {
  const onOpenChange = vi.fn()
  render(<SetInviteCodeKeyDialog appId="app-1" code="VIP-2026" open onOpenChange={onOpenChange} />)
  return onOpenChange
}

describe('SetInviteCodeKeyDialog', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('uses a password input and sets the key, then closes', async () => {
    setKey.mockResolvedValue(true)
    const onOpenChange = setup()
    const input = screen.getByLabelText(/claude api key/i) as HTMLInputElement
    expect(input.type).toBe('password')
    fireEvent.change(input, { target: { value: 'sk-ant-secret' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save key/i }))
    })
    expect(setKey).toHaveBeenCalledWith({ code: 'VIP-2026', anthropicKey: 'sk-ant-secret' })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('removes the key by sending null, then closes', async () => {
    setKey.mockResolvedValue(true)
    const onOpenChange = setup()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /remove key/i }))
    })
    expect(setKey).toHaveBeenCalledWith({ code: 'VIP-2026', anthropicKey: null })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('stays open and keeps the dialog when the mutation fails', async () => {
    setKey.mockRejectedValue(new Error('nope'))
    const onOpenChange = setup()
    fireEvent.change(screen.getByLabelText(/claude api key/i), { target: { value: 'sk' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save key/i }))
    })
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })

  it('does not save an empty key', () => {
    setup()
    expect(screen.getByRole('button', { name: /save key/i })).toHaveProperty('disabled', true)
  })
})
