'use client'

import { useRenownAuthAsync } from '@powerhousedao/reactor-browser'
import {
  BadgeCheck,
  Boxes,
  Check,
  Cloud,
  Copy,
  Layers,
  LogIn,
  LogOut,
  Loader2,
  Moon,
  MoreVertical,
  Package,
  Settings,
  Sun,
  User,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useSyncExternalStore, useState } from 'react'
import { CONSOLE_HREF, EARLY_ACCESS_HREF } from '@/modules/landing/lib/links'
import { isAppRoute } from '@/modules/landing/lib/routes'
import { ActiveOrgLabel, OrgSwitcherMenuSection } from '@/modules/orgs/components/org-switcher'
import { useOpenLogin } from '@/modules/shared/components/renown/login-modal-context'
import { useRenownAvatarUrl } from '@/modules/shared/hooks/use-renown-avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar'
import { cn } from '@/modules/shared/lib/utils'
import { useConsoleMenuClass } from '../use-console-menu-class'
import ThemeIconLabel from './toogle-theme-label'

const btnSecondary =
  'bg-accent text-foreground hover:bg-muted inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all cursor-pointer'

function shorten(addr: string | undefined): string {
  if (!addr) return ''
  if (addr.length < 12) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function CopyAddressButton({ address }: { address: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    void navigator.clipboard.writeText(address).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="text-muted-foreground hover:text-foreground ml-1 cursor-pointer transition-colors"
      aria-label="Copy address"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </button>
  )
}

function RenownButton() {
  const consoleMenu = useConsoleMenuClass()
  // Public pages render in a fixed look, so the theme switch only appears in the app.
  const showThemeToggle = isAppRoute(usePathname())
  const auth = useRenownAuthAsync()
  const avatarUrl = useRenownAvatarUrl()
  const openLogin = useOpenLogin()
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

  const toggleTheme = () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  const isDark = mounted && resolvedTheme === 'dark'

  if (auth.state === 'resolving') {
    return (
      <span className={btnSecondary}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading
      </span>
    )
  }
  if (auth.state === 'authenticated') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={cn(btnSecondary, 'max-w-full min-w-0')}>
            <Avatar className="h-5 w-5 shrink-0">
              <AvatarImage src={avatarUrl} alt={auth.displayName ?? 'Account'} />
              <AvatarFallback className="bg-transparent p-0">
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0 truncate">
              {auth.displayName ?? auth.displayAddress ?? 'Account'}
            </span>
            <ActiveOrgLabel />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className={cn('bg-accent border-border/50 z-170 w-56 rounded-lg p-1.5', consoleMenu)}
        >
          <DropdownMenuLabel className="px-3 py-2">
            <div className="flex items-center gap-2.5">
              <Avatar className="h-8 w-8">
                <AvatarImage src={avatarUrl} alt={auth.displayName ?? 'Account'} />
                <AvatarFallback>
                  <User className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="text-sm leading-tight font-semibold">
                  {auth.displayName ?? 'Account'}
                </div>
                <div className="flex items-center">
                  <span className="text-muted-foreground font-mono text-xs">
                    {shorten(auth.address ?? auth.displayAddress)}
                  </span>
                  {(auth.address ?? auth.displayAddress) && (
                    <CopyAddressButton address={auth.address ?? auth.displayAddress ?? ''} />
                  )}
                </div>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-border/50" />
          <OrgSwitcherMenuSection />
          <DropdownMenuItem
            asChild
            className="cursor-pointer rounded-md px-3 py-2 text-sm font-medium"
          >
            <Link href="/user">
              <Boxes className="h-4 w-4" />
              Apps
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            asChild
            className="cursor-pointer rounded-md px-3 py-2 text-sm font-medium"
          >
            <Link href="/user/studio">
              <Layers className="h-4 w-4" />
              Studio
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            asChild
            className="cursor-pointer rounded-md px-3 py-2 text-sm font-medium"
          >
            <Link href="/user/environments">
              <Cloud className="h-4 w-4" />
              Environments
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            asChild
            className="cursor-pointer rounded-md px-3 py-2 text-sm font-medium"
          >
            <Link href="/user/subscriptions">
              <BadgeCheck className="h-4 w-4" />
              Subscriptions
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            asChild
            className="cursor-pointer rounded-md px-3 py-2 text-sm font-medium"
          >
            <Link href="/user/packages">
              <Package className="h-4 w-4" />
              Packages
            </Link>
          </DropdownMenuItem>
          {showThemeToggle && (
            <>
              <DropdownMenuSeparator className="bg-border/50" />
              <DropdownMenuItem
                onClick={toggleTheme}
                className="cursor-pointer rounded-md px-3 py-2 text-sm font-medium"
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                {isDark ? 'Light mode' : 'Dark mode'}
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator className="bg-border/50" />
          <DropdownMenuItem
            asChild
            className="cursor-pointer rounded-md px-3 py-2 text-sm font-medium"
          >
            <Link href="/user/settings">
              <Settings className="h-4 w-4" />
              Profile settings
            </Link>
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
    <button type="button" onClick={openLogin} className={btnSecondary}>
      <LogIn className="h-4 w-4" />
      Log in
    </button>
  )
}

/**
 * The primary header action: signed-in visitors open the console, everyone else
 * is sent to the access request on the Studio page (the console would bounce them).
 */
function useHeaderCta(): { href: string; label: string } | null {
  const auth = useRenownAuthAsync()
  const pathname = usePathname()
  if (auth.state !== 'authenticated') return { href: EARLY_ACCESS_HREF, label: 'Request access' }
  // Already inside the console: the button would point at the current area.
  if (isAppRoute(pathname)) return null
  return { href: CONSOLE_HREF, label: 'Open console' }
}

function NavbarRightSide() {
  const consoleMenu = useConsoleMenuClass()
  const { resolvedTheme, setTheme } = useTheme()
  const cta = useHeaderCta()
  const showThemeToggle = isAppRoute(usePathname())

  const handleThemeToggle = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }

  return (
    <>
      <div className="hidden items-center gap-3 md:flex">
        <RenownButton />
        {cta && (
          <Link
            href={cta.href}
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all hover:-translate-y-px"
          >
            {cta.label}
          </Link>
        )}
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
          <DropdownMenuContent className={cn('z-160 w-56', consoleMenu)} align="end">
            <DropdownMenuItem className="p-0">
              <RenownButton />
            </DropdownMenuItem>
            {cta && (
              <DropdownMenuItem asChild className="cursor-pointer">
                <Link
                  href={cta.href}
                  className="bg-primary text-primary-foreground focus:bg-primary/90 focus:text-primary-foreground mt-1 justify-center font-semibold"
                >
                  {cta.label}
                </Link>
              </DropdownMenuItem>
            )}
            {showThemeToggle && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleThemeToggle} className="cursor-pointer">
                  <ThemeIconLabel theme={resolvedTheme} />
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  )
}

export default NavbarRightSide
