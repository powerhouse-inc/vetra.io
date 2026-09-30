import { recommendedNames } from '../../../packages/lib/recommended'
import { listPackages, npmName } from '../../../packages/lib/registry'
import { type NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Largest page the registry serves; the modals narrow further by search
const LIMIT = 50

type RegistryPackage = {
  name: string
  version: string
  description: string | null
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const registryUrl = searchParams.get('registry')
    const search = searchParams.get('search') ?? ''
    const onlyRecommended = searchParams.get('recommended') === 'true'

    if (!registryUrl) {
      return NextResponse.json({ error: 'registry parameter is required' }, { status: 400 })
    }

    const { items } = await listPackages(
      { search, names: onlyRecommended ? [...recommendedNames()] : null, limit: LIMIT },
      { registryUrl: registryUrl.replace(/\/+$/, ''), init: { next: { revalidate: 30 } } },
    )
    return NextResponse.json(
      items.map((p): RegistryPackage => ({
        name: npmName(p),
        version: p.version ?? '',
        description: p.description ?? null,
      })),
    )
  } catch (error) {
    console.error('Registry packages API error:', error)
    return NextResponse.json({ error: 'Failed to fetch packages' }, { status: 502 })
  }
}
