import VetraLogoWithText from '@/modules/shared/components/svgs/Vetra-logo-with-text-black.svg'
import VetraIcon from '@/modules/shared/components/svgs/Vetra-200x200.svg'
import { CONSOLE_NAV_SECTIONS } from '@/modules/shared/components/console-sidebar/console-nav'
import type { NavItem, NavbarConfig } from './types'

export const PUBLIC_NAV_ITEMS: NavItem[] = [
  {
    label: 'Studio',
    href: '/studio',
    isActive: (p) => p === '/studio',
  },
  {
    label: 'Cloud',
    href: '/cloud',
    isActive: (p) => p === '/cloud',
  },
  { label: 'Docs', href: 'https://academy.vetra.io/', isExternal: true },
]

/** The console sections, flattened for the mobile menu (the sidebar shows them grouped). */
export const PRIVATE_NAV_ITEMS: NavItem[] = CONSOLE_NAV_SECTIONS.flatMap((section) =>
  section.items.map(({ label, href, isActive }) => ({ label, href, isActive })),
)

export const NAVBAR_CONFIGS: Record<string, NavbarConfig> = {
  '/vetra': {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    isotype: VetraIcon,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    logotype: VetraLogoWithText,
    logoHref: '/',
    navItems: [
      {
        label: 'Apps',
        href: '/user',
        isActive: (currentPath) => currentPath === '/user' || currentPath.startsWith('/user/apps'),
      },
      {
        label: 'Packages',
        href: '/user/packages',
        isActive: (currentPath) => currentPath.includes('/user/packages'),
      },
      { label: 'Academy', href: 'https://academy.vetra.io/', isExternal: true },
      { label: 'Cloud', href: '/cloud', isActive: (currentPath) => currentPath.includes('/cloud') },
    ],
    authComponent: 'loginButton',
  },
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const getNavbarConfig = (_pathname: string): NavbarConfig => {
  return NAVBAR_CONFIGS['/vetra']
}
