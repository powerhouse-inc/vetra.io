import { type NextRequest, NextResponse } from 'next/server'

import { computeDistTags, sortTagsNewestFirst } from '@/modules/cloud/registry/channels'
import { fetchHarborTags } from '@/modules/cloud/registry/harbor'
import { resolveTagsTarget } from '@/modules/cloud/registry/tags-target'

export const dynamic = 'force-dynamic'
export const revalidate = 60

const CACHE_HEADER = 'public, s-maxage=60, stale-while-revalidate=300'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const serviceType = searchParams.get('service')

    if (!serviceType) {
      return NextResponse.json({ error: 'service parameter is required' }, { status: 400 })
    }

    const allowedProjects = (process.env.FUSION_IMAGE_PROJECTS ?? '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
    const target = resolveTagsTarget(serviceType, searchParams.get('image'), allowedProjects)
    if ('error' in target) {
      return NextResponse.json({ error: target.error }, { status: 400 })
    }

    // FUSION images live in private Harbor projects: list them with the
    // read-only fusion-reader robot (server-side env only).
    const user = process.env.HARBOR_FUSION_READER_USERNAME
    const pass = process.env.HARBOR_FUSION_READER_PASSWORD
    const rawTags = await fetchHarborTags(
      target.imagePath,
      target.fusion && user && pass ? { username: user, password: pass } : null,
    )
    const tags = sortTagsNewestFirst(rawTags)
    const distTags = computeDistTags(rawTags)

    return NextResponse.json(
      { tags, distTags },
      { headers: { 'Cache-Control': target.fusion ? 'private, max-age=60' : CACHE_HEADER } },
    )
  } catch (error) {
    console.error('Registry tags API error:', error)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
