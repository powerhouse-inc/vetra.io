'use client'

import { useEffect, useState } from 'react'
import { useDid, useUser } from '@powerhousedao/reactor-browser'
import { fetchClintRuntimeEndpointsByEnv, fetchEnvironment } from '@/modules/cloud/graphql'
import { useViewer } from '@/modules/cloud/hooks/use-environment'
import { queryKeys } from '@/modules/cloud/query/keys'
import { useAuthedQuery } from '@/modules/cloud/query/use-authed-query'
import type { ClintRuntimeEndpointsForPrefix } from '@/modules/cloud/types'
import { findStudioAgents } from './find-studio-agent'
import { buildStudioEmbedUrl } from './studio-embed-url'
import { hasStudioWebsiteEndpoint } from './studio-readiness'
import { getStudioAllowlist, isStudioAllowed } from './allowlist'
import { deriveEmbedStatus, type EmbedStatus } from './embed-status'

export type { EmbedStatus }

type Located = { subdomain: string; prefix: string }

/**
 * Poll until a cross-origin URL is reachable from the browser. `no-cors` fetch
 * resolves (opaque) for any HTTP response but rejects on DNS/connection/TLS
 * failure — exactly the signal we need to know a freshly-provisioned agent's
 * public ingress has propagated before we render it in an iframe.
 */
function useUrlReachable(url: string | null): boolean {
  const [ok, setOk] = useState(false)
  useEffect(() => {
    setOk(false)
    if (!url) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const check = async () => {
      try {
        await fetch(url, { mode: 'no-cors', cache: 'no-store' })
        if (!cancelled) setOk(true)
      } catch {
        if (!cancelled) timer = setTimeout(check, 3000)
      }
    }
    void check()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [url])
  return ok
}

export function useStudioProductEmbed(envId: string): {
  status: EmbedStatus
  embedUrl: string | null
} {
  const user = useUser()
  const did = useDid()
  const { viewer } = useViewer()
  const address = viewer?.address ?? null

  const isAuthed = !!user

  // 1) Resolve THIS env directly by id (no dependency on the myEnvironments
  //    list loading — that two-stage load is what caused the not-found flash).
  //    React Query retries transient failures, so we never flash a false
  //    not-found; `null` data is a real "env missing" answer.
  const { data: full, isError: resolveError } = useAuthedQuery(
    queryKeys.environment(envId, did),
    (token) => fetchEnvironment(envId, token),
    { enabled: isAuthed },
  )
  const match = full ? findStudioAgents([full])[0] : undefined
  const located: Located | null = match
    ? { subdomain: full?.state.genericSubdomain ?? '', prefix: match.service.prefix }
    : null
  let resolution: 'pending' | 'not-found' | 'found'
  if (located) resolution = 'found'
  else if (full === null || (full && !match) || resolveError) resolution = 'not-found'
  else resolution = 'pending'

  // 2) Readiness: poll the agent's announced endpoints (server-side, same-origin
  //    to our switchboard) every 5s once the env is located, stopping once it
  //    serves. `endpointsChecked` distinguishes "not yet checked" (→ loading)
  //    from "checked, not ready" (→ booting), so a booted agent never flashes
  //    "booting".
  const subdomain = located?.subdomain ?? null
  const prefix = located?.prefix ?? null
  const { data: groups, isFetched: endpointsChecked } = useAuthedQuery<
    ClintRuntimeEndpointsForPrefix[]
  >(
    queryKeys.runtimeEndpoints(subdomain ?? '', envId),
    (token) => fetchClintRuntimeEndpointsByEnv(subdomain ?? '', envId, token),
    {
      enabled: !!subdomain && !!prefix,
      refetchInterval: (query) =>
        hasStudioWebsiteEndpoint(query.state.data?.find((g) => g.prefix === prefix)) ? false : 5000,
    },
  )
  const websiteReady = hasStudioWebsiteEndpoint(groups?.find((g) => g.prefix === prefix))

  // 3) Reachability preflight: only probe once the agent is serving.
  const candidateUrl = located
    ? buildStudioEmbedUrl({
        prefix: located.prefix,
        genericSubdomain: located.subdomain,
        genericBaseDomain: null,
        userDid: did,
      })
    : null
  const reachable = useUrlReachable(websiteReady ? candidateUrl : null)

  const status = deriveEmbedStatus({
    authed: isAuthed,
    address,
    allowed: isStudioAllowed(address, getStudioAllowlist()),
    resolution,
    endpointsChecked,
    websiteReady,
    reachable,
  })

  return { status, embedUrl: status === 'ready' ? candidateUrl : null }
}
