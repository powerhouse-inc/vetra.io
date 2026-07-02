'use client'

import { Loader2 } from 'lucide-react'
import { CloudLanding } from '@/modules/cloud/components/cloud-landing'
import { StudioBootScreen } from './studio-boot-screen'
import { StudioProductCard } from './studio-product-card'
import { NewProductCard } from './new-product-card'
import { buildStudioEmbedUrl } from '../studio-embed-url'
import { useStudioProducts } from '../use-studio-products'

/** Placeholder card shown during the very first load (no cached data yet). */
function ProductCardSkeleton() {
  return (
    <div className="border-border bg-card flex flex-col rounded-xl border p-5">
      <div className="flex items-start gap-3">
        <div className="bg-muted h-10 w-10 shrink-0 animate-pulse rounded-lg" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="bg-muted h-4 w-2/3 animate-pulse rounded" />
          <div className="bg-muted h-3 w-1/2 animate-pulse rounded" />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between border-t pt-3">
        <div className="bg-muted h-4 w-16 animate-pulse rounded-full" />
      </div>
    </div>
  )
}

export function StudioProductsGrid() {
  const { gate, products, isScanning, creating, createError, createProduct, hasAttachedKey, did } =
    useStudioProducts()

  if (gate === 'unauthenticated') return <CloudLanding />
  if (gate === 'loading') return <StudioBootScreen title="Loading…" />

  // Provision a new product; it surfaces in the list optimistically (as
  // "Provisioning…") immediately, and the 30s poll reconciles it against the
  // server-resolved list. The key is omitted when the invite code carries one
  // (server-side injection).
  const handleCreate = async (apiKey?: string) => {
    await createProduct(apiKey)
  }

  // First load with nothing cached: show skeleton cards so the layout settles
  // immediately instead of flashing a full-screen spinner.
  const showSkeletons = isScanning && products.length === 0
  // Authed, settled, and genuinely empty: invite the user to create their first.
  const showEmptyState = !isScanning && products.length === 0 && !creating

  return (
    <div className="mx-auto mt-24 max-w-screen-xl px-6 pb-16">
      <h1 className="mb-6 text-2xl font-semibold">Products</h1>

      {showEmptyState ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <p className="text-lg font-medium">No products yet</p>
          <p className="text-muted-foreground max-w-sm text-sm">
            Create your first product to spin up a dedicated Vetra Studio.
          </p>
          <NewProductCard
            onCreate={handleCreate}
            createError={createError}
            hasAttachedKey={hasAttachedKey}
            variant="button"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {showSkeletons ? (
            <>
              <ProductCardSkeleton />
              <ProductCardSkeleton />
              <ProductCardSkeleton />
            </>
          ) : (
            <>
              {products.map((p) => (
                <StudioProductCard
                  key={p.envId}
                  product={p}
                  href={buildStudioEmbedUrl({
                    prefix: p.prefix,
                    genericSubdomain: p.subdomain,
                    genericBaseDomain: null,
                    userDid: did,
                  })}
                />
              ))}
              {creating ? (
                // Card-sized creating state that sits in the grid alongside the
                // product cards. (StudioBootScreen is a min-h-[60vh] full-screen
                // spinner — using it here ballooned the grid cell.)
                <div className="border-border flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-xl border">
                  <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
                  <p className="text-sm font-medium">Creating your product…</p>
                </div>
              ) : (
                <NewProductCard
                  onCreate={handleCreate}
                  createError={createError}
                  hasAttachedKey={hasAttachedKey}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
