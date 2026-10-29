'use client'

import { useEffect, useRef } from 'react'
import { useRenownAuthAsync } from '@powerhousedao/reactor-browser/renown'
import { track } from '@/modules/shared/lib/track'

/**
 * Tracks `signed_in` when this tab goes from logged out to logged in. A page
 * load with an existing session goes resolving → authenticated and is not a
 * sign-in, so it is not counted.
 */
export function SignInTracker() {
  const { state } = useRenownAuthAsync()
  const sawLoggedOut = useRef(false)

  useEffect(() => {
    if (state === 'unauthenticated') sawLoggedOut.current = true
    if (state === 'authenticated' && sawLoggedOut.current) {
      sawLoggedOut.current = false
      track('signed_in')
    }
  }, [state])

  return null
}
