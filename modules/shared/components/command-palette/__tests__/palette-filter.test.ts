import { describe, expect, it } from 'vitest'
import { paletteFilter } from '../command-palette'

describe('paletteFilter', () => {
  it('matches words contained in the name or subdomain', () => {
    expect(paletteFilter('Sektar fair-bull-b6t7wwqr', 'sek')).toBe(1)
    expect(paletteFilter('Sektar fair-bull-b6t7wwqr', 'sektar fair')).toBe(1)
    expect(paletteFilter('achra achra', 'achra')).toBe(1)
  })

  it('does not match scattered letters', () => {
    expect(paletteFilter('DAO Treasury dao-treasury', 'sek')).toBe(0)
    expect(paletteFilter('dtbau-package dtbau-package', 'achra')).toBe(0)
  })
})
