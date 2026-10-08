import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

const add = vi.fn()
const remove = vi.fn()
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../hooks/use-publisher-mutations', () => ({
  useAddToAllowList: () => ({ mutateAsync: add, isPending: false }),
  useRemoveFromAllowList: () => ({ mutateAsync: remove, isPending: false }),
}))

import { AllowListCard } from '../components/holders/allow-list-card'

const A = '0xAbCdEf0123456789aBcDeF0123456789AbCdEf01'

describe('AllowListCard', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('adds a valid address and clears the field', async () => {
    add.mockResolvedValue(true)
    render(<AllowListCard appId="app-1" entries={[]} />)
    const input = screen.getByLabelText('Add to allow list') as HTMLInputElement
    fireEvent.change(input, { target: { value: ` ${A} ` } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Add' })))
    expect(add).toHaveBeenCalledWith({ user: A })
    expect(input.value).toBe('')
  })

  it('keeps Add disabled for anything the server would refuse', () => {
    render(<AllowListCard appId="app-1" entries={[]} />)
    fireEvent.change(screen.getByLabelText('Add to allow list'), { target: { value: 'hello' } })
    expect((screen.getByRole('button', { name: 'Add' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('removes an entry', async () => {
    remove.mockResolvedValue(true)
    render(<AllowListCard appId="app-1" entries={[{ user: A, addedAt: '2026-10-01T00:00:00Z' }]} />)
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: `Remove ${A} from the allow list` })),
    )
    expect(remove).toHaveBeenCalledWith({ user: A })
  })
})

describe('AllowListCard loading', () => {
  beforeEach(() => {
    cleanup()
  })

  it('offers a retry instead of claiming the list is empty when it failed to load', () => {
    const retry = vi.fn()
    render(
      <AllowListCard appId="app-1" entries={undefined} error={new Error('boom')} onRetry={retry} />,
    )
    expect(screen.queryByText('Nobody on the list yet.')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(retry).toHaveBeenCalledOnce()
  })
})
