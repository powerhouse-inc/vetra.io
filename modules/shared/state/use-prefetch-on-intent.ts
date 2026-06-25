'use client'

import { useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useDid, useRenown } from '@powerhousedao/reactor-browser'
import { getAuthToken } from '@/modules/cloud/graphql'
import { ROUTE_PREFETCH, hasPrefetch } from './route-prefetch'

type IntentHandlers = {
  onMouseEnter: () => void
  onFocus: () => void
  onTouchStart: () => void
}

/**
 * Returns link handlers that warm a route's data on hover/focus/touch, once.
 * Returns `undefined` for routes with no registered prefetch (so the caller can
 * spread `{...undefined}` harmlessly). Authed routes need a Renown token; if the
 * user is signed out the prefetch silently no-ops and stays armed for later.
 */
export function usePrefetchOnIntent(href: string): IntentHandlers | undefined {
  const queryClient = useQueryClient()
  const did = useDid()
  const renown = useRenown()
  const done = useRef(false)

  const trigger = useCallback(() => {
    if (done.current || !hasPrefetch(href)) return
    done.current = true
    void (async () => {
      const token = await getAuthToken(renown)
      if (!token) {
        // Signed out (or token not ready): re-arm so a later hover retries.
        done.current = false
        return
      }
      try {
        await ROUTE_PREFETCH[href]({ queryClient, did, token })
      } catch {
        done.current = false
      }
    })()
  }, [href, queryClient, did, renown])

  if (!hasPrefetch(href)) return undefined
  return { onMouseEnter: trigger, onFocus: trigger, onTouchStart: trigger }
}
