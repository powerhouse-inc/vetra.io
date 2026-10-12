import { describe, expect, it } from 'vitest'
import { isConsoleRoute } from '@/modules/landing/lib/routes'

describe('isConsoleRoute', () => {
  it('matches the three public console pages', () => {
    expect(isConsoleRoute('/')).toBe(true)
    expect(isConsoleRoute('/cloud')).toBe(true)
    expect(isConsoleRoute('/studio')).toBe(true)
  })

  it('leaves the app and nested routes alone', () => {
    expect(isConsoleRoute('/user')).toBe(false)
    expect(isConsoleRoute('/cloud/x')).toBe(false)
    expect(isConsoleRoute('/studio/waking')).toBe(false)
  })
})
