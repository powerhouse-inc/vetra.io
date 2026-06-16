'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { fetchClintRuntimeEndpointsByEnv } from '../graphql'
import type { ClintRuntimeEndpointsForPrefix } from '../types'

/**
 * Polls the observability subgraph for clint agents' runtime-announced
 * endpoints, grouped by service prefix. Returns an empty list while
 * loading or when no agent has announced yet (typical for envs with no
 * CLINT services, or services still PROVISIONING).
 *
 * Polling cadence: 15s while the page is open. The agent announces on
 * startup and on endpoint changes, so the latency between change and
 * UI is bounded by this interval.
 */
export function useClintRuntimeEndpoints(
  subdomain: string | null,
  documentId: string,
): {
  byPrefix: Record<string, ClintRuntimeEndpointsForPrefix>
  isLoading: boolean
} {
  const [groups, setGroups] = useState<ClintRuntimeEndpointsForPrefix[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const subdomainRef = useRef(subdomain)
  useLayoutEffect(() => {
    subdomainRef.current = subdomain
  })

  useEffect(() => {
    let cancelled = false
    const tick = async () => {
      const sd = subdomainRef.current
      if (!sd || !documentId) return
      try {
        const result = await fetchClintRuntimeEndpointsByEnv(sd, documentId, null)
        if (!cancelled) {
          setGroups(result)
        }
      } catch {
        // Silent — runtime endpoints are best-effort UI; failure shouldn't
        // disrupt the rest of the page.
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void tick()
    const interval = setInterval(() => void tick(), 15_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [documentId])

  const byPrefix = Object.fromEntries(groups.map((g) => [g.prefix, g]))
  return { byPrefix, isLoading }
}
