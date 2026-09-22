import { unstable_cache } from 'next/cache'
import { recommendedNames } from '../../../packages/lib/recommended'
import { type NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type RegistryPackage = {
  name: string
  version: string
  description: string | null
}

/**
 * Fetches the registry's full package list and projects it down to the three
 * fields the UI needs. Cached for 30s.
 *
 * Why the projection happens before caching: the raw Verdaccio payload is
 * ~10 MB, which exceeds Next.js's 2 MB data-cache ceiling. Caching the raw
 * fetch silently fails and spams "Failed to set Next.js data cache" on every
 * request. Projecting first keeps the cached blob well under the limit (only
 * the projected JSON is stored), and filtering on top of cache means the
 * upstream registry only gets hit once per 30s regardless of search churn.
 */
const fetchRegistryPackages = unstable_cache(
  async (registryUrl: string): Promise<RegistryPackage[]> => {
    const url = new URL('/-/verdaccio/data/packages', registryUrl)
    const res = await fetch(url.toString(), { cache: 'no-store' })
    if (!res.ok) {
      throw new Error(`registry returned ${res.status}`)
    }
    const packages = (await res.json()) as Array<{
      name: string
      version: string
      description?: string
    }>
    return packages.map((p) => ({
      name: p.name,
      version: p.version,
      description: p.description ?? null,
    }))
  },
  ['registry-packages'],
  { revalidate: 30 },
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const registryUrl = searchParams.get('registry')
    const search = searchParams.get('search') ?? ''
    const onlyRecommended = searchParams.get('recommended') === 'true'

    if (!registryUrl) {
      return NextResponse.json({ error: 'registry parameter is required' }, { status: 400 })
    }

    const recSet = onlyRecommended ? recommendedNames() : null
    let filtered = await fetchRegistryPackages(registryUrl)
    if (recSet) filtered = filtered.filter((p) => recSet.has(p.name.toLowerCase()))
    if (search) {
      filtered = filtered.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    }

    return NextResponse.json(filtered)
  } catch (error) {
    console.error('Registry packages API error:', error)
    return NextResponse.json({ error: 'Failed to fetch packages' }, { status: 502 })
  }
}
