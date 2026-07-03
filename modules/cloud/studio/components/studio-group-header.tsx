'use client'

import {
  ArrowUpRight,
  Boxes,
  ChevronDown,
  Loader2,
  Moon,
  Settings,
  ShieldCheck,
} from 'lucide-react'
import Link from 'next/link'
import { useDid } from '@powerhousedao/reactor-browser'
import { Button } from '@/modules/shared/components/ui/button'
import { buildStudioEmbedUrl } from '../studio-embed-url'
import { useProductBrand } from '../use-product-brand'
import type { ProductStatus } from '../studio-readiness'
import type { StudioProduct } from '../use-studio-products'

/** Status pill for the studio header. Maps the product's readiness to the
 * running / deploying / hibernating treatments the mock shows. */
function StudioStatusPill({ status }: { status: ProductStatus }) {
  if (status === 'sleeping') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-600">
        <Moon className="h-3 w-3" aria-hidden />
        Hibernating
      </span>
    )
  }
  if (status === 'booting') {
    return (
      <span className="text-warning inline-flex items-center gap-1.5 text-xs font-medium">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        Deploying
      </span>
    )
  }
  return (
    <span className="text-success inline-flex items-center gap-1.5 text-xs font-medium">
      <span className="inline-block h-2 w-2 rounded-full bg-green-500" aria-hidden />
      Running
    </span>
  )
}

/**
 * Full-width managed-infra header for a Studio instance.
 *
 * - The caret (left) collapses/expands the environments underneath.
 * - The header itself is a stretched link that opens the studio app.
 * - The gear (right) links to the studio env's manage page.
 *
 * The caret and gear sit above the stretched link (z-10) so they stay
 * independently clickable without nesting interactive elements.
 */
export function StudioGroupHeader({
  studio,
  collapsed,
  onToggleCollapse,
}: {
  studio: StudioProduct
  collapsed: boolean
  onToggleCollapse: () => void
}) {
  const did = useDid()
  // Brand resolves only once the studio is `ready` (see use-product-brand);
  // until then we fall back to the env label.
  const brand = useProductBrand({
    subdomain: studio.subdomain,
    prefix: studio.prefix,
    status: studio.status,
  })
  const title = brand?.title || studio.label || 'Vetra Studio'
  const tagline = brand?.tagline || null
  const studioUrl = buildStudioEmbedUrl({
    prefix: studio.prefix,
    genericSubdomain: studio.subdomain,
    genericBaseDomain: null,
    userDid: did,
  })

  return (
    <div className="group border-border hover:border-primary bg-muted/40 relative flex items-center gap-3 rounded-xl border px-4 py-4 transition-colors">
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-expanded={!collapsed}
        aria-label={collapsed ? 'Expand environments' : 'Collapse environments'}
        className="text-muted-foreground hover:text-foreground relative z-10 -ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded"
      >
        <ChevronDown className={`h-4 w-4 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
      </button>

      <div className="bg-background flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border">
        <Boxes className="text-muted-foreground h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <a
            href={studioUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate text-lg font-semibold after:absolute after:inset-0 after:content-['']"
          >
            {title} — Studio
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
        {tagline && <p className="text-muted-foreground truncate text-sm">{tagline}</p>}
      </div>

      <div className="relative z-10 flex shrink-0 items-center gap-3">
        <StudioStatusPill status={studio.status} />
        <Button
          variant="ghost"
          size="icon"
          asChild
          className="text-muted-foreground hover:text-foreground h-8 w-8"
        >
          <Link
            href={`/user/environments/${studio.envId}`}
            title="Manage studio"
            aria-label="Manage studio"
          >
            <Settings className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}
