import { describe, expect, it } from 'vitest'
import { isConsoleRoute, loggedOutDestination } from '@/modules/landing/lib/routes'

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

describe('loggedOutDestination', () => {
  it('sends logged-out studio visitors to the public Studio page', () => {
    expect(loggedOutDestination('/user/studio')).toBe('/studio')
    expect(loggedOutDestination('/user/studio/abc')).toBe('/studio')
  })

  it('sends every other gated route home', () => {
    expect(loggedOutDestination('/user')).toBe('/')
    expect(loggedOutDestination('/user/environments')).toBe('/')
    expect(loggedOutDestination('/profile')).toBe('/')
  })
})
