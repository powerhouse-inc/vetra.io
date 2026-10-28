import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { PUBLIC_NAV_ITEMS } from '../../navbar-config'

vi.mock('@/modules/shared/state/use-prefetch-on-intent', () => ({
  usePrefetchOnIntent: () => ({}),
}))

import NavbarItemMobile from '../navbar-item-mobile'

describe('NavbarItemMobile', () => {
  it.each([
    ['/', 'Home'],
    ['/studio', 'Studio'],
    ['/cloud', 'Cloud'],
    ['/docs/deploy', 'Docs'],
    ['/redeem', 'Menu'],
    ['/privacy-policy', 'Menu'],
  ])('labels the page picker on %s as %s', (pathname, label) => {
    const { getByRole, unmount } = render(
      <NavbarItemMobile navItems={PUBLIC_NAV_ITEMS} pathname={pathname} />,
    )
    expect(getByRole('button').textContent).toBe(label)
    unmount()
  })
})
