import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { PageHeader } from '../page-header'

describe('PageHeader', () => {
  it('renders the title as the one h1 with the shared size and weight', () => {
    render(<PageHeader title="Your environments" />)
    const h1 = screen.getByRole('heading', { level: 1, name: 'Your environments' })
    expect(h1.className).toContain('text-3xl')
    expect(h1.className).toContain('font-bold')
    expect(screen.getAllByRole('heading')).toHaveLength(1)
  })

  it('shows the description and actions only when given', () => {
    const { rerender } = render(<PageHeader title="Packages" />)
    expect(screen.queryByRole('button')).toBeNull()
    rerender(
      <PageHeader
        title="Packages"
        description="Packages you’ve published."
        actions={<button type="button">New environment</button>}
      />,
    )
    expect(screen.getByText('Packages you’ve published.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'New environment' })).toBeTruthy()
  })

  it('renders no actions slot for a falsy action', () => {
    const { container } = render(<PageHeader title="Profile settings" actions={false} />)
    expect(container.firstElementChild?.children).toHaveLength(1)
  })
})
