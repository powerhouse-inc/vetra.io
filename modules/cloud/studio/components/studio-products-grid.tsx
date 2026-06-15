'use client'

import { CloudLanding } from '@/modules/cloud/components/cloud-landing'
import { StudioBootScreen } from './studio-boot-screen'
import { StudioProductCard } from './studio-product-card'
import { NewProductCard } from './new-product-card'
import { buildStudioEmbedUrl } from '../studio-embed-url'
import { useStudioProducts } from '../use-studio-products'

export function StudioProductsGrid() {
  const { gate, products, isScanning, creating, createError, createProduct, hasAttachedKey, did } =
    useStudioProducts()

  if (gate === 'unauthenticated') return <CloudLanding />
  if (gate === 'loading') return <StudioBootScreen title="Loading…" />

  // Provision a new product; it surfaces in the list (as "Starting…") once the
  // env scan refetches — no separate studio page to navigate to. The key is
  // omitted when the invite code carries one (server-side injection).
  const handleCreate = async (apiKey?: string) => {
    await createProduct(apiKey)
  }

  return (
    <div className="mx-auto mt-24 max-w-screen-xl px-6 pb-16">
      <h1 className="mb-6 text-2xl font-semibold">Products</h1>
      {isScanning && products.length === 0 ? (
        <StudioBootScreen title="Loading your products…" />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
            <StudioBootScreen title="Creating your product…" />
          ) : (
            <NewProductCard
              onCreate={handleCreate}
              createError={createError}
              hasAttachedKey={hasAttachedKey}
            />
          )}
        </div>
      )}
    </div>
  )
}
