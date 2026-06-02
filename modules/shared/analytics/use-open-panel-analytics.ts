'use client'

import { useOpenPanel } from '@openpanel/nextjs'
import { useCallback } from 'react'
import type { AnalyticsEvent } from './events'

/**
 * Thin, app-facing wrapper over OpenPanel's `track`.
 *
 * - Event names are constrained to the {@link AnalyticsEvent} registry so call
 *   sites can't hand-type strings.
 * - Calls are safe even when analytics is disabled: if the SDK was never
 *   initialized (empty client ID), OpenPanel's `track` is a no-op.
 * - Tracking never throws into the app — failures are swallowed to `console.warn`.
 */
export function useOpenPanelAnalytics(): {
  track: (event: AnalyticsEvent, properties?: Record<string, unknown>) => void
} {
  const op = useOpenPanel()

  const track = useCallback(
    (event: AnalyticsEvent, properties?: Record<string, unknown>) => {
      try {
        op.track(event, properties)
      } catch (err) {
        console.warn('[analytics] Failed to track event:', event, err)
      }
    },
    [op],
  )

  return { track }
}
