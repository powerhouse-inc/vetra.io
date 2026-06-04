import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
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
