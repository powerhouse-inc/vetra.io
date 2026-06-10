'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useDid, useRenown, useUser } from '@powerhousedao/reactor-browser'
import {
  fetchClintRuntimeEndpointsByEnv,
  fetchEnvironment,
  getAuthToken,
} from '@/modules/cloud/graphql'
import { useEnvironments, useViewer } from '@/modules/cloud/hooks/use-environment'
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

export function useStudioProducts(): StudioProductsState {
  const user = useUser()
  const did = useDid()
  const renown = useRenown()
  const renownRef = useRef(renown)
  renownRef.current = renown
  const { viewer } = useViewer()
  const address = viewer?.address ?? null
  const environments = useEnvironments('MINE', address)

  // Stable identity key for the scan effect (the renown.user OBJECT churns on
  // every "user" event — depending on it would re-fetch every env in a loop).
  const isAuthed = !!user
  const userAddress = user?.address ?? null

  const [products, setProducts] = useState<StudioProduct[]>([])
  const [isScanning, setIsScanning] = useState(true)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const create = useCreateStudioEnvironment()

  const summaryIds = environments.map((e) => e.id).join(',')
  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!isAuthed) return
      try {
        const token = await getAuthToken(renownRef.current)
        const details: CloudEnvironment[] = []
        for (const summary of environments) {
          const full = await fetchEnvironment(summary.id, token)
          if (full) details.push(full)
        }
        const matches = findStudioAgents(details)
        const resolved = await Promise.all(
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
        if (!cancelled) {
          setProducts(resolved)
          setIsScanning(false)
        }
      } catch {
        if (!cancelled) setIsScanning(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed, userAddress, summaryIds])

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
  else if (!isStudioAllowed(address, getStudioAllowlist()))
    gate = address ? 'not-allowed' : 'loading'
  else gate = 'ready'

  return { gate, products, isScanning, creating, createError, createProduct, did }
}
