'use client'

import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useDid, useUser } from '@powerhousedao/reactor-browser'
import { fetchMyStudioProducts, type StudioProductSummary } from '@/modules/cloud/graphql'
import { queryKeys } from '@/modules/cloud/query/keys'
import { useAuthedQuery } from '@/modules/cloud/query/use-authed-query'
import { myAccessStatus } from '@/modules/invites/lib/client'
import { STUDIO_AGENT_PREFIX, STUDIO_ENV_LABEL } from './constants'
import { type ProductBrand } from './fetch-product-brand'
import { type ProductStatus } from './studio-readiness'
import { useCreateStudioEnvironment } from './use-create-studio-environment'

export type StudioGate = 'loading' | 'unauthenticated' | 'ready'

export type StudioProduct = {
  envId: string
  subdomain: string
  prefix: string
  label: string
  /**
   * Brand metadata is resolved lazily per card (only once `status === 'ready'`)
   * so the list never blocks on a per-product host fetch. It stays `null` here.
   */
  brand: ProductBrand | null
  status: ProductStatus
}

export type StudioProductsState = {
  gate: StudioGate
  products: StudioProduct[]
  /** True during the first load when there is no cached data to paint yet. */
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

/**
 * Map a server-resolved product summary onto the UI model. The switchboard
 * already returns the filtered, status-resolved set, so this is a pure shape
 * adapter — brand stays `null` and is filled in lazily by the card.
 */
function toStudioProduct(summary: StudioProductSummary): StudioProduct {
  return {
    envId: summary.envId,
    subdomain: summary.subdomain,
    prefix: summary.prefix,
    label: summary.label,
    brand: null,
    status: summary.status,
  }
}

export function useStudioProducts(): StudioProductsState {
  const user = useUser()
  const did = useDid()
  const queryClient = useQueryClient()

  const isAuthed = !!user

  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const create = useCreateStudioEnvironment()

  // One round-trip to the switchboard for the whole list. The backend filters
  // to the caller's products and resolves each product's status, so there is no
  // client-side env scan, no N+1 fetchEnvironment, and no per-product readiness
  // derivation. Polls every 30s and paints instantly from the persisted cache
  // on return visits.
  const productsKey = queryKeys.studioProducts(did)
  const { data, isLoading } = useAuthedQuery<StudioProduct[]>(
    productsKey,
    async (token) => (await fetchMyStudioProducts(token)).map(toStudioProduct),
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
        // Optimistically insert a booting placeholder so the new product shows
        // up immediately, then let the 30s poll (and the invalidate below)
        // reconcile it against the server-resolved list. Guard against a double
        // insert if the env already appears (e.g. a fast refetch raced us).
        const placeholder: StudioProduct = {
          envId: res.documentId,
          subdomain: res.subdomain ?? '',
          prefix: STUDIO_AGENT_PREFIX,
          label: STUDIO_ENV_LABEL,
          brand: null,
          status: 'booting',
        }
        queryClient.setQueryData<StudioProduct[]>(productsKey, (prev) => {
          const list = prev ?? []
          if (list.some((p) => p.envId === placeholder.envId)) return list
          return [...list, placeholder]
        })
        void queryClient.invalidateQueries({ queryKey: productsKey })
        return res.documentId
      } catch (err) {
        setCreateError(err instanceof Error ? err.message : 'Failed to create product')
        throw err
      } finally {
        setCreating(false)
      }
    },
    [create, queryClient, productsKey],
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
