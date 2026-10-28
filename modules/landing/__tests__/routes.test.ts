import { describe, expect, it } from 'vitest'
import {
  isAppRoute,
  isConsoleRoute,
  isGatedPath,
  loggedOutDestination,
  loginRedirectPath,
  safeNextPath,
} from '@/modules/landing/lib/routes'

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

describe('isGatedPath', () => {
  it('matches the user and profile areas, with or without a query', () => {
    expect(isGatedPath('/user')).toBe(true)
    expect(isGatedPath('/user/environments?x=1')).toBe(true)
    expect(isGatedPath('/profile')).toBe(true)
    expect(isGatedPath('/profile/teams/abc#top')).toBe(true)
  })

  it('leaves public pages alone', () => {
    expect(isGatedPath('/')).toBe(false)
    expect(isGatedPath('/users')).toBe(false)
    expect(isGatedPath('/studio')).toBe(false)
    expect(isGatedPath('/profiles')).toBe(false)
  })
})

describe('safeNextPath', () => {
  it('accepts same-origin relative paths with query and hash', () => {
    expect(safeNextPath('/user')).toBe('/user')
    expect(safeNextPath('/user/environments')).toBe('/user/environments')
    expect(safeNextPath('/user/apps/new?step=2#top')).toBe('/user/apps/new?step=2#top')
  })

  it('rejects empty and non-string values', () => {
    expect(safeNextPath(null)).toBeNull()
    expect(safeNextPath(undefined)).toBeNull()
    expect(safeNextPath('')).toBeNull()
  })

  it('rejects absolute, scheme and bare relative URLs', () => {
    expect(safeNextPath('https://evil.com')).toBeNull()
    expect(safeNextPath('http://evil.com/user')).toBeNull()
    expect(safeNextPath('javascript:alert(1)')).toBeNull()
    expect(safeNextPath('data:text/html,hi')).toBeNull()
    expect(safeNextPath('user')).toBeNull()
  })

  it('rejects protocol-relative and backslash tricks', () => {
    expect(safeNextPath('//evil.com')).toBeNull()
    expect(safeNextPath('//evil.com/user')).toBeNull()
    expect(safeNextPath('/\\evil.com')).toBeNull()
    expect(safeNextPath('\\\\evil.com')).toBeNull()
    expect(safeNextPath('/user\\..\\evil')).toBeNull()
  })

  it('rejects control characters browsers strip into //host', () => {
    expect(safeNextPath('/\t/evil.com')).toBeNull()
    expect(safeNextPath('/\n/evil.com')).toBeNull()
    expect(safeNextPath('/\r/evil.com')).toBeNull()
  })

  it('rejects dot segments that collapse into //host', () => {
    expect(safeNextPath('/user/..//evil.com')).toBeNull()
    expect(safeNextPath('/a/../..//evil.com/x')).toBeNull()
  })

  it('normalises harmless dot segments', () => {
    expect(safeNextPath('/user/apps/../environments')).toBe('/user/environments')
  })

  it('rejects overly long values', () => {
    expect(safeNextPath(`/${'a'.repeat(5000)}`)).toBeNull()
  })
})

describe('loginRedirectPath', () => {
  it('sends a gated route home with the login flag and the original path', () => {
    expect(loginRedirectPath('/user/environments')).toBe('/?login=1&next=%2Fuser%2Fenvironments')
    expect(loginRedirectPath('/profile')).toBe('/?login=1&next=%2Fprofile')
  })

  it('keeps the original query string in next', () => {
    expect(loginRedirectPath('/user/environments/abc', '?addPackage=x&version=2')).toBe(
      '/?login=1&next=%2Fuser%2Fenvironments%2Fabc%3FaddPackage%3Dx%26version%3D2',
    )
  })

  it('sends studio routes to the Studio page', () => {
    expect(loginRedirectPath('/user/studio')).toBe('/studio?login=1&next=%2Fuser%2Fstudio')
  })

  it('drops an unsafe path instead of forwarding it', () => {
    expect(loginRedirectPath('//evil.com')).toBe('/?login=1')
  })
})

describe('isAppRoute', () => {
  it('matches the console and profile routes', () => {
    for (const p of ['/user', '/user/environments', '/profile', '/profile/create-team']) {
      expect(isAppRoute(p)).toBe(true)
    }
  })

  it('leaves the public pages alone', () => {
    for (const p of [
      '/',
      '/cloud',
      '/studio',
      '/docs/deploy',
      '/redeem',
      '/privacy-policy',
      '/users',
    ]) {
      expect(isAppRoute(p)).toBe(false)
    }
  })
})
