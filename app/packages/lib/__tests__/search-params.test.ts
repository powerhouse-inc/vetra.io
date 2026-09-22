import { describe, expect, it } from 'vitest'

import { packagesShowUrl } from '../search-params'

describe('packagesShowUrl', () => {
  it('sets the show param with no other params', () => {
    expect(packagesShowUrl('all')).toBe('/packages?show=all')
    expect(packagesShowUrl('recommended')).toBe('/packages?show=recommended')
  })

  it('preserves scalar params and swaps the show value', () => {
    expect(packagesShowUrl('all', { search: 'billing', show: 'recommended' })).toBe(
      '/packages?search=billing&show=all',
    )
  })

  it('serializes array params as repeated keys (nuqs format)', () => {
    expect(
      packagesShowUrl('all', {
        categories: ['finance', 'analytics'],
        publisherNames: ['Powerhouse'],
      }),
    ).toBe('/packages?categories=finance&categories=analytics&publisherNames=Powerhouse&show=all')
  })

  it('drops undefined values and ignores an invalid show value in the source', () => {
    expect(packagesShowUrl('recommended', { search: undefined, show: 'bogus' })).toBe(
      '/packages?show=recommended',
    )
  })
})
