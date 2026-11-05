'use client'

import { ExternalLink, Plus, Server, Ticket, LayoutGrid } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useMyApps, useStandaloneEnvFilter } from '@/modules/apps/hooks/use-apps'
import { useEnvironments, useViewer } from '@/modules/cloud/hooks/use-environment'
import { useActiveOrg } from '@/modules/orgs/hooks/use-orgs'
import { CONSOLE_NAV_SECTIONS } from '@/modules/shared/components/console-sidebar/console-nav'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/modules/shared/components/ui/command'

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

const CommandPaletteContext = createContext<{ open: () => void } | null>(null)

/** Opens the console's ⌘K palette; null outside the console layout. */
export function useCommandPalette() {
  return useContext(CommandPaletteContext)
}

/** Mounts the palette for the console and binds ⌘K / Ctrl+K to toggle it. */
export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((current) => !current)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const value = useMemo(() => ({ open: () => setOpen(true) }), [])

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search the console"
        description="Jump to a page, environment or app, or start something new"
        filter={paletteFilter}
      >
        <CommandInput placeholder="Search pages, environments, apps…" />
        <CommandList>
          <CommandEmpty>Nothing matches that.</CommandEmpty>
          {/* Mounted only while open, so the lists load on first use. */}
          {open && <PaletteResults onDone={() => setOpen(false)} />}
        </CommandList>
      </CommandDialog>
    </CommandPaletteContext.Provider>
  )
}

function PaletteResults({ onDone }: { onDone: () => void }) {
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
        <CommandItem onSelect={() => go('/user/environments/new')}>
          <Plus aria-hidden />
          New environment
        </CommandItem>
        <CommandItem onSelect={() => go('/user/apps/new')}>
          <Plus aria-hidden />
          New app
        </CommandItem>
        <CommandItem onSelect={() => go('/redeem')}>
          <Ticket aria-hidden />
          Redeem an invite code
        </CommandItem>
      </CommandGroup>

      <CommandGroup heading="Pages">
        {CONSOLE_NAV_SECTIONS.flatMap((section) => section.items).map((item) => (
          <CommandItem key={item.href} onSelect={() => go(item.href)}>
            <item.icon aria-hidden />
            {item.label}
          </CommandItem>
        ))}
        <CommandItem
          onSelect={() => {
            onDone()
            window.open(DOCS_URL, '_blank', 'noopener')
          }}
        >
          <ExternalLink aria-hidden />
          Docs
        </CommandItem>
      </CommandGroup>

      {environments.length > 0 && (
        <CommandGroup heading="Environments">
          {environments.map((env) => (
            <CommandItem
              key={env.id}
              // Unique per env (cmdk dedupes by value); ids stay out of the matched text.
              value={`${env.name} ${env.state.genericSubdomain ?? env.id}`}
              onSelect={() => go(`/user/environments/${env.id}`)}
            >
              <Server aria-hidden />
              <span className="truncate">{env.name}</span>
              {env.state.genericSubdomain && (
                <span className="text-muted-foreground ml-auto truncate font-mono text-xs">
                  {env.state.genericSubdomain}
                </span>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
      )}

      {apps && apps.length > 0 && (
        <CommandGroup heading="Apps">
          {apps.map((app) => (
            <CommandItem
              key={app.id}
              value={`${app.name} ${app.slug}`}
              onSelect={() => go(`/user/apps/${app.id}`)}
            >
              <LayoutGrid aria-hidden />
              {app.name}
            </CommandItem>
          ))}
        </CommandGroup>
      )}
    </>
  )
}
