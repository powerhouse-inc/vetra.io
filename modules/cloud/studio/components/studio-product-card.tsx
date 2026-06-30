'use client'

import { Boxes, Loader2, Moon } from 'lucide-react'
import { GithubConnectionControl } from '@/modules/connect-github/github-connection-control'
import { useProductBrand } from '../use-product-brand'
import { useStudioWake } from '../use-studio-wake'
import type { StudioProduct } from '../use-studio-products'

/**
 * A product in the grid.
 *  - ready  → links straight to the studio URL in a new tab.
 *  - sleeping (housekeeping-hibernated) → clicking wakes it in place: we call
 *    the open wakeStudio mutation and poll until AWAKE, then the card becomes
 *    openable (no standalone activator / catch-all ingress needed).
 *  - booting → inert with a "Provisioning…" pill.
 *
 * Brand metadata is resolved lazily here (only once the product is ready) so the
 * list never blocks on a per-product host fetch.
 */
export function StudioProductCard({ product, href }: { product: StudioProduct; href: string }) {
  let host: string
  try {
    host = new URL(href).host
  } catch {
    host = product.subdomain ? `${product.subdomain}.vetra.io` : ''
  }
  const wake = useStudioWake(host)

  const isSleeping = product.status === 'sleeping'
  const isWaking = isSleeping && wake.state === 'waking'
  // Openable once ready, or once a woken-from-sleep studio reports AWAKE.
  const canOpen = product.status === 'ready' || (isSleeping && wake.state === 'awake')
  // Clickable to start a wake while it's still sleeping and we haven't begun.
  const canWake = isSleeping && (wake.state === 'idle' || wake.state === 'error')

  // Lazy brand: the hook only fetches when ready, falls back to null otherwise.
  const brand = useProductBrand({
    subdomain: product.subdomain,
    prefix: product.prefix,
    status: canOpen ? 'ready' : product.status,
  })
  const title = brand?.title?.trim() || product.label || 'Untitled product'

  const interactive = canOpen || canWake
  const cardClass = `border-border bg-card flex flex-col rounded-xl border p-5 text-left w-full ${
    interactive ? 'hover:border-foreground/30 transition-colors' : 'cursor-default opacity-80'
  }`

  const statusBadge = canOpen ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600">
      <span className="h-1.5 w-1.5 rounded-full bg-green-500" aria-hidden />
      Ready
    </span>
  ) : isWaking ? (
    <span
      role="status"
      title="Waking this studio — it'll be openable in a minute or two."
      className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-2 py-0.5 text-xs font-medium text-indigo-500"
    >
      <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
      Waking…
    </span>
  ) : isSleeping ? (
    // Hibernated to save resources. Clicking wakes it (~1-2 min). Communicate
    // that it's intentional + resumable, not broken.
    <span
      title="This studio is asleep to save resources. Click to wake it."
      className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-2 py-0.5 text-xs font-medium text-indigo-500"
    >
      <Moon className="h-3 w-3" aria-hidden />
      Sleeping
    </span>
  ) : (
    // Still booting: the agent host isn't reachable yet (it restarts on claim),
    // so the card stays inert until ready.
    <span
      role="status"
      title="This studio is starting up and will be ready shortly."
      className="bg-muted text-muted-foreground inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
    >
      <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
      Provisioning…
    </span>
  )

  const body = (
    <>
      <div className="flex items-start gap-3">
        <div className="bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
          <Boxes className="text-muted-foreground h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold">{title}</div>
          {brand?.tagline ? (
            <div className="text-muted-foreground truncate text-sm">{brand.tagline}</div>
          ) : (
            product.subdomain && (
              <div className="text-muted-foreground truncate text-sm">{product.subdomain}</div>
            )
          )}
        </div>
      </div>
      {brand?.description && (
        <p className="text-muted-foreground mt-3 line-clamp-4 text-sm leading-relaxed">
          {brand.description}
        </p>
      )}
      <div className="mt-4 flex items-center justify-between border-t pt-3">
        {statusBadge}
        {canOpen && <span className="text-muted-foreground text-xs">Open →</span>}
        {canWake && <span className="text-muted-foreground text-xs">Wake →</span>}
      </div>
    </>
  )

  const card = canOpen ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cardClass}>
      {body}
    </a>
  ) : canWake ? (
    <button type="button" onClick={() => wake.wake()} className={cardClass}>
      {body}
    </button>
  ) : (
    <div className={cardClass}>{body}</div>
  )

  return (
    <div className="flex flex-col gap-2">
      {card}
      <div className="px-1">
        <GithubConnectionControl environmentId={product.envId} />
      </div>
    </div>
  )
}
