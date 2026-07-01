'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useStudioWake } from '../use-studio-wake'

/** Apex studio host, e.g. tall-duck-ab12cd34.vetra.io. */
const HOST_RE = /^[a-z0-9-]+\.vetra\.io$/

/** How often to probe the studio's route-readiness once its agent is up. */
const READINESS_POLL_MS = 2_500
/**
 * Hard cap on the route-readiness wait. AWAKE means the agent's webserver is up,
 * but the app can 404 for a bit while it mounts routes. We probe readiness via a
 * same-origin API route (the studio host is cross-origin, so the browser can't
 * read its status directly); if it somehow never reports ready, redirect anyway
 * rather than spin forever.
 */
const READINESS_MAX_WAIT_MS = 90_000

/**
 * Full-page, vetra.io-branded "waking your studio" screen. The wake activator
 * redirects a browser here (with ?host=<studio-host>) when a slept studio is
 * hit. We kick the open wakeStudio mutation, poll until the studio reports
 * AWAKE (agent webserver up), then poll a same-origin readiness probe until the
 * app actually serves `/` before redirecting — so the user never lands on a
 * transient "not found". Reuses the app's real theme (green #04c161, Inter).
 */
export function WakingScreen() {
  const params = useSearchParams()
  const host = params.get('host') ?? ''
  const valid = HOST_RE.test(host)

  const { state, wake } = useStudioWake(valid ? host : '')
  const [slow, setSlow] = useState(false)
  // Agent is up; now wait until the app is route-ready before redirecting.
  const opening = state === 'awake'

  useEffect(() => {
    if (valid) wake()
  }, [valid, wake])

  useEffect(() => {
    if (!opening) return
    let alive = true
    let timer: ReturnType<typeof setTimeout>
    const go = () => {
      if (alive) window.location.replace(`https://${host}`)
    }
    // Poll the server-side readiness probe; only redirect once the studio app
    // actually serves `/` (route-ready), not merely when its webserver answers.
    const tick = async () => {
      try {
        const res = await fetch(`/api/studio-ready?host=${encodeURIComponent(host)}`, {
          cache: 'no-store',
        })
        const { ready } = (await res.json()) as { ready?: boolean }
        if (alive && ready) {
          go()
          return
        }
      } catch {
        // transient — keep probing
      }
      if (alive) timer = setTimeout(() => void tick(), READINESS_POLL_MS)
    }
    // Safety net: never spin forever — redirect after the cap regardless.
    const cap = setTimeout(go, READINESS_MAX_WAIT_MS)
    void tick()
    return () => {
      alive = false
      clearTimeout(timer)
      clearTimeout(cap)
    }
  }, [opening, host])

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
      <h1 className="mt-8 text-xl font-semibold tracking-tight">
        {opening ? 'Opening your studio…' : 'Waking your studio…'}
      </h1>
      <p className="text-muted-foreground mt-2 max-w-md text-sm leading-relaxed">
        {opening ? (
          <>
            It&rsquo;s awake — taking you to{' '}
            <span className="text-foreground font-medium">{host}</span> now.
          </>
        ) : (
          <>
            It was asleep to save resources. We&rsquo;re starting it back up and will open{' '}
            <span className="text-foreground font-medium">{host}</span> automatically.
          </>
        )}
      </p>
      {slow && !opening && (
        <p className="text-muted-foreground mt-4 max-w-md text-xs">
          Still booting — this can take a minute or two on a cold start.
        </p>
      )}
    </main>
  )
}
