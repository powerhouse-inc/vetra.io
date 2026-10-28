import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { InlineEditableTitle } from '../[project]/tabs/overview'

function startEditing(onSave = vi.fn().mockResolvedValue(undefined)) {
  render(<InlineEditableTitle value="My env" onSave={onSave} />)
  fireEvent.click(screen.getByRole('button', { name: 'Rename environment' }))
  const input = screen.getByRole('textbox', { name: 'Environment name' })
  fireEvent.change(input, { target: { value: 'Renamed' } })
  return { onSave, input }
}

describe('InlineEditableTitle', () => {
  it('cancel discards the edit even though the input blurs first', () => {
    const { onSave, input } = startEditing()
    const cancel = screen.getByRole('button', { name: 'Cancel renaming' })

    // A real click: mousedown (default prevented, so no blur), then a blur
    // towards the button for browsers that still move focus, then the click.
    const mouseDownAllowed = fireEvent.mouseDown(cancel)
    expect(mouseDownAllowed).toBe(false)
    fireEvent.blur(input, { relatedTarget: cancel })
    fireEvent.click(cancel)

    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'My env' })).toBeTruthy()
  })

  it('save button saves the new name', () => {
    const { onSave, input } = startEditing()
    const save = screen.getByRole('button', { name: 'Save name' })
    fireEvent.blur(input, { relatedTarget: save })
    expect(onSave).not.toHaveBeenCalled()
    fireEvent.click(save)
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith('Renamed')
  })

  it('blurring to somewhere else saves', () => {
    const { onSave, input } = startEditing()
    fireEvent.blur(input, { relatedTarget: null })
    expect(onSave).toHaveBeenCalledWith('Renamed')
  })

  it('Escape cancels', () => {
    const { onSave, input } = startEditing()
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'My env' })).toBeTruthy()
  })
})
