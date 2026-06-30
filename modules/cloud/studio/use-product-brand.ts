'use client'

import { queryKeys } from '@/modules/cloud/query/keys'
import { useAuthedQuery } from '@/modules/cloud/query/use-authed-query'
import { fetchProductBrand, type ProductBrand } from './fetch-product-brand'
import type { ProductStatus } from './studio-readiness'

/**
 * Lazily resolve a product's brand from its per-tenant agent host — but ONLY
 * once the switchboard reports the product as `ready`.
 *
 * Why gated on readiness: fetchProductBrand does a browser fetch to the
 * product's flattened host (a Studio sits at the apex: https://<subdomain>.vetra.io).
 * For a just-created product the DNS
 * record doesn't exist yet (external-dns creates it after the ingress is
 * admitted), so the browser's lookup returns NXDOMAIN and the resolver
 * NEGATIVE-CACHES it for the vetra.io zone's SOA minimum (1h). That poisoned
 * cache then breaks the user's actual navigation to the studio for up to an
 * hour. The switchboard's pull-worker only reports a product as 'ready' after
 * it has itself reached the agent over that same public host, so 'ready'
 * guarantees the host already resolves — making this the safe moment for the
 * browser to hit it.
 *
 * Brand failures resolve to `null` (handled inside fetchProductBrand), so a
 * card always renders from its label even when the brand is unavailable.
 */
export function useProductBrand(input: {
  subdomain: string
  prefix: string
  status: ProductStatus
}): ProductBrand | null {
  const ready = input.status === 'ready'
  const { data } = useAuthedQuery<ProductBrand | null>(
    queryKeys.brand(input.subdomain, input.prefix),
    (token) => fetchProductBrand({ subdomain: input.subdomain, prefix: input.prefix, token }),
    { enabled: ready },
  )
  return data ?? null
}
