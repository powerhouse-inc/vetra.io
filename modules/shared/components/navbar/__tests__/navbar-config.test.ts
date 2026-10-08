import { describe, it, expect } from 'vitest'
import { NAVBAR_CONFIGS, PRIVATE_NAV_ITEMS } from '../navbar-config'

describe('navigation', () => {
  it('no longer links the retired Licensing page anywhere', () => {
    for (const list of [PRIVATE_NAV_ITEMS, NAVBAR_CONFIGS['/vetra'].navItems]) {
      expect(list.find((i) => i.label === 'Licensing')).toBeUndefined()
      expect(list.find((i) => i.href === '/user/publisher')).toBeUndefined()
    }
  })

  it('links Subscriptions for logged-in users, right after Environments', () => {
    const labels = PRIVATE_NAV_ITEMS.map((i) => i.label)
    expect(labels.indexOf('Subscriptions')).toBe(labels.indexOf('Environments') + 1)
    const item = PRIVATE_NAV_ITEMS.find((i) => i.label === 'Subscriptions')
    expect(item?.href).toBe('/user/subscriptions')
    expect(
      item && 'isActive' in item && item.isActive ? item.isActive('/user/subscriptions') : false,
    ).toBe(true)
  })
})
