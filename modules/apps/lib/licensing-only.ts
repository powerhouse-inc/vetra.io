import type { PublisherApp } from '@/modules/publisher/types'
import type { App } from '../types'

/**
 * Apps the viewer publishes that the apps API does not list: they exist only for licensing
 * (Vetra Studio has no repository). Shown as their own cards on the apps home.
 */
export function licensingOnlyApps(
  published: PublisherApp[] | undefined,
  apps: Pick<App, 'id'>[] | undefined,
): PublisherApp[] {
  const known = new Set((apps ?? []).map((a) => a.id))
  return (published ?? [])
    .filter((p) => !known.has(p.id))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export const licensingOnlyHref = (id: string): string =>
  `/user/apps/${encodeURIComponent(id)}?tab=plans`
