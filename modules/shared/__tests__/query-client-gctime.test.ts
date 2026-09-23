import { describe, expect, it } from 'vitest'
import { CACHE_MAX_AGE, gcTimeFor } from '@/modules/shared/providers/query-client/query-client'

describe('gcTimeFor', () => {
  // A finite gcTime on the server makes React Query's scheduleGc() call
  // setTimeout during SSR. A Node timer captures the AsyncLocalStorage context
  // it was created in, so that one pending timer pins the whole render -- the
  // react-dom/server Request, the HTML and the RSC payload -- for its full
  // duration. Measured before the fix: exactly 1.00 retained SSR Request per
  // HTTP request, ~0.32 MiB each, OOM every ~2h. See TanStack/query#11320.
  it('schedules no GC timer on the server', () => {
    expect(gcTimeFor(true)).toBe(Infinity)
    expect(Number.isFinite(gcTimeFor(true))).toBe(false)
  })

  it('keeps the long browser cache lifetime', () => {
    expect(gcTimeFor(false)).toBe(CACHE_MAX_AGE)
    expect(CACHE_MAX_AGE).toBe(24 * 60 * 60 * 1000)
  })
})
