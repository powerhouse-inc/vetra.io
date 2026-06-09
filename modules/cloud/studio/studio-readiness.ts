import type { ClintRuntimeEndpointsForPrefix } from '@/modules/cloud/types'

/** The studio is embeddable once its agent announces an enabled website route. */
export function hasStudioWebsiteEndpoint(
  group: ClintRuntimeEndpointsForPrefix | undefined,
): boolean {
  if (!group) return false
  return group.endpoints.some((e) => e.type === 'website' && e.status === 'enabled')
}
