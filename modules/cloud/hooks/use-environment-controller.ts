'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { VetraCloudEnvironmentState } from '@powerhousedao/vetra-cloud-package/document-models/vetra-cloud-environment'
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
 * Loads a vetra-cloud-environment document into a `RemoteDocumentController`
 * tied to the user's Renown signer. Subscribes to controller changes so
 * React re-renders when the underlying state mutates.
 */
export function useEnvironmentController(
  documentId: string | null,
): UseEnvironmentControllerResult {
  const { signer } = useCanSign()
  const [controller, setController] = useState<EnvironmentController | null>(null)
  const controllerRef = useRef<EnvironmentController | null>(null)
  const [state, setState] = useState<VetraCloudEnvironmentState | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!signer || !documentId) {
      setIsLoading(false)
      return
    }
    let cancelled = false
    let unsubscribe: (() => void) | undefined
    setIsLoading(true)
    setError(null)
    void (async () => {
      try {
        const ctrl = await loadEnvironmentController({ documentId, signer })
        if (cancelled) return
        controllerRef.current = ctrl
        setController(ctrl)
        setState(ctrl.state.global)
        unsubscribe = ctrl.onChange(() => {
          setState(ctrl.state.global)
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
  }, [documentId, signer])

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
