/**
 * React Query keys for the publisher tabs. Keys embed the viewer DID so two
 * wallets on one machine never share a cache entry; `of()` is the DID-less
 * prefix used to invalidate one resource of one app for every viewer.
 */
export type PublisherResource =
  'templates' | 'terms' | 'artifacts' | 'licenses' | 'environments' | 'inviteCodes' | 'allowList'

export const publisherKeys = {
  all: ['publisher'] as const,
  apps: (did: string) => ['publisher', 'apps', did] as const,
  resource: (r: PublisherResource, appId: string, did: string) =>
    ['publisher', r, appId, did] as const,
  of: (r: PublisherResource, appId: string) => ['publisher', r, appId] as const,
}
