import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useLastPresent } from '../hooks/use-last-present'

describe('useLastPresent', () => {
  it('keeps the last value after it goes away, and follows a new one', () => {
    const a = { name: 'A' }
    const b = { name: 'B' }
    const { result, rerender } = renderHook(({ v }) => useLastPresent(v), {
      initialProps: { v: null as { name: string } | null },
    })
    expect(result.current).toBeNull()
    rerender({ v: a })
    expect(result.current).toBe(a)
    rerender({ v: null })
    expect(result.current).toBe(a)
    rerender({ v: b })
    expect(result.current).toBe(b)
  })
})
