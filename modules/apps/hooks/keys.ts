/**
 * React Query keys for Vetra Apps. Per-user keys embed the viewer DID (same
 * rule as modules/cloud/query/keys.ts) so cached lists never leak across users.
 */
export const appsKeys = {
  all: ['apps'] as const,
  list: (did: string | undefined) => ['apps', 'list', did ?? null] as const,
  detail: (id: string, did: string | undefined) => ['apps', 'detail', id, did ?? null] as const,
  deployments: (id: string, did: string | undefined) =>
    ['apps', 'deployments', id, did ?? null] as const,
  githubInfo: () => ['apps', 'github-info'] as const,
  installations: (did: string | undefined) => ['apps', 'installations', did ?? null] as const,
  repositories: (installationId: string, did: string | undefined) =>
    ['apps', 'repositories', installationId, did ?? null] as const,
}
