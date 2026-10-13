'use client'

import { useState, useEffect, useRef, useCallback, useContext } from 'react'
import { QueryClientContext, type QueryClient } from '@tanstack/react-query'
import type { VetraCloudEnvironmentState } from '@powerhousedao/vetra-cloud-package/document-models/vetra-cloud-environment'
import { DRIVE_ID } from '../client'
import { loadEnvironmentController, type EnvironmentController } from '../controller'
import { useCanSign } from './use-can-sign'

export type UseEnvironmentControllerResult = {
  controller: EnvironmentController | null
  state: VetraCloudEnvironmentState | null
  isLoading: boolean
  error: Error | null
  refresh: () => Promise<void>
}

/**
 * The env's organisation as the cached env lists know it: a string (org env),
 * `null` (personal) or `undefined` (not listed, or a backend without the field).
 */
export function cachedOwnerOrgId(
  client: QueryClient | undefined,
  documentId: string,
): string | null | undefined {
  if (!client) return undefined
  let found: string | null | undefined
  for (const [, data] of client.getQueriesData<unknown>({ queryKey: ['environments'] })) {
    if (!Array.isArray(data)) continue
    for (const item of data as Array<{ id?: unknown; ownerOrgId?: unknown }>) {
      if (item?.id !== documentId) continue
      if (typeof item.ownerOrgId === 'string') return item.ownerOrgId
      if (item.ownerOrgId === null) found = null
    }
  }
  return found
}

/**
 * Loads a vetra-cloud-environment document into a `RemoteDocumentController`
 * tied to the user's Renown signer. Subscribes to controller changes so
 * React re-renders when the underlying state mutates.
 */
export function useEnvironmentController(
  documentId: string | null,
): UseEnvironmentControllerResult {
  const { signer } = useCanSign()
  const queryClient = useContext(QueryClientContext)
  const [controller, setController] = useState<EnvironmentController | null>(null)
  const controllerRef = useRef<EnvironmentController | null>(null)
  const [state, setState] = useState<VetraCloudEnvironmentState | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!signer || !documentId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsLoading(false)
      return
    }
    let cancelled = false
    let unsubscribe: (() => void) | undefined
    setIsLoading(true)
    setError(null)
    void (async () => {
      try {
        const ctrl = await loadEnvironmentController({
          documentId,
          parentIdentifier: DRIVE_ID,
          signer,
          // Known org envs refresh the caller's grant before the pull.
          ownerOrgId: cachedOwnerOrgId(queryClient, documentId),
        })
        if (cancelled) return
        controllerRef.current = ctrl
        setController(ctrl)
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        setState(ctrl.state.global as VetraCloudEnvironmentState)
        unsubscribe = ctrl.onChange(() => {
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
          setState(ctrl.state.global as VetraCloudEnvironmentState)
        })
        setIsLoading(false)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err : new Error('Failed to load environment'))
        setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
      unsubscribe?.()
      controllerRef.current = null
      setController(null)
    }
  }, [documentId, signer, queryClient])

  const refresh = useCallback(async () => {
    if (controllerRef.current) {
      await controllerRef.current.pull()
    }
  }, [])

  return {
    controller,
    state,
    isLoading,
    error,
    refresh,
  }
}
