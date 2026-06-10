'use client'

import Link from 'next/link'
import { Boxes } from 'lucide-react'
import type { StudioProduct } from '../use-studio-products'

export function StudioProductCard({ product }: { product: StudioProduct }) {
  const title = product.brand?.title?.trim() || product.label || 'Untitled product'
  return (
    <Link
      href={`/studio/${product.envId}`}
      className="border-border hover:border-foreground/30 bg-card flex flex-col rounded-xl border p-5 transition-colors"
    >
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
            product.status === 'ready'
              ? 'text-xs font-medium text-green-600'
              : 'text-muted-foreground text-xs font-medium'
          }
        >
          {product.status === 'ready' ? 'Ready' : 'Starting…'}
        </span>
        <span className="text-muted-foreground text-xs">Open →</span>
      </div>
    </Link>
  )
}
