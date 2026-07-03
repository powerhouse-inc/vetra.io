'use client'

import { useMemo } from 'react'
import type { CloudEnvironment } from '@/modules/cloud/types'
import { useEnvironments, useViewer } from '@/modules/cloud/hooks/use-environment'
import { useStudioProducts, type StudioProduct } from './use-studio-products'

/** One studio (product) with the environments it deployed to, nested underneath. */
export type StudioGroup = {
  studio: StudioProduct
  environments: CloudEnvironment[]
}

export type StudioGroupsResult = {
  groups: StudioGroup[]
  /** Envs not produced by any studio (studioInstanceId null / dangling) and not studios themselves. */
  standalone: CloudEnvironment[]
}

/**
 * Pure join of the caller's studios × environments into the grouped layout.
 *
 * - An env belongs to a studio group when its `studioInstanceId` equals that
 *   studio's env id (and it isn't the studio env itself).
 * - Studio envs (the `vetra-cli` agents) are headers, never nested cards, so
 *   they're excluded from `standalone`.
 * - An env with a null studioInstanceId — or one pointing at a studio not in
 *   the list (dangling) — falls into `standalone` so it stays visible.
 *
 * Kept pure + exported so it can be unit-tested without a React renderer.
 */
export function groupStudioEnvironments(
  studios: StudioProduct[],
  envs: CloudEnvironment[],
): StudioGroupsResult {
  const studioEnvIds = new Set(studios.map((s) => s.envId))

  const groups: StudioGroup[] = studios.map((studio) => ({
    studio,
    environments: envs.filter(
      (e) => e.id !== studio.envId && e.state.studioInstanceId === studio.envId,
    ),
  }))

  const grouped = new Set(groups.flatMap((g) => g.environments.map((e) => e.id)))
  const standalone = envs.filter((e) => !studioEnvIds.has(e.id) && !grouped.has(e.id))

  return { groups, standalone }
}

/**
 * The grouped `/user/products` model: studios (from `myStudioProducts`, with
 * status + subdomain + prefix) joined with the caller's environments (from
 * `myEnvironments`, carrying `studioInstanceId`). Both underlying queries are
 * cached + WS-fresh via the app-state coordinator — this hook adds no polling.
 */
export function useStudioGroups() {
  const studio = useStudioProducts()
  const { viewer } = useViewer()
  const environments = useEnvironments('MINE', viewer?.address ?? null)

  const { groups, standalone } = useMemo(
    () => groupStudioEnvironments(studio.products, environments),
    [studio.products, environments],
  )

  return {
    ...studio,
    groups,
    standalone,
  }
}
