'use client'

import { useRouter } from 'next/navigation'
import { CloudLanding } from '@/modules/cloud/components/cloud-landing'
import { StudioBootScreen } from './studio-boot-screen'
import { StudioProductCard } from './studio-product-card'
import { NewProductCard } from './new-product-card'
import { useStudioProducts } from '../use-studio-products'

export function StudioProductsGrid() {
  const router = useRouter()
  const { gate, products, isScanning, creating, createError, createProduct } = useStudioProducts()

  if (gate === 'unauthenticated') return <CloudLanding />
  if (gate === 'loading') return <StudioBootScreen title="Loading…" />

  const handleCreate = async (apiKey: string) => {
    const envId = await createProduct(apiKey)
    router.push(`/studio/${envId}`)
  }

  return (
    <div className="mx-auto mt-24 max-w-screen-xl px-6 pb-16">
      <h1 className="mb-6 text-2xl font-semibold">Products</h1>
      {isScanning && products.length === 0 ? (
        <StudioBootScreen title="Loading your products…" />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <StudioProductCard key={p.envId} product={p} />
          ))}
          {creating ? (
            <StudioBootScreen title="Creating your product…" />
          ) : (
            <NewProductCard onCreate={handleCreate} createError={createError} />
          )}
        </div>
      )}
    </div>
  )
}
