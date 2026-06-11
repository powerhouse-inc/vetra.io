import VetraLogoWithText from '@/modules/shared/components/svgs/vetra-logo-with-vetra.svg'
import VetraIcon from '@/modules/shared/components/svgs/vetra-logo.svg'
import type { NavItem, NavbarConfig } from './types'

export const PUBLIC_NAV_ITEMS: NavItem[] = [
  {
    label: 'Packages',
    href: '/packages',
    isActive: (p) => p.includes('/packages'),
  },
  {
    label: 'Builders',
    href: '/builders',
    isActive: (p) => p.includes('/builders'),
  },
  { label: 'Academy', href: 'https://academy.vetra.io/', isExternal: true },
  {
    label: 'Cloud',
    href: '/cloud',
    isActive: (p) => p.includes('/cloud'),
  },
]

export const PRIVATE_NAV_ITEMS: NavItem[] = [
  {
    label: 'Products',
    href: '/products',
    isActive: (p) => p.includes('/products'),
  },
  {
    label: 'Environments',
    href: '/cloud',
    isActive: (p) => p.includes('/cloud'),
  },
  {
    label: 'Packages',
    href: '/packages',
    isActive: (p) => p.includes('/packages'),
  },
]

export const NAVBAR_CONFIGS: Record<string, NavbarConfig> = {
  '/vetra': {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    isotype: VetraIcon,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    logotype: VetraLogoWithText,
    logoHref: '/',
    navItems: [
      {
        label: 'Products',
        href: '/user',
        isActive: (currentPath) => currentPath.includes('/user') || currentPath.includes('/studio'),
      },
      {
        label: 'Packages',
        href: '/packages',
        isActive: (currentPath) => currentPath.includes('/packages'),
      },
      {
        label: 'Builders',
        href: '/builders',
        isActive: (currentPath) => currentPath.includes('/builders'),
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
