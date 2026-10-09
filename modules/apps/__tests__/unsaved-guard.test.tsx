import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import React from 'react'
import { useUnsavedChangesGuard } from '../components/profile/use-unsaved-guard'

function Harness({ dirty }: { dirty: boolean }) {
  useUnsavedChangesGuard(dirty)
  return (
    <div>
      <a href="/elsewhere">away</a>
      <a href="#top">hash</a>
      <a href="https://x.example" target="_blank">
        ext
      </a>
      <div role="tablist">
        <button role="tab" aria-selected="true">
          current
        </button>
        <button role="tab" aria-selected="false">
          other
        </button>
      </div>
    </div>
  )
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('useUnsavedChangesGuard', () => {
  it('does nothing while clean', () => {
    const confirm = vi.spyOn(window, 'confirm')
    const { getByText } = render(<Harness dirty={false} />)
    fireEvent.click(getByText('away'))
    expect(confirm).not.toHaveBeenCalled()
  })

  it('vetoes an in-app link unless confirmed, ignoring hash and new-tab links', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { getByText } = render(<Harness dirty />)
    expect(fireEvent.click(getByText('away'))).toBe(false)
    expect(confirm).toHaveBeenCalledTimes(1)
    fireEvent.click(getByText('hash'))
    fireEvent.click(getByText('ext'))
    expect(confirm).toHaveBeenCalledTimes(1)
    confirm.mockReturnValue(true)
    expect(fireEvent.click(getByText('away'))).toBe(true)
  })

  it('vetoes switching tabs by mouse and keyboard, but not the current tab', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { getByText } = render(<Harness dirty />)
    fireEvent.mouseDown(getByText('current'))
    expect(confirm).not.toHaveBeenCalled()
    expect(fireEvent.mouseDown(getByText('other'))).toBe(false)
    expect(fireEvent.keyDown(getByText('current'), { key: 'ArrowRight' })).toBe(false)
    expect(fireEvent.keyDown(getByText('other'), { key: 'Enter' })).toBe(false)
    expect(confirm).toHaveBeenCalledTimes(3)
    fireEvent.keyDown(getByText('current'), { key: 'a' })
    expect(confirm).toHaveBeenCalledTimes(3)
  })
})
