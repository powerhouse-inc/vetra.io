import { describe, expect, it } from 'vitest'
import { LEGACY_REDIRECTS } from '@/modules/shared/config/redirects'

function target(path: string) {
  for (const r of LEGACY_REDIRECTS) {
    if ('has' in r) continue
    const prefix = r.source.replace(/\/:path\*$/, '')
    if (r.source === path || (r.source.endsWith('/:path*') && path.startsWith(prefix + '/'))) {
      return r.destination
    }
  }
  return undefined
}

describe('legacy redirects', () => {
  it('sends the retired Packages pages to Cloud, where packages are installed', () => {
    expect(target('/packages')).toBe('/cloud')
    expect(target('/packages/@acme/invoices')).toBe('/cloud')
  })

  it('sends Builders and team pages home', () => {
    expect(target('/builders')).toBe('/')
    expect(target('/builders/powerhouse')).toBe('/')
  })

  it('sends the empty Contributors and Finances placeholders home', () => {
    expect(target('/contributors')).toBe('/')
    expect(target('/finances')).toBe('/')
  })

  it('sends the old /profile hub to the console settings, its Packages tab to Packages', () => {
    expect(target('/profile')).toBe('/user/settings')
    const packages = LEGACY_REDIRECTS.find(
      (r) => r.source === '/profile' && 'has' in r && r.has?.[0]?.value === 'packages',
    )
    expect(packages?.destination).toBe('/user/packages')
    // The query-matched rule must come first, or the catch-all wins.
    expect(LEGACY_REDIRECTS.indexOf(packages!)).toBeLessThan(
      LEGACY_REDIRECTS.findIndex((r) => r.source === '/profile' && !('has' in r)),
    )
  })

  it('keeps them temporary so the pages can come back', () => {
    expect(LEGACY_REDIRECTS.every((r) => r.permanent === false)).toBe(true)
  })
})
