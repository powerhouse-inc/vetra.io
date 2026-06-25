import { describe, it, expect } from 'vitest'
import { ROUTE_PREFETCH, hasPrefetch } from '@/shared/state/route-prefetch'

describe('ROUTE_PREFETCH', () => {
  it('covers the authed data routes', () => {
    expect(hasPrefetch('/user/products')).toBe(true)
    expect(hasPrefetch('/user/environments')).toBe(true)
    expect(hasPrefetch('/cloud')).toBe(true)
  })

  it('ignores RSC / unknown routes', () => {
    expect(hasPrefetch('/packages')).toBe(false)
    expect(hasPrefetch('/builders')).toBe(false)
    expect(hasPrefetch('/')).toBe(false)
  })

  it('every entry is a function', () => {
    for (const fn of Object.values(ROUTE_PREFETCH)) {
      expect(typeof fn).toBe('function')
    }
  })
})
