import { describe, expect, it } from 'vitest'
import { LEGACY_REDIRECTS } from '@/modules/shared/config/redirects'

function target(path: string) {
  for (const r of LEGACY_REDIRECTS) {
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

  it('keeps them temporary so the pages can come back', () => {
    expect(LEGACY_REDIRECTS.every((r) => r.permanent === false)).toBe(true)
  })
})
