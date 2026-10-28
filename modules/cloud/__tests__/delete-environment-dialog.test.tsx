import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'

const toastError = vi.fn()
const toastSuccess = vi.fn()
vi.mock('sonner', () => ({
  toast: { success: (m: string) => toastSuccess(m), error: (m: string) => toastError(m) },
}))

import { DeleteEnvironmentDialog } from '@/modules/cloud/components/delete-environment-dialog'

function Harness({ onConfirm }: { onConfirm: () => Promise<void> }) {
  const [open, setOpen] = useState(false)
  return (
    <DeleteEnvironmentDialog
      open={open}
      onOpenChange={setOpen}
      displayName="Staging"
      onConfirm={onConfirm}
    >
      <button type="button">Open delete</button>
    </DeleteEnvironmentDialog>
  )
}

describe('DeleteEnvironmentDialog', () => {
  beforeEach(() => {
    cleanup()
    toastError.mockReset()
    toastSuccess.mockReset()
  })

  it('keeps the dialog open with a spinner while deleting, then closes', async () => {
    let resolve!: () => void
    const onConfirm = vi.fn(() => new Promise<void>((r) => (resolve = r)))
    render(<Harness onConfirm={onConfirm} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open delete' }))
    expect(screen.getByText('Delete environment?')).toBeTruthy()

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Delete' })))
    expect(onConfirm).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Deleting…' })).toBeTruthy()

    await act(async () => resolve())
    expect(toastSuccess).toHaveBeenCalledWith('Environment deleted')
    expect(screen.queryByText('Delete environment?')).toBeNull()
  })

  it('stays open and shows friendly copy when the delete fails', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('FORBIDDEN'))
    render(<Harness onConfirm={onConfirm} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open delete' }))
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Delete' })))
    expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/permission/i))
    expect(screen.getByText('Delete environment?')).toBeTruthy()
  })
})
