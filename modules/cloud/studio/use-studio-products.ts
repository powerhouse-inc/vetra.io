'use client'

import { useCallback, useState } from 'react'
import { useDid, useUser } from '@powerhousedao/reactor-browser'
import { fetchClintRuntimeEndpointsByEnv, fetchEnvironment } from '@/modules/cloud/graphql'
import { useEnvironments, useViewer } from '@/modules/cloud/hooks/use-environment'
import { queryKeys } from '@/modules/cloud/query/keys'
import { useAuthedQuery } from '@/modules/cloud/query/use-authed-query'
import { myAccessStatus } from '@/modules/invites/lib/client'
import type { CloudEnvironment } from '@/modules/cloud/types'
import { findStudioAgents } from './find-studio-agent'
import { fetchProductBrand, type ProductBrand } from './fetch-product-brand'
import { deriveProductStatus, type ProductStatus } from './studio-readiness'
import { useCreateStudioEnvironment } from './use-create-studio-environment'

export type StudioGate = 'loading' | 'unauthenticated' | 'ready'

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
  /**
   * Provision a new product env; resolves to the new env id for navigation.
   * Omit the key when the caller's invite code carries one (`hasAttachedKey`) —
   * the subgraph then injects it server-side.
   */
  createProduct: (anthropicApiKey?: string) => Promise<string>
  /** True when the caller's redeemed code has a Claude key, so no manual entry is needed. */
  hasAttachedKey: boolean
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
      // Ask switchboard for readiness FIRST, and only touch the per-tenant
      // host (for the brand) once it reports a live website endpoint.
      //
      // Why: fetchProductBrand does a browser fetch to
      // https://<prefix>.<subdomain>.vetra.io. For a just-created product the
      // DNS record doesn't exist yet (external-dns creates it after the
      // ingress is admitted), so the browser's lookup returns NXDOMAIN and the
      // resolver NEGATIVE-CACHES it for the vetra.io zone's SOA minimum (1h).
      // That poisoned cache then breaks the user's actual navigation to the
      // studio for up to an hour. switchboard's pull-worker only reports
      // endpoints after it has itself reached the agent over that same public
      // host, so a 'ready' status guarantees the host already resolves —
      // making this the safe moment for the browser to hit it.
      const groups = await fetchClintRuntimeEndpointsByEnv(subdomain, env.id, token).catch(() => [])
      const group = groups.find((g) => g.prefix === service.prefix)
      const status = deriveProductStatus(group)
      const brand =
        status === 'ready'
          ? await fetchProductBrand({ subdomain, prefix: service.prefix, token })
          : null
      return {
        envId: env.id,
        subdomain,
        prefix: service.prefix,
        label: env.state.label ?? env.name,
        brand,
        status,
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

  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const create = useCreateStudioEnvironment()

  // SWR scan: keyed by the env-id set so it revalidates when the list changes,
  // and paints instantly from the persisted product list on return visits.
  const summaryIds = environments.map((e) => e.id).join(',')
  const { data, isLoading } = useAuthedQuery<StudioProduct[]>(
    [...queryKeys.studioProducts(did), summaryIds],
    (token) => scanProducts(environments, token),
    { enabled: isAuthed, refetchInterval: 30_000 },
  )
  const products = data ?? []
  const isScanning = isLoading && !data

  // Whether the caller's redeemed code carries a key, so the create flow can
  // skip the manual Anthropic-key prompt and let the subgraph inject it.
  const { data: access } = useAuthedQuery(
    ['vetra-access-status', did],
    (token) => (token ? myAccessStatus(token) : Promise.resolve(null)),
    { enabled: isAuthed },
  )
  const hasAttachedKey = access?.hasAttachedKey ?? false

  const createProduct = useCallback(
    async (anthropicApiKey?: string): Promise<string> => {
      setCreateError(null)
      setCreating(true)
      try {
        const res = await create(anthropicApiKey ? { anthropicApiKey } : {})
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
  else gate = 'ready'

  return {
    gate,
    products,
    isScanning,
    creating,
    createError,
    createProduct,
    hasAttachedKey,
    did,
  }
}
