import { type NextRequest, NextResponse } from 'next/server'
import { withoutManagedConfig } from '@/modules/cloud/config/managed'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const registryUrl = searchParams.get('registry')
    const packageName = searchParams.get('package')
    const version = searchParams.get('version')

    if (!registryUrl || !packageName) {
      return NextResponse.json(
        { error: 'registry and package parameters are required' },
        { status: 400 },
      )
    }

    const spec = version ? `${packageName}@${version}` : packageName
    const cdnUrl = new URL(`/-/cdn/${spec}/powerhouse.manifest.json`, registryUrl)
    const res = await fetch(cdnUrl.toString(), { next: { revalidate: 30 } })

    if (res.status === 404) {
      return NextResponse.json({ error: 'Manifest not found' }, { status: 404 })
    }
    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch manifest: ${res.status}` },
        { status: 502 },
      )
    }

    const manifest = (await res.json()) as unknown
    // Resolve relative asset paths in the manifest (e.g. agent.image
    // = "./ph-pirate-agent.png") against the package's CDN root so the
    // browser can fetch them without knowing the registry layout.
    const resolved = resolveManifestAssets(manifest, cdnUrl)
    return NextResponse.json(withoutManagedConfig(resolved))
  } catch (error) {
    console.error('Registry manifest API error:', error)
    return NextResponse.json({ error: 'Failed to fetch manifest' }, { status: 500 })
  }
}

function resolveManifestAssets(manifest: unknown, manifestUrl: URL): unknown {
  if (typeof manifest !== 'object' || manifest === null) return manifest
  const m = manifest as Record<string, unknown>
  const features = m.features as Record<string, unknown> | undefined
  const agent = features?.agent as Record<string, unknown> | undefined
  if (!agent) return manifest
  const image = agent.image
  if (typeof image !== 'string' || isAbsoluteUrl(image)) return manifest
  return {
    ...m,
    features: {
      ...features,
      agent: { ...agent, image: new URL(image, manifestUrl).toString() },
    },
  }
}

function isAbsoluteUrl(s: string): boolean {
  return /^https?:\/\//i.test(s) || s.startsWith('//') || s.startsWith('data:')
}
