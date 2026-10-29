import { describe, expect, it } from 'vitest'
import { filterLogs, logBuckets, logLevel } from '../lib/log-filter'

const line = (level: string, msg: string) => JSON.stringify({ level, msg })

const logs = [
  { timestamp: 100, line: line('info', 'started') },
  { timestamp: 110, line: line('WARN', 'slow read model') },
  { timestamp: 120, line: line('error', 'relation crm_deals does not exist') },
  { timestamp: 130, line: 'plain text line' },
]

describe('logLevel', () => {
  it('reads the level of JSON lines, lowercased', () => {
    expect(logLevel(line('WARN', 'x'))).toBe('warn')
    expect(logLevel('not json')).toBeNull()
    expect(logLevel(JSON.stringify({ msg: 'no level' }))).toBeNull()
  })
})

describe('filterLogs', () => {
  it('keeps everything under "all"', () => {
    expect(filterLogs(logs, { level: 'all', query: '' })).toHaveLength(4)
  })

  it('shows errors only, or warnings and errors', () => {
    expect(filterLogs(logs, { level: 'error', query: '' }).map((l) => l.timestamp)).toEqual([120])
    expect(filterLogs(logs, { level: 'warn', query: '' }).map((l) => l.timestamp)).toEqual([
      110, 120,
    ])
  })

  it('searches the raw line, ignoring case', () => {
    expect(filterLogs(logs, { level: 'all', query: 'CRM_DEALS' }).map((l) => l.timestamp)).toEqual([
      120,
    ])
    expect(filterLogs(logs, { level: 'all', query: 'plain' })).toHaveLength(1)
  })
})

describe('logBuckets', () => {
  it('spreads lines over equal time buckets and counts errors', () => {
    const buckets = logBuckets(logs, 3)
    expect(buckets).toHaveLength(3)
    expect(buckets.reduce((sum, b) => sum + b.total, 0)).toBe(4)
    expect(buckets.reduce((sum, b) => sum + b.errors, 0)).toBe(1)
    expect(buckets[2].total).toBeGreaterThan(0)
  })

  it('uses one bucket when every line has the same time, and none without lines', () => {
    expect(logBuckets([{ timestamp: 5, line: 'a' }], 30)).toEqual([
      { start: 5, total: 1, errors: 0 },
    ])
    expect(logBuckets([], 30)).toEqual([])
  })
})
