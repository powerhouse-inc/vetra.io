import { describe, it, expect } from 'vitest'
import {
  studioPollIntervalMs,
  FAST_STUDIO_POLL_MS,
  SLOW_STUDIO_POLL_MS,
} from '@/modules/cloud/studio/studio-readiness'
import type { ProductStatus } from '@/modules/cloud/studio/studio-readiness'

const p = (status: ProductStatus) => ({ status })

describe('studioPollIntervalMs', () => {
  it('polls fast while any product is still booting', () => {
    expect(studioPollIntervalMs([p('ready'), p('booting')])).toBe(FAST_STUDIO_POLL_MS)
    expect(studioPollIntervalMs([p('booting')])).toBe(FAST_STUDIO_POLL_MS)
  })

  it('relaxes to the slow interval once every product is ready', () => {
    expect(studioPollIntervalMs([p('ready'), p('ready')])).toBe(SLOW_STUDIO_POLL_MS)
  })

  it('uses the slow interval when there are no products (nothing pending)', () => {
    expect(studioPollIntervalMs([])).toBe(SLOW_STUDIO_POLL_MS)
    expect(studioPollIntervalMs(undefined)).toBe(SLOW_STUDIO_POLL_MS)
  })

  it('fast interval is meaningfully tighter than slow', () => {
    expect(FAST_STUDIO_POLL_MS).toBeLessThan(SLOW_STUDIO_POLL_MS)
  })
})
