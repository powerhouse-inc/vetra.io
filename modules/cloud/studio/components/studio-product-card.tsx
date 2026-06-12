'use client'

import { Boxes } from 'lucide-react'
import type { StudioProduct } from '../use-studio-products'

/**
 * A product in the grid. When the agent is ready we link straight to its studio
 * URL in a new tab; while it's still booting the card is inert (the agent host
 * isn't reachable yet), and the "Starting…" badge communicates why.
 */
export function StudioProductCard({ product, href }: { product: StudioProduct; href: string }) {
  const title = product.brand?.title?.trim() || product.label || 'Untitled product'
  const isReady = product.status === 'ready'

  const cardClass = `border-border bg-card flex flex-col rounded-xl border p-5 ${
    isReady ? 'hover:border-foreground/30 transition-colors' : 'cursor-default opacity-80'
  }`

  const body = (
    <>
      <div className="flex items-start gap-3">
        <div className="bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
          <Boxes className="text-muted-foreground h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold">{title}</div>
          {product.brand?.tagline && (
            <div className="text-muted-foreground truncate text-sm">{product.brand.tagline}</div>
          )}
        </div>
      </div>
      {product.brand?.description && (
        <p className="text-muted-foreground mt-3 line-clamp-4 text-sm leading-relaxed">
          {product.brand.description}
        </p>
      )}
      <div className="mt-4 flex items-center justify-between border-t pt-3">
        <span
          className={
            isReady
              ? 'text-xs font-medium text-green-600'
              : 'text-muted-foreground text-xs font-medium'
          }
        >
          {isReady ? 'Ready' : 'Starting…'}
        </span>
        {isReady && <span className="text-muted-foreground text-xs">Open →</span>}
      </div>
    </>
  )

  if (!isReady) {
    return <div className={cardClass}>{body}</div>
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cardClass}>
      {body}
    </a>
  )
}
