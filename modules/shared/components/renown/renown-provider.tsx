'use client'

import { addRenownEventHandler, login, setRenown } from '@powerhousedao/reactor-browser'
import { RenownBuilder } from '@renown/sdk'
import { useEffect, useRef } from 'react'

/**
 * Captures the `?user` DID from the URL at module load time, before the
 * Renown SDK can consume and remove it. This allows us to retry the login
 * if the SDK's initial attempt fails or the React UI doesn't reflect it.
 */
function captureUserDid(): string | undefined {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams(window.location.search)
  const user = params.get('user')
  return user ? decodeURIComponent(user) : undefined
}

const capturedUserDid = captureUserDid()

/**
 * After the Renown SDK initializes, checks if the session was established.
 * If not (e.g. due to a race condition between credential indexing and the
 * SDK's login attempt), retries the login using the captured DID.
 */
function RenownLoginGuard() {
  const didRef = useRef(capturedUserDid)

  useEffect(() => {
    const userDid = didRef.current
    if (!userDid) return

    didRef.current = undefined
    let cancelled = false

    const attempt = async () => {
      const maxWaitMs = 15_000
      const pollMs = 500
      const start = Date.now()

      while (Date.now() - start < maxWaitMs) {
        if (cancelled) return

        const renown = (window as Window).ph?.renown
        if (renown && renown.status === 'authorized') return

        if (renown && typeof renown.login === 'function') {
          try {
            await renown.login(userDid)
            return
          } catch {
            // credential may not be indexed yet — retry
          }
        }

        await new Promise((r) => setTimeout(r, pollMs))
      }
    }

    // Give the SDK a moment to handle it first
    const timeout = setTimeout(attempt, 1500)

    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [])

  return null
}

/**
 * Runs the SDK init from an effect instead of rendering the package's `<Renown />`,
 * whose dev.244 build inits during render — its synchronous `setRenown` updates
 * `useSyncExternalStore` subscribers mid-render, triggering React's "update a
 * component while rendering a different component" error. Fixed upstream in
 * reactor-browser@6.1.0-dev.13.
 */
function useRenownInitEffect(appName: string, url?: string) {
  const initRef = useRef(false)

  useEffect(() => {
    // Ref guard keeps init to once per mount, surviving StrictMode remounts.
    if (initRef.current) return
    initRef.current = true

    const init = async () => {
      addRenownEventHandler()
      setRenown(null)
      const renown = await new RenownBuilder(appName, { baseUrl: url }).build()
      setRenown(renown)
      await login(undefined, renown)
    }

    init().catch((err) => {
      console.error('[renown] Failed to initialize Renown SDK:', err)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read once on mount
  }, [])
}

export function RenownProvider({ appName, url }: { appName: string; url?: string }) {
  useRenownInitEffect(appName, url)

  return <RenownLoginGuard />
}
