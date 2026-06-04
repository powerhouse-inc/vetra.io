import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clientIp, rateLimit } from '@/modules/invites/lib/rate-limit'

describe('rateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  // The limiter's bucket map is module-level state, so each test uses a unique
  // key to stay isolated from the others.

  it('allows up to the limit, then blocks', () => {
    for (let i = 0; i < 3; i++) {
      expect(rateLimit('basic', 3, 1000).allowed).toBe(true)
    }
    const blocked = rateLimit('basic', 3, 1000)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSec).toBeGreaterThan(0)
  })

  it('resets after the window elapses', () => {
    expect(rateLimit('reset', 1, 1000).allowed).toBe(true)
    expect(rateLimit('reset', 1, 1000).allowed).toBe(false)
    vi.advanceTimersByTime(1001)
    expect(rateLimit('reset', 1, 1000).allowed).toBe(true)
  })

  it('tracks keys independently', () => {
    expect(rateLimit('key-a', 1, 1000).allowed).toBe(true)
    expect(rateLimit('key-a', 1, 1000).allowed).toBe(false)
    expect(rateLimit('key-b', 1, 1000).allowed).toBe(true)
  })

  it('reports retryAfter in whole seconds, rounded up', () => {
    expect(rateLimit('retry', 1, 5000).allowed).toBe(true)
    const blocked = rateLimit('retry', 1, 5000)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSec).toBe(5)
  })
})

describe('clientIp', () => {
  const withHeaders = (headers: Record<string, string>) =>
    new Request('http://localhost', { headers })

  it('uses the first x-forwarded-for entry', () => {
    expect(clientIp(withHeaders({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }))).toBe('1.2.3.4')
  })

  it('falls back to x-real-ip', () => {
    expect(clientIp(withHeaders({ 'x-real-ip': '9.9.9.9' }))).toBe('9.9.9.9')
  })

  it('returns "unknown" when no ip headers are present', () => {
    expect(clientIp(withHeaders({}))).toBe('unknown')
  })
})
