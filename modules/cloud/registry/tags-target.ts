const PLATFORM_IMAGES: Record<string, string> = {
  CONNECT: 'powerhouse-inc-powerhouse/connect',
  SWITCHBOARD: 'powerhouse-inc-powerhouse/switchboard',
}

const FUSION_IMAGE = /^cr\.vetra\.io\/([a-z0-9]+(?:[._-][a-z0-9]+)*(?:\/[a-z0-9]+(?:[._-][a-z0-9]+)*)+)$/

export type TagsTarget = { imagePath: string; fusion: boolean } | { error: string }

/**
 * Which Harbor repository the version picker lists tags for. CONNECT and
 * SWITCHBOARD are the platform images; FUSION brings its own image (from the
 * environment's fusion config), which must live on cr.vetra.io.
 */
export function resolveTagsTarget(
  service: string,
  image: string | null,
  allowedProjects: readonly string[] = [],
): TagsTarget {
  const type = service.toUpperCase()
  if (type === 'FUSION') {
    if (!image) return { error: 'image parameter is required' }
    const m = FUSION_IMAGE.exec(image.trim())
    if (!m) return { error: 'image must be a cr.vetra.io repository' }
    // Same allowlist the switchboard enforces when rendering (FUSION_IMAGE_PROJECTS):
    // the reader robot can see every project, so never list tags outside it.
    if (!allowedProjects.includes(m[1].split('/')[0])) {
      return { error: 'image project is not enabled for Fusion apps' }
    }
    return { imagePath: m[1], fusion: true }
  }
  const imagePath = PLATFORM_IMAGES[type]
  if (!imagePath) return { error: `Unknown service type: ${service}` }
  return { imagePath, fusion: false }
}
