'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useDid, useRenown, useUser } from '@powerhousedao/reactor-browser'
import { fetchEnvironment, getAuthToken } from '@/modules/cloud/graphql'
import { useEnvironments, useViewer } from '@/modules/cloud/hooks/use-environment'
import { useClintRuntimeEndpoints } from '@/modules/cloud/hooks/use-clint-runtime-endpoints'
import type { CloudEnvironment } from '@/modules/cloud/types'
import { findStudioAgent } from './find-studio-agent'
import { buildStudioEmbedUrl } from './studio-embed-url'
import { hasStudioWebsiteEndpoint } from './studio-readiness'
import { getStudioAllowlist, isStudioAllowed } from './allowlist'
import { STUDIO_AGENT_PREFIX } from './constants'
import { useCreateStudioEnvironment } from './use-create-studio-environment'

export type StudioStatus =
  | 'loading'
  | 'unauthenticated'
  | 'not-allowed'
  | 'none'
  | 'creating'
  | 'booting'
  | 'ready'
  | 'error'

export type StudioEnvironmentState = {
  status: StudioStatus
  embedUrl: string | null
  error: string | null
  create: (anthropicApiKey: string) => Promise<void>
  retry: () => void
}

type Located = { documentId: string; subdomain: string; prefix: string } | null

export function useStudioEnvironment(): StudioEnvironmentState {
  const user = useUser()
  const did = useDid()
  const renown = useRenown()
  const renownRef = useRef(renown)
  renownRef.current = renown
  const { viewer } = useViewer()
  const address = viewer?.address ?? null
  const environments = useEnvironments('MINE', address)

  const [located, setLocated] = useState<Located>(null)
  const [scanned, setScanned] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const create = useCreateStudioEnvironment()

  // Scan the user's environments' full details for a vetra-cli agent. Summaries
  // don't carry services, so each candidate needs a detail fetch.
  const summaryIds = environments.map((e) => e.id).join(',')
  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!user) return
      try {
        const token = await getAuthToken(renownRef.current)
        const details: CloudEnvironment[] = []
        for (const summary of environments) {
          const full = await fetchEnvironment(summary.id, token)
          if (full) details.push(full)
        }
        const match = findStudioAgent(details)
        if (!cancelled) {
          if (match) {
            setLocated({
              documentId: match.env.id,
              subdomain: match.env.state.genericSubdomain ?? '',
              prefix: match.service.prefix,
            })
          }
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
  }, [user, summaryIds])

  // Runtime endpoints for the located studio drive the booting → ready flip.
  const { byPrefix } = useClintRuntimeEndpoints(
    located?.subdomain ?? null,
    located?.documentId ?? '',
  )
  const ready = located ? hasStudioWebsiteEndpoint(byPrefix[located.prefix]) : false

  const handleCreate = useCallback(
    async (anthropicApiKey: string) => {
      setError(null)
      setCreating(true)
      try {
        const res = await create({ anthropicApiKey })
        // Jump straight to booting on the new env, before the list refreshes.
        setLocated({
          documentId: res.documentId,
          subdomain: res.subdomain,
          prefix: STUDIO_AGENT_PREFIX,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create studio')
      } finally {
        setCreating(false)
      }
    },
    [create],
  )

  const retry = useCallback(() => setError(null), [])

  const embedUrl = located
    ? buildStudioEmbedUrl({
        prefix: located.prefix,
        genericSubdomain: located.subdomain,
        genericBaseDomain: null,
        userDid: did,
      })
    : null

  let status: StudioStatus
  if (!user) status = 'unauthenticated'
  else if (error) status = 'error'
  else if (creating) status = 'creating'
  else if (located) status = ready ? 'ready' : 'booting'
  else if (!isStudioAllowed(address, getStudioAllowlist()))
    status = address ? 'not-allowed' : 'loading'
  else if (!scanned) status = 'loading'
  else status = 'none'

  return {
    status,
    embedUrl: status === 'ready' ? embedUrl : null,
    error,
    create: handleCreate,
    retry,
  }
}
