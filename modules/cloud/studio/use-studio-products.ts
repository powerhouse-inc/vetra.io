'use client'

import { useCallback, useState } from 'react'
import { useDid, useUser } from '@powerhousedao/reactor-browser'
import { fetchClintRuntimeEndpointsByEnv, fetchEnvironment } from '@/modules/cloud/graphql'
import { useEnvironments, useViewer } from '@/modules/cloud/hooks/use-environment'
import { queryKeys } from '@/modules/cloud/query/keys'
import { useAuthedQuery } from '@/modules/cloud/query/use-authed-query'
import type { CloudEnvironment } from '@/modules/cloud/types'
import { findStudioAgents } from './find-studio-agent'
import { fetchProductBrand, type ProductBrand } from './fetch-product-brand'
import { deriveProductStatus, type ProductStatus } from './studio-readiness'
import { getStudioAllowlist, isStudioAllowed } from './allowlist'
import { useCreateStudioEnvironment } from './use-create-studio-environment'

export type StudioGate = 'loading' | 'unauthenticated' | 'not-allowed' | 'ready'

export type StudioProduct = {
  envId: string
  subdomain: string
  prefix: string
  label: string
  brand: ProductBrand | null
  status: ProductStatus
}

export type StudioProductsState = {
  gate: StudioGate
  products: StudioProduct[]
  isScanning: boolean
  creating: boolean
  createError: string | null
  /** Provision a new product env; resolves to the new env id for navigation. */
  createProduct: (anthropicApiKey: string) => Promise<string>
  did: string | undefined
}

/** Scan a set of env summaries into resolved studio products (detail + brand + status). */
async function scanProducts(
  environments: CloudEnvironment[],
  token: string | null,
): Promise<StudioProduct[]> {
  const details: CloudEnvironment[] = []
  for (const summary of environments) {
    const full = await fetchEnvironment(summary.id, token)
    if (full) details.push(full)
  }
  const matches = findStudioAgents(details)
  return Promise.all(
    matches.map(async ({ env, service }): Promise<StudioProduct> => {
      const subdomain = env.state.genericSubdomain ?? ''
      const [brand, groups] = await Promise.all([
        fetchProductBrand({ subdomain, prefix: service.prefix, token }),
        fetchClintRuntimeEndpointsByEnv(subdomain, env.id, token).catch(() => []),
      ])
      const group = groups.find((g) => g.prefix === service.prefix)
      return {
        envId: env.id,
        subdomain,
        prefix: service.prefix,
        label: env.state.label ?? env.name,
        brand,
        status: deriveProductStatus(group),
      }
    }),
  )
}

export function useStudioProducts(): StudioProductsState {
  const user = useUser()
  const did = useDid()
  const { viewer } = useViewer()
  const address = viewer?.address ?? null
  const environments = useEnvironments('MINE', address)

  const isAuthed = !!user
  const allowed = isStudioAllowed(address, getStudioAllowlist())

  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const create = useCreateStudioEnvironment()

  // SWR scan: keyed by the env-id set so it revalidates when the list changes,
  // and paints instantly from the persisted product list on return visits.
  const summaryIds = environments.map((e) => e.id).join(',')
  const { data, isLoading } = useAuthedQuery<StudioProduct[]>(
    [...queryKeys.studioProducts(did), summaryIds],
    (token) => scanProducts(environments, token),
    { enabled: isAuthed && allowed, refetchInterval: 30_000 },
  )
  const products = data ?? []
  const isScanning = isLoading && !data

  const createProduct = useCallback(
    async (anthropicApiKey: string): Promise<string> => {
      setCreateError(null)
      setCreating(true)
      try {
        const res = await create({ anthropicApiKey })
        return res.documentId
      } catch (err) {
        setCreateError(err instanceof Error ? err.message : 'Failed to create product')
        throw err
      } finally {
        setCreating(false)
      }
    },
    [create],
  )

  let gate: StudioGate
  if (!user) gate = 'unauthenticated'
  else if (!allowed) gate = address ? 'not-allowed' : 'loading'
  else gate = 'ready'

  return { gate, products, isScanning, creating, createError, createProduct, did }
}
