import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

const toastError = vi.fn()
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: (m: string) => toastError(m) } }))

import { ConfigRow } from '@/modules/cloud/components/config-row'

function renderRow(onDelete: () => Promise<void>) {
  render(
    <table>
      <tbody>
        <ConfigRow
          entry={{ name: 'API_KEY', type: 'secret', required: true }}
          currentValue={null}
          isSet
          onSave={vi.fn()}
          onDelete={onDelete}
        />
      </tbody>
    </table>,
  )
}

describe('ConfigRow delete', () => {
  beforeEach(() => {
    cleanup()
    toastError.mockReset()
  })

  it('asks for confirmation before deleting', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined)
    renderRow(onDelete)
    fireEvent.click(screen.getByRole('button', { name: 'Delete API_KEY' }))
    expect(onDelete).not.toHaveBeenCalled()
    expect(screen.getByText('Delete secret API_KEY?')).toBeTruthy()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Delete' })))
    expect(onDelete).toHaveBeenCalledOnce()
  })

  it('cancel keeps the value', () => {
    const onDelete = vi.fn().mockResolvedValue(undefined)
    renderRow(onDelete)
    fireEvent.click(screen.getByRole('button', { name: 'Delete API_KEY' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('shows friendly copy instead of a raw backend code on failure', async () => {
    renderRow(
      vi.fn().mockRejectedValue(new Error('GraphQL request failed: 503 Service Unavailable')),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Delete API_KEY' }))
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Delete' })))
    expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/having trouble/i))
  })
})
