import { fireEvent, render, screen } from '@testing-library/react'
import { Bot } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'

import { EmptyState, ErrorState } from '..'

describe('EmptyState', () => {
  it('renders title, description, action and CLI hint', () => {
    const { container } = render(
      <EmptyState
        icon={Bot}
        title="No agents yet"
        description="Install your first agent."
        action={<button type="button">Add agent</button>}
        cliHint="ph install"
      />,
    )
    expect(screen.getByText('No agents yet')).toBeTruthy()
    expect(screen.getByText('Install your first agent.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add agent' })).toBeTruthy()
    expect(screen.getByText('ph install').tagName).toBe('CODE')
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('renders only the title when nothing else is given', () => {
    const { container } = render(<EmptyState title="Nothing here" action={false} />)
    expect(screen.getByText('Nothing here')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
    expect(container.querySelector('code')).toBeNull()
    expect(container.querySelector('svg')).toBeNull()
  })
})

describe('ErrorState', () => {
  it('renders a destructive alert with title and message', () => {
    render(<ErrorState title="Could not load your apps" message="Check your connection." />)
    const alert = screen.getByRole('alert')
    expect(alert.className).toContain('text-destructive')
    expect(screen.getByText('Could not load your apps')).toBeTruthy()
    expect(screen.getByText('Check your connection.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
  })

  it('calls onRetry and disables the button while retrying', () => {
    const onRetry = vi.fn()
    const { rerender } = render(
      <ErrorState title="Failed" message="Try again." onRetry={onRetry} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)

    rerender(<ErrorState title="Failed" message="Try again." onRetry={onRetry} retrying />)
    const button = screen.getByRole('button', { name: 'Retry' })
    expect(button.hasAttribute('disabled')).toBe(true)
    expect(button.querySelector('svg')?.getAttribute('class')).toContain('animate-spin')
  })

  it('shows the request id as selectable text', () => {
    render(<ErrorState title="Failed" message="Try again." requestId="req_123" />)
    const id = screen.getByText('Request id: req_123')
    expect(id.className).toContain('select-all')
  })
})
