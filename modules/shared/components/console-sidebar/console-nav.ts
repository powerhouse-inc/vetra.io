import {
  Container,
  CreditCard,
  LayoutGrid,
  type LucideIcon,
  Server,
  Settings,
  Sparkles,
} from 'lucide-react'
import type { RouteWithDynamicPages } from '@/modules/shared/types/routes'

export type ConsoleNavItem = {
  label: string
  href: RouteWithDynamicPages
  icon: LucideIcon
  isActive: (pathname: string) => boolean
}

export type ConsoleNavSection = { title: string; items: ConsoleNavItem[] }

/**
 * The console's sections: the desktop sidebar renders them grouped, the mobile
 * menu (PRIVATE_NAV_ITEMS) flattens them, so both always list the same pages.
 */
export const CONSOLE_NAV_SECTIONS: ConsoleNavSection[] = [
  {
    title: 'Build',
    items: [
      {
        label: 'Apps',
        href: '/user',
        icon: LayoutGrid,
        isActive: (p) => p === '/user' || p.startsWith('/user/apps'),
      },
      {
        label: 'Studio',
        href: '/user/studio',
        icon: Sparkles,
        isActive: (p) => p.startsWith('/user/studio') || p.startsWith('/user/products'),
      },
    ],
  },
  {
    title: 'Run',
    items: [
      {
        label: 'Environments',
        href: '/user/environments',
        icon: Server,
        isActive: (p) => p.startsWith('/user/environments'),
      },
      {
        label: 'My instances',
        href: '/user/instances',
        icon: Container,
        isActive: (p) => p.startsWith('/user/instances'),
      },
    ],
  },
  {
    title: 'Account',
    items: [
      {
        label: 'Subscriptions',
        href: '/user/subscriptions',
        icon: CreditCard,
        isActive: (p) => p.startsWith('/user/subscriptions'),
      },
      {
        label: 'Settings',
        href: '/user/settings',
        icon: Settings,
        isActive: (p) => p.startsWith('/user/settings'),
      },
    ],
  },
]
