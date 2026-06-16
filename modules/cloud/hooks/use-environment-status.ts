'use client'

import { useRenown } from '@powerhousedao/reactor-browser'
import { useState, useEffect, useCallback, useLayoutEffect, useRef } from 'react'
import { getAuthToken, fetchEnvironmentOverview } from '../graphql'
import { useDocumentSubscription } from './use-document-subscription'
import type { EnvironmentStatus, Pod } from '../types'

export function useEnvironmentStatus(
  subdomain: string | null,
  tenantId: string | null,
  documentId?: string | null,
) {
  const renown = useRenown()
  const renownRef = useRef(renown)
  const [status, setStatus] = useState<EnvironmentStatus | null>(null)
  const [pods, setPods] = useState<Pod[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const statusRef = useRef(status)
  const podsRef = useRef(pods)
  useLayoutEffect(() => {
    renownRef.current = renown
    statusRef.current = status
    podsRef.current = pods
  })

  const refresh = useCallback(async () => {
    if (!subdomain || !tenantId) return
    try {
      const token = await getAuthToken(renownRef.current)
      const { status: s, pods: p } = await fetchEnvironmentOverview(subdomain, tenantId, token)
      if (JSON.stringify(s) !== JSON.stringify(statusRef.current)) setStatus(s)
      if (JSON.stringify(p) !== JSON.stringify(podsRef.current)) setPods(p)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load status'))
    } finally {
      setIsLoading(false)
    }
  }, [subdomain, tenantId])

  useEffect(() => {
    void refresh()
    const interval = setInterval(() => {
      void refresh()
    }, 15_000)
    return () => clearInterval(interval)
  }, [refresh])

  // Subscribe to document changes via WebSocket — triggers refresh on any update
  useDocumentSubscription(documentId ?? null, () => {
    void refresh()
  })

  return { status, pods, isLoading, error, refresh }
}
