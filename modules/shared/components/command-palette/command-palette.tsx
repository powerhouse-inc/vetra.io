'use client'

import {
  ExternalLink,
  LayoutGrid,
  type LucideIcon,
  Plus,
  SearchX,
  Server,
  Ticket,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useSyncExternalStore, type ReactNode } from 'react'
import { useMyApps, useStandaloneEnvFilter } from '@/modules/apps/hooks/use-apps'
import { useEnvironments, useViewer } from '@/modules/cloud/hooks/use-environment'
import { useActiveOrg } from '@/modules/orgs/hooks/use-orgs'
import { CONSOLE_NAV_SECTIONS } from '@/modules/shared/components/console-sidebar/console-nav'
import { CommandEmpty, CommandGroup, CommandItem } from '@/modules/shared/components/ui/command'
import { cn } from '@/modules/shared/lib/utils'

const DOCS_URL = 'https://academy.vetra.io/'

/**
 * Every typed word must appear in the item's value (name, subdomain, slug). cmdk's default
 * fuzzy score matched scattered letters, so "achra" also found unrelated apps.
 */
export function paletteFilter(value: string, search: string, keywords?: string[]): number {
  const haystack = [value, ...(keywords ?? [])].join(' ').toLowerCase()
  const words = search.toLowerCase().split(/\s+/).filter(Boolean)
  return words.every((w) => haystack.includes(w)) ? 1 : 0
}

const noopSubscribe = () => () => {}
const isMac = () => /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent)

/** "⌘K" on Apple devices, "Ctrl K" elsewhere; the server render assumes a Mac. */
export function useSearchShortcutLabel() {
  return useSyncExternalStore(
    noopSubscribe,
    () => (isMac() ? '⌘K' : 'Ctrl K'),
    () => '⌘K',
  )
}

/** Shared styling for the cmdk list: mono group headings, roomy items, a quiet selection. */
export const paletteListClassName = cn(
  '[&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5',
  '[&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-normal [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:uppercase',
)

function PaletteItem({
  icon: Icon,
  label,
  meta,
  value,
  onSelect,
}: {
  icon: LucideIcon
  label: ReactNode
  meta?: ReactNode
  value?: string
  onSelect: () => void
}) {
  return (
    <CommandItem
      value={value}
      onSelect={onSelect}
      className="group/item data-[selected=true]:bg-console-raised data-[selected=true]:text-foreground gap-3 rounded-md px-2 py-2"
    >
      <span className="border-console-line bg-console-surface group-data-[selected=true]/item:border-console-signal/40 group-data-[selected=true]/item:text-console-signal text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-md border transition-colors">
        <Icon aria-hidden className="size-3.5 text-current" />
      </span>
      <span className="min-w-0 truncate">{label}</span>
      {meta && (
        <span className="text-muted-foreground ml-auto max-w-[45%] truncate font-mono text-[11px]">
          {meta}
        </span>
      )}
    </CommandItem>
  )
}

/** Shown when the query matches nothing. */
export function PaletteEmpty() {
  return (
    <CommandEmpty className="text-muted-foreground flex flex-col items-center gap-2 px-4 py-10 text-center text-sm">
      <SearchX aria-hidden className="size-5 opacity-60" />
      Nothing matches that. Try an app, environment or page name.
    </CommandEmpty>
  )
}

/** The keyboard legend under the results (hidden on touch screens by the caller). */
export function PaletteFooter({ className }: { className?: string }) {
  const keyClass =
    'border-console-line bg-console-surface text-foreground/80 rounded border px-1 py-px font-mono text-[10px]'
  return (
    <div
      aria-hidden
      className={cn(
        'border-console-line text-muted-foreground flex items-center gap-4 border-t px-3 py-2 text-[11px]',
        className,
      )}
    >
      <span className="flex items-center gap-1.5">
        <kbd className={keyClass}>↑</kbd>
        <kbd className={keyClass}>↓</kbd>
        navigate
      </span>
      <span className="flex items-center gap-1.5">
        <kbd className={keyClass}>↵</kbd>
        open
      </span>
      <span className="flex items-center gap-1.5">
        <kbd className={keyClass}>esc</kbd>
        close
      </span>
    </div>
  )
}

/**
 * The console search results: Start actions, pages, docs, standalone environments and apps.
 * Render it inside a cmdk `Command` (with `filter={paletteFilter}`) and mount it only while the
 * search is open, so the lists load on first use. `onDone` runs before every navigation.
 */
export function PaletteResults({ onDone }: { onDone: () => void }) {
  const router = useRouter()
  const { viewer } = useViewer()
  const { orgId } = useActiveOrg()
  const { environments: allEnvironments } = useEnvironments('MINE', viewer?.address ?? null, {
    orgId,
  })
  const { data: apps } = useMyApps()
  // An app's own environments are reached through the app, as on the Environments page.
  const { isStandalone } = useStandaloneEnvFilter()
  const environments = allEnvironments.filter(isStandalone)

  const go = (href: string) => {
    onDone()
    router.push(href)
  }

  return (
    <>
      <CommandGroup heading="Start">
        <PaletteItem
          icon={Plus}
          label="New environment"
          onSelect={() => go('/user/environments/new')}
        />
        <PaletteItem icon={Plus} label="New app" onSelect={() => go('/user/apps/new')} />
        <PaletteItem icon={Ticket} label="Redeem an invite code" onSelect={() => go('/redeem')} />
      </CommandGroup>

      <CommandGroup heading="Pages">
        {CONSOLE_NAV_SECTIONS.flatMap((section) => section.items).map((item) => (
          <PaletteItem
            key={item.href}
            icon={item.icon}
            label={item.label}
            onSelect={() => go(item.href)}
          />
        ))}
        <PaletteItem
          icon={ExternalLink}
          label="Docs"
          meta="academy.vetra.io"
          value="Docs"
          onSelect={() => {
            onDone()
            window.open(DOCS_URL, '_blank', 'noopener')
          }}
        />
      </CommandGroup>

      {environments.length > 0 && (
        <CommandGroup heading="Environments">
          {environments.map((env) => (
            <PaletteItem
              key={env.id}
              icon={Server}
              // Unique per env (cmdk dedupes by value); ids stay out of the matched text.
              value={`${env.name} ${env.state.genericSubdomain ?? env.id}`}
              label={env.name}
              meta={env.state.genericSubdomain}
              onSelect={() => go(`/user/environments/${env.id}`)}
            />
          ))}
        </CommandGroup>
      )}

      {apps && apps.length > 0 && (
        <CommandGroup heading="Apps">
          {apps.map((app) => (
            <PaletteItem
              key={app.id}
              icon={LayoutGrid}
              value={`${app.name} ${app.slug}`}
              label={app.name}
              onSelect={() => go(`/user/apps/${app.id}`)}
            />
          ))}
        </CommandGroup>
      )}
    </>
  )
}
