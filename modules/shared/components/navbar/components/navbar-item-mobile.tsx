import { ChevronDown } from 'lucide-react'
import Link from 'next/link'
import React, { useMemo } from 'react'
import { cn } from '@/modules/shared/lib/utils'
import { usePrefetchOnIntent } from '@/modules/shared/state/use-prefetch-on-intent'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu'
import type { NavItem } from '../types'

interface NavbarItemMobileProps {
  navItems: NavItem[]
  pathname: string
}

// One component per item so the prefetch hook obeys the rules of hooks.
function MobileNavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const intent = usePrefetchOnIntent(item.href)
  return (
    <DropdownMenuItem asChild className="p-2">
      <Link
        href={item.href}
        {...intent}
        className={cn(
          'block w-full rounded-sm p-3 text-sm leading-none no-underline transition-colors outline-none select-none',
          !item.isExternal && item.isActive(pathname)
            ? 'text-primary hover:bg-accent hover:!text-primary font-semibold'
            : 'text-foreground hover:bg-accent hover:!text-foreground/50',
        )}
      >
        {item.label}
      </Link>
    </DropdownMenuItem>
  )
}

function NavbarItemMobile({ navItems, pathname }: NavbarItemMobileProps) {
  const triggerLabel = useMemo(() => {
    const item = navItems.find((item) => !item.isExternal && item?.isActive?.(pathname))
    return item ? item.label : 'Home'
  }, [navItems, pathname])

  return (
    <div className="flex items-center lg:hidden">
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            'group border-border text-secondary-foreground flex w-37.5 items-center justify-between rounded-lg border px-3 py-2 text-sm',
            // focus
            'focus:visible:ring-0 focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:outline-none',
          )}
        >
          {triggerLabel}
          <ChevronDown className="relative top-0.25 ml-1 h-3 w-3 transition duration-200 group-data-[state=open]:rotate-180" />
        </DropdownMenuTrigger>

        <DropdownMenuContent className="z-170 w-50 p-2">
          <ul className="flex flex-col">
            <li>
              {navItems.map((item) => (
                <MobileNavLink key={item.label} item={item} pathname={pathname} />
              ))}
            </li>
          </ul>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export default NavbarItemMobile
