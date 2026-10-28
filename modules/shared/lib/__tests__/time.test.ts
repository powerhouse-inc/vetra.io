import { describe, expect, it } from 'vitest'

import { formatDate, formatTimestamp, timeAgo } from '@/modules/shared/lib/time'

const now = new Date('2026-10-28T12:00:00Z')

describe('timeAgo', () => {
  it('spells units out', () => {
    expect(timeAgo('2026-10-28T11:57:00Z', now)).toBe('3 minutes ago')
    expect(timeAgo('2026-10-28T10:00:00Z', now)).toBe('2 hours ago')
    expect(timeAgo('2026-10-25T12:00:00Z', now)).toBe('3 days ago')
  })

  it('says "just now" for the last few seconds', () => {
    expect(timeAgo('2026-10-28T11:59:30Z', now)).toBe('just now')
  })

  it('is empty for missing or invalid input', () => {
    expect(timeAgo(null, now)).toBe('')
    expect(timeAgo('not a date', now)).toBe('')
  })
})

describe('absolute formats', () => {
  it('are empty for missing or invalid input', () => {
    expect(formatTimestamp(undefined)).toBe('')
    expect(formatTimestamp('nope')).toBe('')
    expect(formatDate(null)).toBe('')
  })

  it('format valid dates', () => {
    expect(formatTimestamp('2026-10-28T12:00:00Z')).not.toBe('')
    expect(formatDate('2026-10-28T12:00:00Z')).toMatch(/2026/)
  })
})
