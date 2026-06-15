import VetraLogoWithText from '@/modules/shared/components/svgs/Vetra-logo-with-text-black.svg'
import VetraIcon from '@/modules/shared/components/svgs/Vetra-200x200.svg'
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
    href: '/user/products',
    isActive: (p) => p.includes('/user/products'),
  },
  {
    label: 'Environments',
    href: '/user/environments',
    isActive: (p) => p.includes('/user/environments'),
  },
  {
    label: 'Packages',
    href: '/user/packages',
    isActive: (p) => p.includes('/user/packages'),
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
        href: '/user/products',
        isActive: (currentPath) => currentPath.includes('/user/products'),
      },
      {
        label: 'Packages',
        href: '/user/packages',
        isActive: (currentPath) => currentPath.includes('/user/packages'),
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
