import type { QueryClient } from '@tanstack/react-query'
import { appsKeys } from '@/modules/apps/hooks/keys'
import { readActiveOrg } from '@/modules/orgs/active-org'
import { fetchMyApps } from '@/modules/apps/graphql'
import { myEnvironmentsQuery } from '@/modules/cloud/hooks/use-environment'
import { studioProductsQuery } from '@/modules/cloud/studio/use-studio-products'

type PrefetchCtx = { queryClient: QueryClient; did: string | undefined; token: string | null }

/** The env list the page will ask for: the active organisation's, or the personal one. */
function envListQuery(did: string | undefined) {
  const orgId = readActiveOrg()
  return myEnvironmentsQuery(did, orgId ? 'ORG' : 'MINE', orgId)
}

/**
 * Maps a nav href to a data-prefetch action. Only authed client-query routes
 * are listed; RSC routes (packages/builders) rely on Next's built-in `<Link>`
 * route prefetch and need no data prefetch here.
 */
export const ROUTE_PREFETCH: Record<string, (ctx: PrefetchCtx) => Promise<unknown>> = {
  '/user': ({ queryClient, did, token }) =>
    Promise.all([
      queryClient.prefetchQuery({
        queryKey: appsKeys.list(did, readActiveOrg()),
        queryFn: () => fetchMyApps(token, undefined, readActiveOrg()),
      }),
      queryClient.prefetchQuery({
        queryKey: envListQuery(did).queryKey,
        queryFn: () => envListQuery(did).fetch(token),
      }),
    ]),
  '/user/studio': ({ queryClient, did, token }) => {
    const q = studioProductsQuery(did)
    return queryClient.prefetchQuery({ queryKey: q.queryKey, queryFn: () => q.fetch(token) })
  },
  '/user/environments': ({ queryClient, did, token }) => {
    const q = envListQuery(did)
    return queryClient.prefetchQuery({ queryKey: q.queryKey, queryFn: () => q.fetch(token) })
  },
  '/cloud': ({ queryClient, did, token }) => {
    const q = envListQuery(did)
    return queryClient.prefetchQuery({ queryKey: q.queryKey, queryFn: () => q.fetch(token) })
  },
}

/** True when a route has a data-prefetch action registered. */
export function hasPrefetch(href: string): boolean {
  return href in ROUTE_PREFETCH
}
