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

/**
 * Adaptive poll cadence for the studio products list. A freshly claimed env
 * reports `ready` from the backend ~20s after claim, but the agent endpoint is
 * discovered by a poll worker, so we don't know the exact moment. While any
 * product is still `booting` we poll fast so the card flips to `ready` within a
 * few seconds of the backend signal instead of waiting a full slow cycle; once
 * everything is ready we relax to the slow cadence (no steady-state load).
 */
export const FAST_STUDIO_POLL_MS = 3_000
export const SLOW_STUDIO_POLL_MS = 30_000

export function studioPollIntervalMs(
  products: ReadonlyArray<{ status: ProductStatus }> | undefined,
): number {
  const anyBooting = (products ?? []).some((p) => p.status !== 'ready')
  return anyBooting ? FAST_STUDIO_POLL_MS : SLOW_STUDIO_POLL_MS
}
