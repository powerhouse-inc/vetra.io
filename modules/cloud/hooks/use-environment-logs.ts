'use client'

import { useRenown } from '@powerhousedao/reactor-browser'
import { useState, useEffect, useCallback, useRef } from 'react'
import { getAuthToken, fetchLogs } from '../graphql'
import type { LogEntry, MetricRange, TenantService } from '../types'

export function useEnvironmentLogs(
  subdomain: string | null,
  tenantId: string | null,
  service: TenantService | null,
  range: MetricRange,
  errorsOnly: boolean,
  agent: string | null = null,
) {
  const renown = useRenown()
  const renownRef = useRef(renown)
  renownRef.current = renown
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const logsRef = useRef(logs)
  logsRef.current = logs

  const refresh = useCallback(async () => {
    if (!subdomain || !tenantId) return
    try {
      const token = await getAuthToken(renownRef.current)
      const data = await fetchLogs(subdomain, tenantId, service, range, 500, errorsOnly, token, agent)
      if (JSON.stringify(data) !== JSON.stringify(logsRef.current)) {
        setLogs(data)
      }
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load logs'))
    } finally {
      setIsLoading(false)
    }
  }, [subdomain, tenantId, service, range, errorsOnly, agent])

  useEffect(() => {
    void refresh()
    const interval = setInterval(() => {
      void refresh()
    }, 10_000)
    return () => clearInterval(interval)
  }, [refresh])

  return { logs, isLoading, error, refresh }
}
