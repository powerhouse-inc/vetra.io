'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useStudioWake } from '../use-studio-wake'

/** Apex studio host, e.g. tall-duck-ab12cd34.vetra.io. */
const HOST_RE = /^[a-z0-9-]+\.vetra\.io$/

/**
 * Full-page, vetra.io-branded "waking your studio" screen. The wake activator
 * redirects a browser here (with ?host=<studio-host>) when a slept studio is
 * hit. We kick the open wakeStudio mutation, poll until the studio reports
 * AWAKE (its agent's readiness probe is green — so the host actually serves),
 * then send the user to it. Reuses the app's real theme (green #04c161, Inter).
 */
export function WakingScreen() {
  const params = useSearchParams()
  const host = params.get('host') ?? ''
  const valid = HOST_RE.test(host)

  const { state, wake } = useStudioWake(valid ? host : '')
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    if (valid) wake()
  }, [valid, wake])

  useEffect(() => {
    if (state === 'awake') window.location.replace(`https://${host}`)
  }, [state, host])

  // Reassure after a bit — waking is ~1–2 min (cold agent boot).
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 45_000)
    return () => clearTimeout(t)
  }, [])

  if (!valid) {
    return (
      <main className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <h1 className="text-xl font-semibold">Nothing to wake here</h1>
        <p className="text-muted-foreground mt-2 max-w-sm text-sm">
          This link is missing a valid studio address.
        </p>
        <a
          href="/cloud"
          className="bg-primary text-primary-foreground mt-6 rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90"
        >
          Go to your studios
        </a>
      </main>
    )
  }

  return (
    <main className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div
        className="relative flex h-20 w-20 items-center justify-center"
        role="status"
        aria-label="Waking your studio"
      >
        {/* Soft green halo pulsing behind the ring. */}
        <span className="bg-primary/15 absolute inset-0 animate-ping rounded-full motion-reduce:hidden" />
        {/* Green arc on a faint track — the arc (top + right) makes the spin read clearly. */}
        <span className="border-muted/50 border-t-primary border-r-primary h-14 w-14 animate-spin rounded-full border-4 motion-reduce:animate-none" />
      </div>
      <h1 className="mt-8 text-xl font-semibold tracking-tight">Waking your studio…</h1>
      <p className="text-muted-foreground mt-2 max-w-md text-sm leading-relaxed">
        It was asleep to save resources. We&rsquo;re starting it back up and will open{' '}
        <span className="text-foreground font-medium">{host}</span> automatically.
      </p>
      {slow && (
        <p className="text-muted-foreground mt-4 max-w-md text-xs">
          Still booting — this can take a minute or two on a cold start.
        </p>
      )}
    </main>
  )
}
