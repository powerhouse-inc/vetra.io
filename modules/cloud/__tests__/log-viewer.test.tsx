import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { LogViewer } from '@/modules/cloud/components/log-viewer'
import type { LogEntry } from '@/modules/cloud/types'

// Backend returns log entries oldest-first (LokiClient sorts ascending).
const logs: LogEntry[] = [
  { timestamp: 1000, line: 'oldest-line' },
  { timestamp: 2000, line: 'middle-line' },
  { timestamp: 3000, line: 'newest-line' },
]

describe('LogViewer ordering', () => {
  it('renders oldest→newest so the newest line is at the bottom', () => {
    const { container } = render(<LogViewer logs={logs} />)
    const text = container.textContent ?? ''
    // DOM/text order == visual top-to-bottom order.
    expect(text.indexOf('oldest-line')).toBeLessThan(text.indexOf('middle-line'))
    expect(text.indexOf('middle-line')).toBeLessThan(text.indexOf('newest-line'))
  })

  it('does not reverse (newest is last in the DOM, not first)', () => {
    const { container } = render(<LogViewer logs={logs} />)
    const text = container.textContent ?? ''
    expect(text.indexOf('newest-line')).toBeGreaterThan(text.indexOf('oldest-line'))
  })
})

const levelled: LogEntry[] = [
  { timestamp: 1000, line: JSON.stringify({ level: 'info', msg: 'server started' }) },
  { timestamp: 1010, line: JSON.stringify({ level: 'error', msg: 'crm_deals missing' }) },
]

describe('LogViewer filters', () => {
  it('shows only errors when Errors is pressed', () => {
    render(<LogViewer logs={levelled} />)
    fireEvent.click(screen.getByRole('button', { name: 'Errors' }))
    expect(screen.queryByText('server started')).toBeNull()
    expect(screen.getByText('crm_deals missing')).toBeTruthy()
    expect(screen.getByText(/1 of 2/)).toBeTruthy()
  })

  it('searches the lines', () => {
    render(<LogViewer logs={levelled} />)
    fireEvent.change(screen.getByLabelText('Search logs'), { target: { value: 'STARTED' } })
    expect(screen.getByText('server started')).toBeTruthy()
    expect(screen.queryByText('crm_deals missing')).toBeNull()
  })

  it('keeps showing the paused lines while new ones arrive', () => {
    const { rerender } = render(<LogViewer logs={levelled.slice(0, 1)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    rerender(<LogViewer logs={levelled} />)
    expect(screen.queryByText('crm_deals missing')).toBeNull()
    expect(screen.getByText(/paused, 1 new/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }))
    expect(screen.getByText('crm_deals missing')).toBeTruthy()
  })
})
