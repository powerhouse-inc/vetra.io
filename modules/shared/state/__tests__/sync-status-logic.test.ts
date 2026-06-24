import { describe, it, expect } from 'vitest'
import {
  deriveSyncStatus,
  shouldRefreshAfterAway,
  isCoordinatedKey,
  COORDINATED_KEY_PREFIXES,
  AWAY_THRESHOLD_MS,
} from '@/shared/state/sync-status-logic'

describe('deriveSyncStatus', () => {
  it('reports offline first, regardless of fetching', () => {
    expect(deriveSyncStatus({ activeCount: 3, online: false, hasError: false })).toBe('offline')
  })

  it('reports refreshing while fetches are active and online', () => {
    expect(deriveSyncStatus({ activeCount: 1, online: true, hasError: true })).toBe('refreshing')
  })

  it('reports error when idle, online, and something failed', () => {
    expect(deriveSyncStatus({ activeCount: 0, online: true, hasError: true })).toBe('error')
  })

  it('reports up-to-date when idle, online, no error', () => {
    expect(deriveSyncStatus({ activeCount: 0, online: true, hasError: false })).toBe('up-to-date')
  })
})

describe('shouldRefreshAfterAway', () => {
  it('refreshes when away at least the threshold', () => {
    expect(shouldRefreshAfterAway(1_000, 1_000 + AWAY_THRESHOLD_MS, AWAY_THRESHOLD_MS)).toBe(true)
  })

  it('does not refresh for a quick tab flick under the threshold', () => {
    expect(shouldRefreshAfterAway(1_000, 1_500, AWAY_THRESHOLD_MS)).toBe(false)
  })

  it('does not refresh when never hidden', () => {
    expect(shouldRefreshAfterAway(null, 999_999, AWAY_THRESHOLD_MS)).toBe(false)
  })
})

describe('isCoordinatedKey', () => {
  it('matches a coordinated prefix', () => {
    expect(isCoordinatedKey(['my-teams', '0xabc'])).toBe(true)
    expect(isCoordinatedKey(['environments', 'MINE', null])).toBe(true)
  })

  it('rejects non-coordinated keys', () => {
    expect(isCoordinatedKey(['tenant-secrets', 'env1'])).toBe(false)
    expect(isCoordinatedKey([])).toBe(false)
  })

  it('exposes the expected prefixes', () => {
    expect(COORDINATED_KEY_PREFIXES.map((k) => k[0])).toEqual([
      'builder-account',
      'my-teams',
      'environments',
      'viewer',
    ])
  })
})
