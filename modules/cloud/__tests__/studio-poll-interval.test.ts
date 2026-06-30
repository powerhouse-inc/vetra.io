import { describe, it, expect } from 'vitest'
import { studioPollIntervalMs, FAST_STUDIO_POLL_MS } from '@/modules/cloud/studio/studio-readiness'
import type { ProductStatus } from '@/modules/cloud/studio/studio-readiness'

const p = (status: ProductStatus) => ({ status })

describe('studioPollIntervalMs', () => {
  it('polls fast while any product is still booting', () => {
    expect(studioPollIntervalMs([p('ready'), p('booting')])).toBe(FAST_STUDIO_POLL_MS)
    expect(studioPollIntervalMs([p('booting')])).toBe(FAST_STUDIO_POLL_MS)
  })

  it('stops polling (false) once every product is ready — WS drives freshness', () => {
    expect(studioPollIntervalMs([p('ready'), p('ready')])).toBe(false)
  })

  it('does not poll for sleeping products — sleep is a stable resting state', () => {
    expect(studioPollIntervalMs([p('sleeping')])).toBe(false)
    expect(studioPollIntervalMs([p('ready'), p('sleeping')])).toBe(false)
    // …but a booting product alongside a sleeping one still polls.
    expect(studioPollIntervalMs([p('sleeping'), p('booting')])).toBe(FAST_STUDIO_POLL_MS)
  })

  it('stops polling when there are no products (nothing pending)', () => {
    expect(studioPollIntervalMs([])).toBe(false)
    expect(studioPollIntervalMs(undefined)).toBe(false)
  })
})
