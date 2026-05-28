'use client'

import { useRenown } from '@powerhousedao/reactor-browser'
import { useCallback, useEffect, useRef, useState } from 'react'

import { fetchRuntimeConfig, getAuthToken, setRuntimeConfig } from '../graphql'
import type {
  PHConnectRuntimeConfig,
  RuntimeConfigPayload,
} from '@/modules/cloud/runtime-config/types'

const EMPTY_PAYLOAD: RuntimeConfigPayload = {
  effective: {},
  overrides: {},
  schemaVersion: '',
  updatedAt: null,
}

/**
 * Read + write Connect's runtime config for a given tenant via the
 * `vetra-cloud-runtime-config` subgraph (`runtimeConfig` query /
 * `setRuntimeConfig` mutation). The subgraph stores the user-set overrides
 * as a single PH_CONNECT_CONFIG_JSON env_vars row, and returns:
 *   - `effective`: DEFAULT_CONNECT_CONFIG merged with overrides
 *   - `overrides`: only the keys the user has explicitly set
 *
 * The UI works with the `connect.*` subtree; the GraphQL layer
 * (`fetchRuntimeConfig` / `setRuntimeConfig`) unwraps `.connect` on read
 * and wraps `{ connect: ... }` on write so callers see PHConnectRuntimeConfig.
 */
export function useRuntimeConfig(tenantId: string | null) {
  const renown = useRenown()
  const renownRef = useRef(renown)
  renownRef.current = renown

  const [payload, setPayload] = useState<RuntimeConfigPayload>(EMPTY_PAYLOAD)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    if (!tenantId) {
      setPayload(EMPTY_PAYLOAD)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const token = await getAuthToken(renownRef.current)
      const result = await fetchRuntimeConfig(tenantId, token)
      setPayload({
        effective: result.effective as PHConnectRuntimeConfig,
        overrides: result.overrides as PHConnectRuntimeConfig,
        schemaVersion: result.schemaVersion,
        updatedAt: result.updatedAt,
      })
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load runtime config'))
    } finally {
      setIsLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const setOverrides = useCallback(
    async (nextOverrides: PHConnectRuntimeConfig) => {
      if (!tenantId) throw new Error('Missing tenantId')
      setIsSaving(true)
      setError(null)
      try {
        const token = await getAuthToken(renownRef.current)
        const result = await setRuntimeConfig(
          tenantId,
          nextOverrides as Record<string, unknown>,
          token,
        )
        setPayload({
          effective: result.effective as PHConnectRuntimeConfig,
          overrides: result.overrides as PHConnectRuntimeConfig,
          schemaVersion: result.schemaVersion,
          updatedAt: result.updatedAt,
        })
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Failed to save runtime config')
        setError(e)
        throw e
      } finally {
        setIsSaving(false)
      }
    },
    [tenantId],
  )

  return {
    payload,
    isLoading,
    isSaving,
    error,
    refresh,
    setOverrides,
  }
}
