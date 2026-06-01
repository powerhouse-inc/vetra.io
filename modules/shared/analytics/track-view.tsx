'use client'

import { useEffect, useRef } from 'react'
import type { AnalyticsEvent } from './events'
import { useAnalytics } from './use-analytics'

/**
 * Fires a single analytics event once on mount. Lets server components track a
 * "view" by dropping a thin client child into their JSX, without converting the
 * page itself to a client component.
 *
 * In React 18+ Strict Mode effects run twice in dev; a ref guards against a
 * duplicate event there.
 */
export function TrackView({
  event,
  properties,
}: {
  event: AnalyticsEvent
  properties?: Record<string, unknown>
}): null {
  const { track } = useAnalytics()
  const tracked = useRef(false)

  useEffect(() => {
    if (tracked.current) return
    tracked.current = true
    track(event, properties)
    // Fire once on mount; intentionally not reactive to prop changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
