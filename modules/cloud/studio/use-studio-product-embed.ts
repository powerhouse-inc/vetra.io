'use client'

import { useEffect, useRef, useState } from 'react'
import { useDid, useRenown, useUser } from '@powerhousedao/reactor-browser'
import { fetchEnvironment, getAuthToken } from '@/modules/cloud/graphql'
import { useEnvironments, useViewer } from '@/modules/cloud/hooks/use-environment'
import { useClintRuntimeEndpoints } from '@/modules/cloud/hooks/use-clint-runtime-endpoints'
import type { CloudEnvironment } from '@/modules/cloud/types'
import { findStudioAgents } from './find-studio-agent'
import { buildStudioEmbedUrl } from './studio-embed-url'
import { hasStudioWebsiteEndpoint } from './studio-readiness'
import { getStudioAllowlist, isStudioAllowed } from './allowlist'

export type EmbedStatus =
  | 'loading'
  | 'unauthenticated'
  | 'not-allowed'
  | 'not-found'
  | 'booting'
  | 'ready'

export function useStudioProductEmbed(envId: string): {
  status: EmbedStatus
  embedUrl: string | null
} {
  const user = useUser()
  const did = useDid()
  const renown = useRenown()
  const renownRef = useRef(renown)
  renownRef.current = renown
  const { viewer } = useViewer()
  const address = viewer?.address ?? null
  const environments = useEnvironments('MINE', address)

  const isAuthed = !!user
  const userAddress = user?.address ?? null

  const [located, setLocated] = useState<{ subdomain: string; prefix: string } | null>(null)
  const [scanned, setScanned] = useState(false)

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
        const match = findStudioAgents(details).find((m) => m.env.id === envId)
        if (!cancelled) {
          if (match)
            setLocated({
              subdomain: match.env.state.genericSubdomain ?? '',
              prefix: match.service.prefix,
            })
          setScanned(true)
        }
      } catch {
        if (!cancelled) setScanned(true)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed, userAddress, summaryIds, envId])

  const { byPrefix } = useClintRuntimeEndpoints(located?.subdomain ?? null, envId)
  const ready = located ? hasStudioWebsiteEndpoint(byPrefix[located.prefix]) : false

  let status: EmbedStatus
  if (!user) status = 'unauthenticated'
  else if (!isStudioAllowed(address, getStudioAllowlist()))
    status = address ? 'not-allowed' : 'loading'
  else if (located) status = ready ? 'ready' : 'booting'
  else if (!scanned) status = 'loading'
  else status = 'not-found'

  const embedUrl =
    status === 'ready' && located
      ? buildStudioEmbedUrl({
          prefix: located.prefix,
          genericSubdomain: located.subdomain,
          genericBaseDomain: null,
          userDid: did,
        })
      : null

  return { status, embedUrl }
}
