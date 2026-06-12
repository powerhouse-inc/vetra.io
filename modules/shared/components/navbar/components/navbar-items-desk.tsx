import { ExternalLink } from 'lucide-react'
import Link from 'next/link'
import React from 'react'
import { cn } from '@/modules/shared/lib/utils'
import type { NavItem } from '../types'

interface NavbarCenterProps {
  navItems: NavItem[]
  pathname: string
  activeItem?: NavItem
}

function NavbarItemsDesk({ navItems, pathname }: NavbarCenterProps) {
  return (
    <nav className="hidden items-center gap-12 px-12 lg:flex">
      {navItems.map((item) => {
        return (
          <Link
            key={item.label}
            href={item.href}
            target={item.isExternal ? '_blank' : '_self'}
            className={cn(
              'text-foreground/70 hover:text-foreground flex items-center gap-1 text-base font-semibold transition-colors',
              !item.isExternal && item.isActive(pathname) && 'text-foreground',
            )}
          >
            {item.label}
            {item.isExternal && <ExternalLink className="h-4 w-4" />}
          </Link>
        )
      })}
    </nav>
  )
}

export default NavbarItemsDesk
