'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useRenownAuth } from '@powerhousedao/reactor-browser'

/**
 * Whether this page load is a return from the Renown login redirect.
 *
 * Renown's login is a full-page redirect that sends the user back with a
 * `?user=<DID>` query param, which the SDK then consumes and strips. We read it
 * at MODULE LOAD — before React mounts and before the SDK can remove it — the
 * same timing the RenownProvider relies on. If it was present, this load is a
 * post-login return, so once the session resolves to `authorized` we forward
 * the user to their products page.
 */
const returnedFromLogin =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('user')

/**
 * After a successful login redirect, forward the user to `/user` (their
 * products). Fires once per login return; a normal authorized page load (no
 * `?user`) is left untouched so we never yank an already-signed-in user away
 * from the page they're on.
 */
export function PostLoginRedirect() {
  const auth = useRenownAuth()
  const router = useRouter()
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current || !returnedFromLogin) return
    if (auth.status === 'authorized') {
      handled.current = true
      router.replace('/user')
    }
  }, [auth.status, router])

  return null
}
