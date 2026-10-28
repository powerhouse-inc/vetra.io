import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ResourceSizePicker } from '@/modules/cloud/components/resource-size-picker'

describe('ResourceSizePicker', () => {
  const supported = ['VETRA_AGENT_S', 'VETRA_AGENT_M', 'VETRA_AGENT_L'] as const

  it('renders only supported sizes', () => {
    render(<ResourceSizePicker supported={[...supported]} value={null} onChange={() => {}} />)
    expect(screen.queryByText('S')).not.toBeNull()
    expect(screen.queryByText('M')).not.toBeNull()
    expect(screen.queryByText('L')).not.toBeNull()
    expect(screen.queryByText('XL')).toBeNull()
    expect(screen.queryByText('XXL')).toBeNull()
  })

  it('preserves canonical order regardless of input order', () => {
    render(
      <ResourceSizePicker
        supported={['VETRA_AGENT_L', 'VETRA_AGENT_S', 'VETRA_AGENT_M']}
        value={null}
        onChange={() => {}}
      />,
    )
    const labels = screen.getAllByText(/^(S|M|L)$/).map((el) => el.textContent ?? '')
    expect(labels).toEqual(['S', 'M', 'L'])
  })

  it('calls onChange with selected size', () => {
    const onChange = vi.fn()
    render(<ResourceSizePicker supported={[...supported]} value={null} onChange={onChange} />)
    fireEvent.click(screen.getByLabelText('M'))
    expect(onChange).toHaveBeenCalledWith('VETRA_AGENT_M')
  })
})
