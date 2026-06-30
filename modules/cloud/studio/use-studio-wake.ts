'use client'

import { useCallback, useEffect, useState } from 'react'
import { fetchStudioPowerState, wakeStudio } from '@/modules/cloud/graphql'

export type WakeState = 'idle' | 'waking' | 'awake' | 'error'

const POLL_MS = 3_000

/**
 * Frontend-driven wake for a hibernated studio. Clicking a 💤 card calls the
 * open, idempotent `wakeStudio` mutation, then polls `studioPowerState` until
 * the studio reports AWAKE — at which point the card becomes openable. This
 * keeps wake entirely in the dashboard (no standalone activator pod / catch-all
 * ingress needed); a bookmarked link straight to a sleeping host is the only
 * case not covered.
 */
export function useStudioWake(host: string): {
  state: WakeState
  wake: () => void
} {
  const [state, setState] = useState<WakeState>('idle')

  // Poll for readiness only while a wake is in flight; cleans up on unmount or
  // when the studio reports AWAKE.
  useEffect(() => {
    if (state !== 'waking' || !host) return
    let alive = true
    let timer: ReturnType<typeof setTimeout>
    const tick = async () => {
      try {
        const status = await fetchStudioPowerState(host)
        if (!alive) return
        if (status === 'AWAKE') {
          setState('awake')
          return
        }
      } catch {
        // transient — keep polling
      }
      if (alive) timer = setTimeout(() => void tick(), POLL_MS)
    }
    timer = setTimeout(() => void tick(), POLL_MS)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [state, host])

  const wake = useCallback(() => {
    setState((s) => (s === 'idle' || s === 'error' ? 'waking' : s))
    // Idempotent open mutation; the poll above drives the UI regardless.
    wakeStudio(host).catch(() => {})
  }, [host])

  return { state, wake }
}
