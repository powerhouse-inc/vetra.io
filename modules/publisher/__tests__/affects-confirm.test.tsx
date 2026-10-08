import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { affectsCopy, useAffectsConfirm } from '../components/templates/affects-confirm'

function Harness({ count, run }: { count: number; run: () => Promise<unknown> }) {
  const { guard, dialog } = useAffectsConfirm(count)
  return (
    <>
      <button onClick={() => guard('Save template changes?', run)}>save</button>
      {dialog}
    </>
  )
}

describe('useAffectsConfirm', () => {
  beforeEach(() => {
    cleanup()
  })

  it('words the count', () => {
    expect(affectsCopy(1)).toBe('This change re-applies to 1 running environment.')
    expect(affectsCopy(3)).toBe('This change re-applies to 3 running environments.')
  })

  it('runs straight away when no environment uses the template', async () => {
    const run = vi.fn().mockResolvedValue(true)
    render(<Harness count={0} run={run} />)
    await act(async () => fireEvent.click(screen.getByText('save')))
    expect(run).toHaveBeenCalledOnce()
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('asks first, and Keep editing sends nothing', async () => {
    const run = vi.fn().mockResolvedValue(true)
    render(<Harness count={3} run={run} />)
    await act(async () => fireEvent.click(screen.getByText('save')))
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    expect(screen.getByText(/re-applies to 3 running environments/)).toBeTruthy()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Keep editing' })))
    expect(run).not.toHaveBeenCalled()
  })

  it('runs once after confirming', async () => {
    const run = vi.fn().mockResolvedValue(true)
    render(<Harness count={2} run={run} />)
    await act(async () => fireEvent.click(screen.getByText('save')))
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Apply to 2 environments' })))
    expect(run).toHaveBeenCalledOnce()
  })
})
