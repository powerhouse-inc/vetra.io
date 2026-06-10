'use client'

import { useEffect, useState } from 'react'
import { useIsFetching, useIsMutating } from '@tanstack/react-query'

/**
 * A faint, indeterminate progress bar pinned to the very top of the viewport
 * while any React Query fetch or mutation is in flight. Deliberately
 * unobtrusive: cached content stays on screen and silently updates, so this is
 * the only hint that a background revalidation is happening — no per-card
 * spinners. A short delay keeps sub-300ms fetches from flashing the bar.
 */
export function GlobalRefreshIndicator() {
  const active = useIsFetching() + useIsMutating() > 0
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!active) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(false)
      return
    }
    const timer = setTimeout(() => setVisible(true), 300)
    return () => clearTimeout(timer)
  }, [active])

  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="bg-primary/70 h-full w-2/5 animate-[refresh-slide_1.1s_ease-in-out_infinite] rounded-full" />
    </div>
  )
}
