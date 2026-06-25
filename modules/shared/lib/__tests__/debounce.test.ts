import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createDebouncer } from '@/shared/lib/debounce'

describe('createDebouncer', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('fires once after the window for a burst of calls', () => {
    const fn = vi.fn()
    const d = createDebouncer(fn, 750)
    d.call()
    d.call()
    d.call()
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(750)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('cancel prevents a pending fire', () => {
    const fn = vi.fn()
    const d = createDebouncer(fn, 750)
    d.call()
    d.cancel()
    vi.advanceTimersByTime(1000)
    expect(fn).not.toHaveBeenCalled()
  })
})
