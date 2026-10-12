import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { PUBLIC_NAV_ITEMS } from '../../navbar-config'

vi.mock('@/modules/shared/state/use-prefetch-on-intent', () => ({
  usePrefetchOnIntent: () => ({}),
}))

import NavbarItemMobile from '../navbar-item-mobile'

function openMenu(pathname: string) {
  const { getByRole } = render(<NavbarItemMobile navItems={PUBLIC_NAV_ITEMS} pathname={pathname} />)
  fireEvent.pointerDown(getByRole('button'), { button: 0, ctrlKey: false, pointerType: 'mouse' })
  return document.querySelector('[role="menu"]')
}

describe('NavbarItemMobile', () => {
  it('opens a dark menu over the dark console pages', () => {
    expect(openMenu('/')?.className).toMatch(/\bdark\b/)
  })

  it('keeps the themed menu elsewhere', () => {
    expect(openMenu('/user')?.className).not.toMatch(/\bdark\b/)
  })
})
