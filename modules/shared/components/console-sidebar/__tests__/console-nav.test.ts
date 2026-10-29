import { describe, expect, it } from 'vitest'
import { PRIVATE_NAV_ITEMS } from '@/modules/shared/components/navbar/navbar-config'
import { CONSOLE_NAV_SECTIONS } from '../console-nav'

const items = CONSOLE_NAV_SECTIONS.flatMap((section) => section.items)

describe('console navigation', () => {
  it('gives the mobile menu the same pages as the sidebar', () => {
    expect(PRIVATE_NAV_ITEMS.map((i) => i.href)).toEqual(items.map((i) => i.href))
  })

  it('marks exactly one page active for each console route', () => {
    const routes = [
      '/user',
      '/user/apps/abc',
      '/user/studio',
      '/user/products',
      '/user/packages',
      '/user/environments/env-1',
      '/user/subscriptions',
      '/user/settings',
    ]
    for (const route of routes) {
      expect(items.filter((i) => i.isActive(route)).map((i) => i.label)).toHaveLength(1)
    }
  })

  it('does not mark Apps active on other console pages', () => {
    const apps = items.find((i) => i.label === 'Apps')
    expect(apps?.isActive('/user/environments')).toBe(false)
  })
})
