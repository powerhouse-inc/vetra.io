'use client'

import { useDid } from '@powerhousedao/reactor-browser'
import { keepPreviousData, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { fetchMyEnvironments, fetchViewer } from '../graphql'
import type { EnvironmentSummary, ListScope, Viewer } from '../graphql'
import { queryKeys } from '../query/keys'
import { useAuthedQuery } from '../query/use-authed-query'
import { useDocumentListSubscription } from './use-document-subscription'
import type { CloudEnvironment } from '../types'

/** Background revalidation cadence — SWR + the WS subscription cover freshness. */
const ENV_REFETCH_INTERVAL = 20_000

/**
 * UI scope for the env list toggle. Maps to backend `ListScope` + client-side
 * partition of the `owner` / `createdBy` fields (the backend's `MINE` scope
 * returns the caller's envs plus any unclaimed env, so we split that bucket
 * here rather than adding a new server enum).
 *
 * - `MINE`: owner == me, OR (owner == null AND createdBy == me). The second
 *   clause covers the gap between a user creating an env and `SET_OWNER`
 *   landing, so a newly-created env never disappears from its creator's view.
 * - `UNCLAIMED`: owner == null AND createdBy != me. Envs available for anyone
 *   to claim, with the caller's own pending creations filtered out (those
 *   belong in MINE).
 * - `ALL`: every env. Admin-only on the server — non-admins passing ALL get
 *   the same results as MINE from the backend.
 */
export type ViewScope = 'MINE' | 'UNCLAIMED' | 'ALL'

function filterByScope(
  envs: EnvironmentSummary[],
  viewScope: ViewScope,
  viewerAddress: string | null,
): EnvironmentSummary[] {
  if (viewScope === 'ALL') return envs
  const me = viewerAddress?.toLowerCase() ?? null
  if (viewScope === 'MINE') {
    // Without a known identity we can't decide what is "mine"; returning
    // nothing avoids the `null === null` trap where every unclaimed env would
    // otherwise match. The hook re-filters once viewer resolves.
    if (me === null) return []
    return envs.filter((e) => {
      const owner = e.owner?.toLowerCase() ?? null
      const createdBy = e.createdBy?.toLowerCase() ?? null
      return owner === me || (owner === null && createdBy === me)
    })
  }
  // UNCLAIMED: owner == null. When we know the viewer, also exclude envs
  // they created (those belong in MINE) so a pending-SET_OWNER env doesn't
  // appear in both tabs.
  return envs.filter((e) => {
    const owner = e.owner?.toLowerCase() ?? null
    if (owner !== null) return false
    if (me === null) return true
    const createdBy = e.createdBy?.toLowerCase() ?? null
    return createdBy !== me
  })
}

/**
 * Convert an EnvironmentSummary (lightweight projection from the
 * vetra-cloud-observability subgraph) into the heavier CloudEnvironment shape
 * the existing UI expects. Fields not exposed by the summary are filled with
 * sensible defaults — the list view only needs id/name/status/etc.
 */
function summaryToCloudEnvironment(summary: EnvironmentSummary): CloudEnvironment {
  return {
    id: summary.id,
    name: summary.name ?? summary.id,
    documentType: 'powerhouse/vetra-cloud-environment',
    createdAtUtcIso: '',
    lastModifiedAtUtcIso: '',
    revision: 0,
    state: {
      // `owner` comes from document state via the processor; fall back to the
      // legacy `createdBy` column for envs the backfill hasn't touched yet.
      owner: summary.owner ?? summary.createdBy,
      label: summary.name,
      genericSubdomain: summary.subdomain,
      genericBaseDomain: 'vetra.io',
      customDomain: summary.customDomain
        ? { enabled: true, domain: summary.customDomain, dnsRecords: [] }
        : null,
      defaultPackageRegistry: null,
      services: [],
      packages: [],
      // status is a string from the DB; cast to the union type the UI expects
      status: (summary.status ?? 'DRAFT') as CloudEnvironment['state']['status'],
    },
  }
}

/**
 * Hook to get cloud environments scoped to the caller's view.
 *
 * Switching between `MINE` and `UNCLAIMED` filters in-memory (no refetch);
 * switching to/from `ALL` triggers a new server query. `viewerAddress` is
 * required to distinguish MINE from UNCLAIMED — pass `null` while the viewer
 * is still loading and the hook will show an empty list until it resolves.
 *
 * Subscribes to document changes via WebSocket for real-time updates and
 * polls every 10s as fallback.
 */
export function useEnvironments(
  viewScope: ViewScope = 'MINE',
  viewerAddress: string | null = null,
): CloudEnvironment[] {
  const did = useDid()
  const queryClient = useQueryClient()
  const backendScope: ListScope = viewScope === 'ALL' ? 'ALL' : 'MINE'

  // SWR read: paints from the persisted/last-known list instantly, then
  // revalidates in the background. `MINE` and `UNCLAIMED` share the same
  // backend query (filtered in-memory below), so they dedupe to one fetch.
  const { data, isError } = useAuthedQuery<EnvironmentSummary[]>(
    queryKeys.environments(backendScope, did),
    (token) => fetchMyEnvironments(backendScope, token),
    { refetchInterval: ENV_REFETCH_INTERVAL, placeholderData: keepPreviousData },
  )

  // Any document change invalidates every env-list query, triggering a quiet
  // background revalidation (replaces the old manual refetch + 10s polling).
  useDocumentListSubscription(() => {
    void queryClient.invalidateQueries({ queryKey: ['environments'] })
  })

  return useMemo(() => {
    if (isError || !data) return []
    return filterByScope(data, viewScope, viewerAddress).map(summaryToCloudEnvironment)
  }, [data, isError, viewScope, viewerAddress])
}

/** Hook to get a single environment by ID, looked up in the user's MINE list. */
export function useEnvironment(id: string): CloudEnvironment | undefined {
  const environments = useEnvironments()
  return useMemo(() => {
    return environments.find((env) => env.id === id)
  }, [environments, id])
}

/**
 * Hook returning the caller's identity + admin status from switchboard.
 * Used by the `/cloud` page to show the "Mine | All" toggle only for admins.
 */
export function useViewer(): { viewer: Viewer | null; isLoading: boolean } {
  const did = useDid()
  const { data, isLoading, isError } = useAuthedQuery<Viewer>(
    queryKeys.viewer(did),
    (token) => fetchViewer(token),
    { staleTime: 5 * 60 * 1000 },
  )

  // On failure, fall back to the anonymous viewer (matches prior behavior so
  // the admin toggle stays hidden rather than the page hanging on null).
  const viewer = data ?? (isError ? { address: null, isAdmin: false } : null)
  return { viewer, isLoading: isLoading && !data }
}
