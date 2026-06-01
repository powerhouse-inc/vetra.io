import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { EndpointRow } from '@/modules/cloud/components/endpoint-row'

const baseProps = {
  url: 'https://rupert.demo.vetra.io/x',
  checked: false,
  onCheckedChange: () => {},
}

describe('EndpointRow', () => {
  it('renders graphql with playground link', () => {
    render(<EndpointRow {...baseProps} endpoint={{ id: 'x', type: 'api-graphql', port: '1' }} />)
    const link = screen.getByRole('link', { name: /playground/i })
    expect(link.href).toContain('/graphql')
  })

  it('renders mcp with copy button', () => {
    render(<EndpointRow {...baseProps} endpoint={{ id: 'x', type: 'api-mcp', port: '1' }} />)
    expect(screen.getByRole('button', { name: /copy mcp config/i })).not.toBeNull()
  })

  it('renders website with visit link', () => {
    const props = {
      ...baseProps,
      endpoint: { id: 'x', type: 'website' as const, port: '1' },
    }
    render(<EndpointRow {...props} />)
    const link = screen.getByRole('link', { name: /visit/i })
    expect(link.href).toBe('https://rupert.demo.vetra.io/x')
  })

  it('toggles checked state', () => {
    const onCheckedChange = vi.fn()
    render(
      <EndpointRow
        {...baseProps}
        endpoint={{ id: 'x', type: 'website', port: '1' }}
        onCheckedChange={onCheckedChange}
      />,
    )
    fireEvent.click(screen.getByRole('checkbox'))
    expect(onCheckedChange).toHaveBeenCalledWith(true)
  })
})
