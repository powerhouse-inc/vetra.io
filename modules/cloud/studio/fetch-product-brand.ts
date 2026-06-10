import { STUDIO_BASE_DOMAIN } from './constants'

export type ProductBrand = {
  title: string
  tagline: string | null
  description: string | null
}

/** BrandSheet name (title), maxim (tagline), concept (description). */
export const BRAND_QUERY =
  'query { BrandSheet { documents { items { id name state { global { name maxim concept } } } } } }'

type BrandItem = { state?: { global?: { name?: string; maxim?: string; concept?: string } } }

export function parseBrandSheet(json: unknown): ProductBrand | null {
  if (typeof json !== 'object' || json === null) return null
  const data = (json as { data?: unknown }).data
  if (typeof data !== 'object' || data === null) return null
  const items = (data as { BrandSheet?: { documents?: { items?: unknown } } }).BrandSheet?.documents
    ?.items
  if (!Array.isArray(items) || items.length === 0) return null
  const global = (items[0] as BrandItem).state?.global
  if (!global || typeof global.name !== 'string') return null
  return {
    title: global.name,
    tagline: global.maxim ?? null,
    description: global.concept ?? null,
  }
}

/**
 * Fetch a product's brand metadata from its agent switchboard. Auth-gated:
 * pass the caller's Renown bearer token. Returns null on any failure (agent
 * down/booting, no BrandSheet, network) so callers fall back to the env label.
 */
export async function fetchProductBrand(input: {
  subdomain: string
  prefix: string
  baseDomain?: string | null
  token: string | null
}): Promise<ProductBrand | null> {
  const base = input.baseDomain || STUDIO_BASE_DOMAIN
  const url = `https://${input.prefix}.${input.subdomain}.${base}/switchboard/graphql`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(input.token ? { authorization: `Bearer ${input.token}` } : {}),
      },
      body: JSON.stringify({ query: BRAND_QUERY }),
    })
    if (!res.ok) return null
    return parseBrandSheet((await res.json()) as unknown)
  } catch {
    return null
  }
}
