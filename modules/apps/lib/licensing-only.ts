import type { PublisherApp } from '@/modules/publisher/types'
import type { App } from '../types'

/**
 * Apps the viewer publishes that the apps API does not list: they exist only for licensing
 * (Vetra Studio has no repository). Shown as their own cards on the apps home.
 * The publisher list still carries soft-deleted apps (myApps hides those), so a
 * DELETED one would otherwise pass as "licensing only".
 */
export function licensingOnlyApps(
  published: PublisherApp[] | undefined,
  apps: Pick<App, 'id'>[] | undefined,
): PublisherApp[] {
  const known = new Set((apps ?? []).map((a) => a.id))
  return (published ?? [])
    .filter((p) => p.status !== 'DELETED' && !known.has(p.id))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Opens on the page's first tab (Profile), like every other app. */
export const licensingOnlyHref = (id: string): string => `/user/apps/${encodeURIComponent(id)}`
