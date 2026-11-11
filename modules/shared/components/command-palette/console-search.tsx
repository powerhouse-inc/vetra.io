'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Command as CommandPrimitive } from 'cmdk'
import { Search, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Command, CommandList } from '@/modules/shared/components/ui/command'
import { cn } from '@/modules/shared/lib/utils'
import {
  PaletteEmpty,
  PaletteFooter,
  PaletteResults,
  paletteFilter,
  paletteListClassName,
  useSearchShortcutLabel,
} from './command-palette'

const LABEL = 'Search the console'
/** Tailwind's `lg`: the top-bar input shows from here, the icon + sheet below it. */
const DESKTOP_QUERY = '(min-width: 1024px)'

function isDesktop() {
  // No matchMedia (old test DOMs): assume the desktop input is the one on screen.
  return typeof window.matchMedia !== 'function' || window.matchMedia(DESKTOP_QUERY).matches
}

/**
 * cmdk hard-codes `aria-expanded="true"` on its combobox input. Keep it honest for the
 * dropdown, which is closed most of the time (React leaves the attribute alone afterwards,
 * since the prop it renders never changes).
 */
function useAriaExpanded(ref: React.RefObject<HTMLInputElement | null>, expanded: boolean) {
  useEffect(() => {
    ref.current?.setAttribute('aria-expanded', String(expanded))
  }, [ref, expanded])
}

/** Desktop (lg+): a real input in the top bar with the results in a dropdown anchored under it. */
function SearchBox({ inputRef }: { inputRef: React.RefObject<HTMLInputElement | null> }) {
  const shortcut = useSearchShortcutLabel()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  useAriaExpanded(inputRef, open)

  // Click outside closes; Tab away is handled by the blur below.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const done = () => {
    setOpen(false)
    setQuery('')
    inputRef.current?.blur()
  }

  return (
    <div
      ref={rootRef}
      className="relative hidden w-full max-w-md lg:block"
      onBlur={(event) => {
        // Focus left the search entirely (Tab, or a click elsewhere): close without trapping.
        if (!rootRef.current?.contains(event.relatedTarget as Node | null)) setOpen(false)
      }}
    >
      <Command
        label={LABEL}
        filter={paletteFilter}
        className="overflow-visible rounded-none bg-transparent"
      >
        <div
          className={cn(
            'group border-console-line bg-console-surface/70 flex h-9 items-center gap-2 rounded-lg border px-3 transition-[border-color,box-shadow,background-color] duration-200',
            'hover:border-console-line-strong',
            'focus-within:border-console-signal/50 focus-within:bg-console-surface focus-within:shadow-[0_0_0_3px_rgb(59_227_138/0.12),0_0_24px_-4px_rgb(59_227_138/0.25)]',
          )}
          onMouseDown={(event) => {
            // Clicking the padding or icon still lands in the input.
            if (event.target !== inputRef.current) {
              event.preventDefault()
              inputRef.current?.focus()
            }
            setOpen(true)
          }}
        >
          <Search
            aria-hidden
            className="text-muted-foreground group-focus-within:text-console-signal size-4 shrink-0 transition-colors"
          />
          <CommandPrimitive.Input
            ref={inputRef}
            value={query}
            onValueChange={(value) => {
              setQuery(value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                done()
              } else if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
                setOpen(true)
              }
            }}
            placeholder="Search…"
            className="placeholder:text-muted-foreground h-full w-full min-w-0 bg-transparent text-sm outline-none"
          />
          <kbd
            aria-hidden
            className="border-console-line text-muted-foreground shrink-0 rounded border px-1.5 font-mono text-[11px] transition-opacity group-focus-within:opacity-0"
          >
            {shortcut}
          </kbd>
        </div>

        {open && (
          <div
            // Keep focus in the input while clicking results, so the click selects instead of blurring.
            onMouseDown={(event) => event.preventDefault()}
            className="border-console-line bg-console-bg/95 animate-in fade-in-0 slide-in-from-top-1 zoom-in-[0.98] absolute inset-x-0 top-full z-170 mt-2 overflow-hidden rounded-xl border shadow-[0_24px_48px_-12px_rgb(0_0_0/0.6)] backdrop-blur-xl duration-150 motion-reduce:animate-none"
          >
            <CommandList className={cn('max-h-[min(420px,60vh)] p-1.5', paletteListClassName)}>
              <PaletteEmpty />
              {/* Mounted only while open, so the lists load on first use. */}
              <PaletteResults onDone={done} />
            </CommandList>
            <PaletteFooter />
          </div>
        )}
      </Command>
    </div>
  )
}

/** Below lg: the sheet's contents, mounted only while it is open (so the query resets). */
function SheetSearch({ onDone }: { onDone: () => void }) {
  const [query, setQuery] = useState('')
  return (
    <Command label={LABEL} filter={paletteFilter} className="rounded-none bg-transparent">
      <div className="border-console-line flex h-16 shrink-0 items-center gap-3 border-b px-4">
        <Search aria-hidden className="text-console-signal size-5 shrink-0" />
        <CommandPrimitive.Input
          autoFocus
          value={query}
          onValueChange={setQuery}
          placeholder="Search pages, environments, apps…"
          className="placeholder:text-muted-foreground h-full w-full min-w-0 bg-transparent text-base outline-none"
        />
        <DialogPrimitive.Close
          aria-label="Close search"
          className="text-muted-foreground hover:text-foreground hover:bg-console-raised focus-visible:ring-console-signal/50 -mr-2 flex size-10 shrink-0 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-2"
        >
          <X aria-hidden className="size-5" />
        </DialogPrimitive.Close>
      </div>
      <CommandList className={cn('max-h-none flex-1 px-2 pb-6', paletteListClassName)}>
        <PaletteEmpty />
        <PaletteResults onDone={onDone} />
      </CommandList>
    </Command>
  )
}

/**
 * The console's search, for the top bar: an input with a dropdown on desktop, an icon that
 * opens a full-screen sheet on smaller screens. ⌘K / Ctrl+K focuses whichever is on screen.
 * Render it only on signed-in console routes.
 */
export function ConsoleSearch() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const openSearch = useCallback(() => {
    if (isDesktop()) {
      inputRef.current?.focus()
      inputRef.current?.select()
    } else {
      setSheetOpen(true)
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        openSearch()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [openSearch])

  return (
    <>
      <SearchBox inputRef={inputRef} />
      <DialogPrimitive.Root open={sheetOpen} onOpenChange={setSheetOpen}>
        <DialogPrimitive.Trigger
          aria-label={LABEL}
          className="text-muted-foreground hover:text-foreground hover:bg-console-raised focus-visible:ring-console-signal/50 flex size-9 items-center justify-center rounded-lg transition-colors outline-none focus-visible:ring-2 lg:hidden"
        >
          <Search aria-hidden className="size-5" />
        </DialogPrimitive.Trigger>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="bg-console-bg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-2 fixed inset-0 z-200 flex flex-col duration-150 motion-reduce:animate-none"
          >
            <DialogPrimitive.Title className="sr-only">{LABEL}</DialogPrimitive.Title>
            <SheetSearch onDone={() => setSheetOpen(false)} />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  )
}
