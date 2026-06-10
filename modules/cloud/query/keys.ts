/**
 * Centralized React Query key factory.
 *
 * Per-user queries embed the viewer DID so one user can never read another's
 * cached (or persisted) entries — a different DID yields a different key, hence
 * a cache miss and a fresh fetch. `did` may be `undefined` while identity is
 * still resolving; that simply forms a distinct "anonymous" bucket.
 *
 * The first element of every key is a stable string prefix, which the persister
 * uses to decide what is safe to write to localStorage (see `shouldPersistQuery`).
 */
export const queryKeys = {
  environments: (scope: string, did: string | undefined) =>
    ['environments', scope, did ?? null] as const,
  environment: (envId: string, did: string | undefined) =>
    ['environment', envId, did ?? null] as const,
  viewer: (did: string | undefined) => ['viewer', did ?? null] as const,
  studioProducts: (did: string | undefined) => ['studio-products', did ?? null] as const,
  brand: (subdomain: string, prefix: string) => ['brand', subdomain, prefix] as const,
  runtimeEndpoints: (subdomain: string, envId: string) =>
    ['runtime-endpoints', subdomain, envId] as const,
  tenantSecrets: (envId: string) => ['tenant-secrets', envId] as const,
  tenantEnvVars: (envId: string) => ['tenant-env-vars', envId] as const,
} as const
