'use client'

import { useRenownAuthAsync, useRenownSessionSynced } from '@powerhousedao/reactor-browser/renown'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useRef } from 'react'
import { useLoginModal } from '@/modules/shared/components/renown/login-modal-context'
import {
  LOGIN_PARAM,
  NEXT_PARAM,
  isGatedPath,
  loggedOutDestination,
  safeNextPath,
} from '@/modules/landing/lib/routes'

/** Shown as the login dialog title when the proxy bounced a visitor off a gated page. */
export const LOGIN_TO_CONTINUE = 'Log in to continue'

/**
 * After a logout on a gated page the post-logout refetch of that page hits the proxy
 * and lands on `?login=1`; ignore the flag for this long so the dialog doesn't reopen.
 */
const LOGOUT_GRACE_MS = 10_000

// Handles the client-side auth transitions the server redirects miss (those only run
// on a fresh request): open the login dialog when the proxy bounced a visitor here
// (?login=1), after login return to `?next=` (or enter the dashboard from home), and
// after logout leave the gated area.
export function AuthRedirect() {
  // useSearchParams needs a Suspense boundary on statically rendered pages.
  return (
    <Suspense fallback={null}>
      <AuthRedirectInner />
    </Suspense>
  )
}

function AuthRedirectInner() {
  const { state } = useRenownAuthAsync()
  const sessionSynced = useRenownSessionSynced()
  const { open, closeLogin, openLoginWithMessage } = useLoginModal()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  // One post-login navigation per session (resets on logout) so a bounce can't
  // become a redirect loop.
  const navigated = useRef(false)
  const wasAuthenticated = useRef(false)
  const loggedOutAt = useRef(0)

  const loginRequested = searchParams.get(LOGIN_PARAM) === '1'
  // Only a gated page is a post-login target: anything else could loop back here.
  const nextParam = safeNextPath(searchParams.get(NEXT_PARAM))
  const next = nextParam && isGatedPath(nextParam) ? nextParam : null
  const search = searchParams.toString()

  useEffect(() => {
    if (state === 'resolving') return

    if (state === 'unauthenticated') {
      navigated.current = false
      if (wasAuthenticated.current) {
        wasAuthenticated.current = false
        loggedOutAt.current = Date.now()
      }
      // Logout (or no in-browser login) on a gated route: close the modal and leave
      // the gated area. The session cookie can outlive the in-browser Renown state
      // (cleared site data, another browser profile); the server would then redirect
      // `/` straight back to /user, forever. Clear the cookie before leaving.
      if (isGatedPath(pathname)) {
        closeLogin()
        const destination = loggedOutDestination(pathname)
        void fetch('/api/renown/session', { method: 'DELETE' })
          .catch(() => undefined)
          .finally(() => router.replace(destination))
        return
      }
      if (loginRequested) {
        // Consume the flag (keep `next`, so a later "Log in" still returns there).
        const params = new URLSearchParams(search)
        params.delete(LOGIN_PARAM)
        const qs = params.toString()
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
        if (Date.now() - loggedOutAt.current > LOGOUT_GRACE_MS) {
          openLoginWithMessage(LOGIN_TO_CONTINUE)
        }
      }
      return
    }

    // Authenticated: close the modal, then (once the cookie is synced so the proxy
    // sees it) go to `next`, or send a home-page visitor to the dashboard.
    wasAuthenticated.current = true
    if (open) closeLogin()
    if (!sessionSynced || navigated.current) return
    const target = next ?? (pathname === '/' ? '/user' : null)
    if (target) {
      navigated.current = true
      // Hard nav (not router.replace): a logged-out prefetch cached the gated-route
      // 307, and a soft transition reuses it; a document load re-runs the proxy.
      window.location.replace(target)
    }
  }, [
    state,
    sessionSynced,
    open,
    pathname,
    search,
    loginRequested,
    next,
    router,
    closeLogin,
    openLoginWithMessage,
  ])

  return null
}
