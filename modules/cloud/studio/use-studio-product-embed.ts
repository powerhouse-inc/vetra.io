'use client'

import { useEffect, useRef, useState } from 'react'
import { useDid, useRenown, useUser } from '@powerhousedao/reactor-browser'
import {
  fetchClintRuntimeEndpointsByEnv,
  fetchEnvironment,
  getAuthToken,
} from '@/modules/cloud/graphql'
import { useViewer } from '@/modules/cloud/hooks/use-environment'
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
  const renown = useRenown()
  const renownRef = useRef(renown)
  renownRef.current = renown
  const { viewer } = useViewer()
  const address = viewer?.address ?? null

  const isAuthed = !!user
  const userAddress = user?.address ?? null

  // 1) Resolve THIS env directly by id (no dependency on the myEnvironments
  //    list loading — that two-stage load is what caused the not-found flash).
  const [resolution, setResolution] = useState<'pending' | 'not-found' | 'found'>('pending')
  const [located, setLocated] = useState<Located | null>(null)
  useEffect(() => {
    if (!isAuthed) return
    let cancelled = false
    let retry: ReturnType<typeof setTimeout> | undefined
    const run = async () => {
      try {
        const token = await getAuthToken(renownRef.current)
        const full = await fetchEnvironment(envId, token)
        if (cancelled) return
        if (!full) {
          setResolution('not-found')
          return
        }
        const match = findStudioAgents([full])[0]
        if (match) {
          setLocated({ subdomain: full.state.genericSubdomain ?? '', prefix: match.service.prefix })
          setResolution('found')
        } else {
          setResolution('not-found')
        }
      } catch {
        // Transient (network) — retry, stay 'pending' (never a false not-found).
        if (!cancelled) retry = setTimeout(run, 3000)
      }
    }
    void run()
    return () => {
      cancelled = true
      if (retry) clearTimeout(retry)
    }
  }, [isAuthed, userAddress, envId])

  // 2) Readiness: poll the agent's announced endpoints (server-side, same-origin
  //    to our switchboard) every 5s once the env is located. `endpointsChecked`
  //    distinguishes "not yet checked" (→ loading) from "checked, not ready"
  //    (→ booting), so an already-booted agent never flashes "booting".
  const subdomain = located?.subdomain ?? null
  const prefix = located?.prefix ?? null
  const [endpointsChecked, setEndpointsChecked] = useState(false)
  const [websiteReady, setWebsiteReady] = useState(false)
  useEffect(() => {
    if (!subdomain || !prefix) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const tick = async () => {
      try {
        const token = await getAuthToken(renownRef.current)
        const groups = await fetchClintRuntimeEndpointsByEnv(subdomain, envId, token)
        if (cancelled) return
        setEndpointsChecked(true)
        if (hasStudioWebsiteEndpoint(groups.find((g) => g.prefix === prefix))) {
          setWebsiteReady(true)
          return // stop polling once serving
        }
      } catch {
        if (!cancelled) setEndpointsChecked(true)
      }
      if (!cancelled) timer = setTimeout(tick, 5000)
    }
    void tick()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [subdomain, prefix, envId])

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
