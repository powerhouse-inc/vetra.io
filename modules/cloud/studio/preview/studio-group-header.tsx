'use client'

import { ArrowUpRight, Boxes, ChevronDown, MoreVertical, ShieldCheck } from 'lucide-react'
import { Button } from '@/modules/shared/components/ui/button'
import { StatusPill } from './status-pill'
import type { MockStudio } from './mock-data'

/**
 * IDEATION ONLY — full-width managed-infra header for a Studio instance.
 *
 * Interactions:
 * - The caret (left) collapses/expands the environments underneath it.
 * - The header itself is a clickable "enter studio" target (stretched link),
 *   lighting up with a green vetra outline on hover.
 * - The gear is a minimized settings control.
 *
 * The caret and gear sit above the stretched link (z-10) so they stay
 * independently clickable without nesting interactive elements.
 */
export function StudioGroupHeader({
  studio,
  collapsed,
  onToggleCollapse,
}: {
  studio: MockStudio
  collapsed: boolean
  onToggleCollapse: () => void
}) {
  const studioUrl = `https://${studio.subdomain}/`

  return (
    <div className="group border-border hover:border-primary bg-muted/40 relative flex items-center gap-3 rounded-xl border px-4 py-4 transition-colors">
      {/* Collapse toggle. */}
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-expanded={!collapsed}
        aria-label={collapsed ? 'Expand environments' : 'Collapse environments'}
        className="text-muted-foreground hover:text-foreground relative z-10 -ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded"
      >
        <ChevronDown
          className={`h-4 w-4 transition-transform ${collapsed ? '-rotate-90' : ''}`}
        />
      </button>

      <div className="bg-background flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border">
        <Boxes className="text-muted-foreground h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {/* Stretched link: clicking anywhere on the header (except the caret /
              gear) enters the studio. */}
          <a
            href={studioUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate text-lg font-semibold after:absolute after:inset-0 after:content-['']"
          >
            {studio.productName} — Studio
          </a>
          <span className="border-border text-muted-foreground inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium">
            <ShieldCheck className="h-3 w-3" aria-hidden />
            Managed
          </span>
          <span className="text-primary ml-1 inline-flex items-center gap-0.5 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100">
            Open studio
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </span>
        </div>
        <p className="text-muted-foreground truncate text-sm">{studio.tagline}</p>
      </div>

      <div className="relative z-10 flex shrink-0 items-center gap-3">
        <StatusPill status={studio.status} />
        {/* Minimized control: an overflow menu, not a prominent Manage button. */}
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground h-8 w-8"
          title="Studio options"
          aria-label="Studio options"
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
