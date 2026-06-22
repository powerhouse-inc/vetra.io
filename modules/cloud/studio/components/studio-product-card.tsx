'use client'

import { Boxes, Loader2 } from 'lucide-react'
import { GithubConnectionControl } from '@/modules/connect-github/github-connection-control'
import { useProductBrand } from '../use-product-brand'
import type { StudioProduct } from '../use-studio-products'

/**
 * A product in the grid. When the agent is ready we link straight to its studio
 * URL in a new tab; while it's still booting the card is inert (the agent host
 * isn't reachable yet), and a "Provisioning…" pill communicates why.
 *
 * Brand metadata is resolved lazily here (only once the product is ready) so the
 * list never blocks on a per-product host fetch. A card with no brand still
 * renders from its label/subdomain — we never drop a card on a transient error.
 */
export function StudioProductCard({ product, href }: { product: StudioProduct; href: string }) {
  const isReady = product.status === 'ready'
  // Lazy brand: the hook only fetches when ready, falls back to null otherwise.
  const brand = useProductBrand({
    subdomain: product.subdomain,
    prefix: product.prefix,
    status: product.status,
  })
  const title = brand?.title?.trim() || product.label || 'Untitled product'

  const cardClass = `border-border bg-card flex flex-col rounded-xl border p-5 ${
    isReady ? 'hover:border-foreground/30 transition-colors' : 'cursor-default opacity-80'
  }`

  const statusBadge = isReady ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600">
      <span className="h-1.5 w-1.5 rounded-full bg-green-500" aria-hidden />
      Ready
    </span>
  ) : (
    // Still booting: the agent host isn't reachable yet (it restarts on claim),
    // so the card stays inert until ready. The spinner + "Provisioning…" label
    // make the setting-up state explicit; role/title expose it to AT and hover.
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
        {isReady && <span className="text-muted-foreground text-xs">Open →</span>}
      </div>
    </>
  )

  const card = isReady ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cardClass}>
      {body}
    </a>
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
