/**
 * React Query keys for the publisher dashboard. Per-user keys embed the viewer
 * DID (same rule as modules/apps/hooks/keys.ts) so two wallets signed in on one
 * machine never share a cache entry.
 */
export const publisherKeys = {
  all: ['publisher'] as const,
  apps: (did: string) => ['publisher', 'apps', did] as const,
  types: (appId: string, did: string) => ['publisher', 'types', appId, did] as const,
  artifacts: (appId: string, did: string) => ['publisher', 'artifacts', appId, did] as const,
  licenses: (appId: string, status: string | null, did: string) =>
    ['publisher', 'licenses', appId, status ?? 'ALL', did] as const,
  /** Prefix of every status/DID variant of one app's licence lists, for invalidation. */
  licensesOf: (appId: string) => ['publisher', 'licenses', appId] as const,
  environments: (appId: string, did: string) => ['publisher', 'environments', appId, did] as const,
}
