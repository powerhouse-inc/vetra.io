'use client'

import { useRenownAuthAsync, useRenownSessionSynced } from '@powerhousedao/reactor-browser/renown'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { useLoginModal } from '@/modules/shared/components/renown/login-modal-context'

// Handles the client-side auth transitions the server redirects miss (those only
// run on a fresh request): after login enter the dashboard, after logout leave gated.
export function AuthRedirect() {
  const { state } = useRenownAuthAsync()
  const sessionSynced = useRenownSessionSynced()
  const { open, closeLogin } = useLoginModal()
  const pathname = usePathname()
  const router = useRouter()
  // One post-login navigation per session (resets on logout) so a bounce can't
  // become a redirect loop.
  const navigated = useRef(false)

  useEffect(() => {
    if (state === 'resolving') return

    const onGated =
      pathname === '/user' || pathname.startsWith('/user/') || pathname.startsWith('/profile')

    if (state === 'unauthenticated') {
      navigated.current = false
      // Logout while on a gated route: close the modal and return to home.
      if (onGated) {
        closeLogin()
        router.replace('/')
      }
      return
    }

    // Authenticated: close the modal, then (once the cookie is synced so the proxy
    // sees it) send a home-page visitor to the dashboard.
    if (open) closeLogin()
    if (!sessionSynced || navigated.current) return
    if (pathname === '/') {
      navigated.current = true
      // Hard nav (not router.replace): a logged-out prefetch cached the /user -> /
      // 307, and a soft transition reuses it; a document load re-runs middleware.
      window.location.replace('/user')
    }
  }, [state, sessionSynced, open, pathname, router, closeLogin])

  return null
}
