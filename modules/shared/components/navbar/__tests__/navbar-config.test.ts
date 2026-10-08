import { describe, it, expect } from 'vitest'
import { NAVBAR_CONFIGS, PRIVATE_NAV_ITEMS } from '../navbar-config'

describe('navigation', () => {
  it('no longer links the retired Licensing page anywhere', () => {
    for (const list of [PRIVATE_NAV_ITEMS, NAVBAR_CONFIGS['/vetra'].navItems]) {
      expect(list.find((i) => i.label === 'Licensing')).toBeUndefined()
      expect(list.find((i) => i.href === '/user/publisher')).toBeUndefined()
    }
  })
})
