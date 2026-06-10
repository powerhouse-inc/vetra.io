import VetraLogoWithText from '@/modules/shared/components/svgs/vetra-logo-with-vetra.svg'
import VetraIcon from '@/modules/shared/components/svgs/vetra-logo.svg'
import type { NavbarConfig } from './types'

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
        isActive: (currentPath) =>
          currentPath.includes('/user') || currentPath.includes('/studio'),
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
