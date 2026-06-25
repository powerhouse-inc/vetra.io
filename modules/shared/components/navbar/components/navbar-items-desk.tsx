import { ExternalLink } from 'lucide-react'
import Link from 'next/link'
import React from 'react'
import { cn } from '@/modules/shared/lib/utils'
import { usePrefetchOnIntent } from '@/modules/shared/state/use-prefetch-on-intent'
import type { NavItem } from '../types'

interface NavbarCenterProps {
  navItems: NavItem[]
  pathname: string
  activeItem?: NavItem
}

// One component per item so the prefetch hook obeys the rules of hooks
// (can't call a hook inside a .map callback). Intent handlers warm the route's
// data on hover/focus so the page paints instantly on click.
function DeskNavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const intent = usePrefetchOnIntent(item.href)
  return (
    <Link
      href={item.href}
      target={item.isExternal ? '_blank' : '_self'}
      {...intent}
      className={cn(
        'text-foreground/70 hover:text-foreground flex items-center gap-1 text-base font-semibold transition-colors',
        !item.isExternal && item.isActive(pathname) && 'text-foreground',
      )}
    >
      {item.label}
      {item.isExternal && <ExternalLink className="h-4 w-4" />}
    </Link>
  )
}

function NavbarItemsDesk({ navItems, pathname }: NavbarCenterProps) {
  return (
    <nav className="hidden items-center gap-12 px-12 lg:flex">
      {navItems.map((item) => (
        <DeskNavLink key={item.label} item={item} pathname={pathname} />
      ))}
    </nav>
  )
}

export default NavbarItemsDesk
