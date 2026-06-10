import type { ClintRuntimeEndpointsForPrefix } from '@/modules/cloud/types'

/** The studio is embeddable once its agent announces an enabled website route. */
export function hasStudioWebsiteEndpoint(
  group: ClintRuntimeEndpointsForPrefix | undefined,
): boolean {
  if (!group) return false
  return group.endpoints.some((e) => e.type === 'website' && e.status === 'enabled')
}

export type ProductStatus = 'ready' | 'booting'

/** A product is 'ready' once its agent announces an enabled website endpoint. */
export function deriveProductStatus(
  group: ClintRuntimeEndpointsForPrefix | undefined,
): ProductStatus {
  return hasStudioWebsiteEndpoint(group) ? 'ready' : 'booting'
}
