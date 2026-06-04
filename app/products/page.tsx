'use client'

import { Github, Globe, Plus, Twitter } from 'lucide-react'
import Link from 'next/link'

interface Product {
  id: string
  name: string
  tagline: string
  description: string
  environmentCount: number
  initials: string
  color: string
  links: {
    github?: string
    website?: string
    twitter?: string
  }
}

const MOCK_PRODUCTS: Product[] = [
  {
    id: 'concord',
    name: 'Concord',
    tagline: 'Share the burden. Keep the savings.',
    description:
      "Concord coordinates procurement and shared services for any group that runs things together — households, condo buildings, campuses, elder-living complexes, office parks. By pooling demand and dividing operational work across members, it turns the everyday cost of shared life into measurable savings of money and time. Local-first by design, so a group's dues, decisions, and supplier relationships stay with the group.",
    environmentCount: 3,
    initials: 'C',
    color: 'bg-slate-700',
    links: {
      github: '#',
      website: '#',
      twitter: '#',
    },
  },
]

function ProductCard({ product }: { product: Product }) {
  return (
    <div className="bg-card border-border flex h-full flex-col rounded-xl border p-5">
      {/* Product identity */}
      <div className="mb-3 flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white ${product.color}`}
        >
          {product.initials}
        </div>
        <div>
          <p className="text-foreground font-semibold">{product.name}</p>
          <p className="text-muted-foreground text-xs">{product.tagline}</p>
        </div>
      </div>

      {/* Description */}
      <p className="text-muted-foreground mb-4 flex-1 text-sm leading-relaxed">
        {product.description}
      </p>

      {/* Footer */}
      <div className="border-border flex items-center justify-between border-t pt-3">
        <Link
          href="/cloud"
          className="text-primary hover:text-primary/80 text-sm font-medium transition-colors"
        >
          {product.environmentCount} environment{product.environmentCount !== 1 ? 's' : ''} &rsaquo;
        </Link>
        <div className="flex items-center gap-3">
          {product.links.github && (
            <Link
              href={product.links.github}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Github className="h-4 w-4" />
            </Link>
          )}
          {product.links.website && (
            <Link
              href={product.links.website}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Globe className="h-4 w-4" />
            </Link>
          )}
          {product.links.twitter && (
            <Link
              href={product.links.twitter}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Twitter className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

function CreateProductCard() {
  return (
    <button
      type="button"
      className="border-border text-muted-foreground hover:bg-accent/50 hover:border-border/80 flex h-full min-h-48 w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed transition-colors"
    >
      <div className="border-border flex h-10 w-10 items-center justify-center rounded-full border">
        <Plus className="h-5 w-5" />
      </div>
      <span className="text-sm font-medium">Create new product...</span>
    </button>
  )
}

export default function ProductsPage() {
  return (
    <div className="bg-background min-h-screen px-6 pt-28 pb-10">
      <div className="mx-auto max-w-4xl">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {MOCK_PRODUCTS.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
          <CreateProductCard />
        </div>
      </div>
    </div>
  )
}
