'use client'

import { useRenownAuthAsync, useRenownSessionSynced } from '@powerhousedao/reactor-browser/renown'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { useLoginModal } from '@/modules/shared/components/renown/login-modal-context'

// Handles the client-side auth transitions the server redirects miss (those only
// run on a fresh request): after login enter the target, after logout leave gated.
export function AuthRedirect() {
  const { state } = useRenownAuthAsync()
  const sessionSynced = useRenownSessionSynced()
  const { open, from, closeLogin, clearFrom } = useLoginModal()
  const pathname = usePathname()
  const router = useRouter()
  // One post-login navigation per session (resets on logout) so a bounce (cookie
  // not yet honored) can't become a redirect loop.
  const navigated = useRef(false)

  useEffect(() => {
    if (state === 'resolving') return

    const onGated =
      pathname === '/user' || pathname.startsWith('/user/') || pathname.startsWith('/profile')

    if (state === 'unauthenticated') {
      navigated.current = false
      if (onGated) router.replace('/')
      return
    }

    // Authenticated: close the modal, then wait for the cookie before entering a
    // gated route so the proxy sees it. `from` = a proxy-gated origin, else home.
    if (open) closeLogin()
    if (!sessionSynced || navigated.current) return
    if (from) {
      navigated.current = true
      clearFrom()
      router.replace(from)
    } else if (pathname === '/') {
      navigated.current = true
      router.replace('/user')
    }
  }, [state, sessionSynced, open, from, pathname, router, closeLogin, clearFrom])

  return null
}
