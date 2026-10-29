'use client'

import { ExternalLink, Search } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSyncExternalStore } from 'react'
import { useEnvironmentsInMotion } from '@/modules/cloud/hooks/use-environment-activity'
import { useCommandPalette } from '@/modules/shared/components/command-palette/command-palette'
import { StatusDot } from '@/modules/shared/components/status'
import { cn } from '@/modules/shared/lib/utils'
import { usePrefetchOnIntent } from '@/modules/shared/state/use-prefetch-on-intent'
import { CONSOLE_NAV_SECTIONS, type ConsoleNavItem } from './console-nav'

const DOCS_URL = 'https://academy.vetra.io/'

const noopSubscribe = () => () => {}
const isMac = () => /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent)

function SidebarLink({ item, active }: { item: ConsoleNavItem; active: boolean }) {
  const intent = usePrefetchOnIntent(item.href)
  return (
    <Link
      href={item.href}
      {...intent}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
        active
          ? 'bg-secondary text-foreground font-medium'
          : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
      )}
    >
      <item.icon className="h-4 w-4 shrink-0" aria-hidden />
      {item.label}
    </Link>
  )
}

/** Environments deploying, syncing or terminating right now; renders nothing when all is still. */
function SidebarActivity() {
  const inMotion = useEnvironmentsInMotion()
  if (inMotion.length === 0) return null
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground px-3 pb-1 font-mono text-[11px] tracking-wider uppercase">
        Activity
      </p>
      {inMotion.map((env) => (
        <Link
          key={env.id}
          href={`/user/environments/${env.id}`}
          className="text-muted-foreground hover:bg-secondary/60 hover:text-foreground flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors"
        >
          <StatusDot meta={env.meta} />
          <span className="text-foreground min-w-0 truncate">{env.name}</span>
          <span className="ml-auto shrink-0 font-mono text-[11px]">{env.meta.label}</span>
        </Link>
      ))}
    </div>
  )
}

/**
 * Left navigation for the signed-in console (desktop). Sits under the fixed 64px
 * navbar and stays put while the page scrolls; phones use the navbar's menu.
 */
export function ConsoleSidebar() {
  const pathname = usePathname()
  const palette = useCommandPalette()
  // Server render assumes a Mac; the client corrects it after hydration.
  const shortcut = useSyncExternalStore(
    noopSubscribe,
    () => (isMac() ? '⌘K' : 'Ctrl K'),
    () => '⌘K',
  )

  return (
    <aside
      aria-label="Console"
      className="border-border sticky top-16 mt-16 hidden h-[calc(100vh-4rem)] w-56 shrink-0 flex-col border-r px-3 py-6 lg:flex"
    >
      <nav className="flex flex-col gap-6">
        {CONSOLE_NAV_SECTIONS.map((section) => (
          <div key={section.title} className="space-y-1">
            <p className="text-muted-foreground px-3 pb-1 font-mono text-[11px] tracking-wider uppercase">
              {section.title}
            </p>
            {section.items.map((item) => (
              <SidebarLink key={item.href} item={item} active={item.isActive(pathname)} />
            ))}
          </div>
        ))}
      </nav>
      <div className="mt-auto space-y-4">
        <SidebarActivity />
        <div className="space-y-1">
          {palette && (
            <button
              type="button"
              onClick={palette.open}
              className="text-muted-foreground hover:bg-secondary/60 hover:text-foreground flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors"
            >
              <Search className="h-4 w-4 shrink-0" aria-hidden />
              Search
              <kbd className="border-border ml-auto rounded border px-1.5 font-mono text-[11px]">
                {shortcut}
              </kbd>
            </button>
          )}
          <a
            href={DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:bg-secondary/60 hover:text-foreground flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors"
          >
            <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
            Docs
          </a>
        </div>
      </div>
    </aside>
  )
}
