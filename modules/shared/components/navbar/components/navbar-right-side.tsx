'use client'

import { useRenownAuth } from '@powerhousedao/reactor-browser'
import {
  ExternalLink,
  LogIn,
  LogOut,
  Loader2,
  MoreVertical,
  Package,
  User,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import { ThemeToggle } from '../../theme-toggle'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu'
import ThemeIconLabel from './toogle-theme-label'

const btnSecondary =
  'bg-accent text-foreground hover:bg-muted inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all cursor-pointer'

function shorten(addr: string | undefined): string {
  if (!addr) return ''
  if (addr.length < 12) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function RenownButton() {
  const auth = useRenownAuth()

  if (auth.status === 'loading' || auth.status === 'checking') {
    return (
      <span className={btnSecondary}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading
      </span>
    )
  }
  if (auth.status === 'authorized') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={btnSecondary}>
            <User className="h-4 w-4" />
            {auth.displayName ?? auth.displayAddress ?? 'Account'}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="bg-accent border-border/50 z-170 w-56 rounded-lg p-1.5"
        >
          <DropdownMenuLabel className="px-3 py-2">
            <div className="text-sm leading-tight font-semibold">
              {auth.displayName ?? 'Account'}
            </div>
            <div className="text-muted-foreground font-mono text-xs">
              {shorten(auth.address ?? auth.displayAddress)}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-border/50" />
          <DropdownMenuItem
            asChild
            className="cursor-pointer rounded-md px-3 py-2 text-sm font-medium"
          >
            <Link href="/profile?tab=teams">
              <Users className="h-4 w-4" />
              My profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            asChild
            className="cursor-pointer rounded-md px-3 py-2 text-sm font-medium"
          >
            <Link href="/profile?tab=packages">
              <Package className="h-4 w-4" />
              My packages
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-border/50" />
          <DropdownMenuItem
            onClick={auth.openProfile}
            className="cursor-pointer rounded-md px-3 py-2 text-sm font-medium"
          >
            <User className="h-4 w-4" />
            Renown account
            <ExternalLink className="ml-auto h-3 w-3" />
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-border/50" />
          <DropdownMenuItem
            onClick={() => void auth.logout()}
            className="text-destructive focus:text-destructive cursor-pointer rounded-md px-3 py-2 text-sm font-medium"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }
  return (
    <button type="button" onClick={auth.login} className={btnSecondary}>
      <LogIn className="h-4 w-4" />
      Log in
    </button>
  )
}

function NavbarRightSide() {
  const { theme, setTheme } = useTheme()

  const handleThemeToggle = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  return (
    <>
      <div className="hidden items-center gap-3 md:flex">
        <ThemeToggle />
        <RenownButton />
        <Link
          href="/packages"
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all hover:-translate-y-px"
        >
          Try Our Beta
        </Link>
      </div>

      <div className="flex items-center md:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="text-foreground rounded-md focus:ring-2 focus:ring-offset-2 focus:outline-none"
            >
              <MoreVertical className="h-6 w-6" />
              <span className="sr-only">Open menu</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="z-160 w-56" align="end">
            <DropdownMenuItem className="p-0">
              <RenownButton />
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleThemeToggle} className="cursor-pointer">
              <ThemeIconLabel theme={theme} />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  )
}

export default NavbarRightSide
