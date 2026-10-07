import type { QueryClient } from '@tanstack/react-query'
import { appsKeys } from '@/modules/apps/hooks/keys'
import { fetchMyApps } from '@/modules/apps/graphql'
import { myEnvironmentsQuery } from '@/modules/cloud/hooks/use-environment'
import { studioProductsQuery } from '@/modules/cloud/studio/use-studio-products'

type PrefetchCtx = { queryClient: QueryClient; did: string | undefined; token: string | null }

/**
 * Maps a nav href to a data-prefetch action. Only authed client-query routes
 * are listed; RSC routes (packages/builders) rely on Next's built-in `<Link>`
 * route prefetch and need no data prefetch here.
 */
export const ROUTE_PREFETCH: Record<string, (ctx: PrefetchCtx) => Promise<unknown>> = {
  '/user': ({ queryClient, did, token }) =>
    Promise.all([
      queryClient.prefetchQuery({
        queryKey: appsKeys.list(did),
        queryFn: () => fetchMyApps(token),
      }),
      queryClient.prefetchQuery({
        queryKey: myEnvironmentsQuery(did).queryKey,
        queryFn: () => myEnvironmentsQuery(did).fetch(token),
      }),
    ]),
  '/user/studio': ({ queryClient, did, token }) => {
    const q = studioProductsQuery(did)
    return queryClient.prefetchQuery({ queryKey: q.queryKey, queryFn: () => q.fetch(token) })
  },
  '/user/environments': ({ queryClient, did, token }) => {
    const q = myEnvironmentsQuery(did)
    return queryClient.prefetchQuery({ queryKey: q.queryKey, queryFn: () => q.fetch(token) })
  },
  '/cloud': ({ queryClient, did, token }) => {
    const q = myEnvironmentsQuery(did)
    return queryClient.prefetchQuery({ queryKey: q.queryKey, queryFn: () => q.fetch(token) })
  },
}

/** True when a route has a data-prefetch action registered. */
export function hasPrefetch(href: string): boolean {
  return href in ROUTE_PREFETCH
}
