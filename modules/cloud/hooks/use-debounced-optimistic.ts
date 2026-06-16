import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

/**
 * Optimistic state with a debounced, serialized commit.
 *
 * Designed for UI elements where the user might rapidly change their mind
 * (e.g. radio groups bound to a server-side setting). Solves three problems
 * at once:
 *
 *   1. **Optimistic UI.** `value` flips to the user's latest intent
 *      immediately on `set(next)` — no waiting for the network.
 *   2. **Debounced commit.** Bursts of `set` calls within `delayMs` collapse
 *      into a single commit for the final value, so scrubbing through
 *      options doesn't flood the server with throwaway writes.
 *   3. **Serialized commits with queue + drain.** If a click lands while a
 *      previous commit is still resolving, the new target is queued and
 *      applied right after — never two commits in flight at once. This
 *      prevents server-side races where a stale write lands second and
 *      "switches the value back."
 *
 * On error, the optimistic override is dropped (UI snaps back to server
 * truth) and any queued target is discarded — silently retrying isn't
 * usually what the user asked for. Pass `onError` to surface a toast.
 *
 * On unmount, a still-pending debounced commit is flushed best-effort so
 * the user's last selection isn't silently lost.
 */
const UNSET = Symbol('UNSET')

export function useDebouncedOptimistic<T>(opts: {
  /** Server-truth value. The hook reverts to this once the server has caught up. */
  serverValue: T
  /** Async commit that persists `next` to the server. Errors are surfaced via `onError`. */
  commit: (next: T) => Promise<void>
  /** Window after the last `set` call before the commit fires. */
  delayMs: number
  /** Called with the rejection from `commit` after the override is reverted. */
  onError?: (err: unknown) => void
}): {
  /** Display value: optimistic when set, otherwise the server value. */
  value: T
  /** Update intent. Flips `value` immediately, schedules the debounced commit. */
  set: (next: T) => void
  /** True from the first `set` until the final commit resolves (or fails). */
  isPending: boolean
} {
  const { serverValue, commit, delayMs, onError } = opts

  const [optimistic, setOptimistic] = useState<T | typeof UNSET>(UNSET)
  const value = optimistic === UNSET ? serverValue : optimistic

  // Refs so the synchronous parts of `set` see up-to-date values without
  // introducing render-race windows where state flags lag a re-render.
  const inFlightRef = useRef(false)
  const latestTargetRef = useRef<{ value: T } | null>(null)
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingTargetRef = useRef<{ value: T } | null>(null)
  const commitRef = useRef(commit)
  const onErrorRef = useRef(onError)
  useLayoutEffect(() => {
    commitRef.current = commit
    onErrorRef.current = onError
  })

  const [isPending, setIsPending] = useState(false)

  // Drop the optimistic override once the server has caught up — but only
  // when nothing is queued, debouncing, or in-flight. Otherwise we'd snap
  // the UI back mid-burst.
  useEffect(() => {
    if (
      optimistic !== UNSET &&
      Object.is(optimistic, serverValue) &&
      !inFlightRef.current &&
      commitTimerRef.current === null
    ) {
      setOptimistic(UNSET)
    }
  }, [serverValue, optimistic])

  const fireCommit = useCallback(async (target: T) => {
    if (inFlightRef.current) {
      // A previous commit is still resolving — let its drain loop pick this up.
      latestTargetRef.current = { value: target }
      return
    }
    inFlightRef.current = true
    try {
      let current = target
      // Drain queued targets serially so we never have two commits racing.
      while (true) {
        await commitRef.current(current)
        const queued = latestTargetRef.current
        latestTargetRef.current = null
        if (queued === null || Object.is(queued.value, current)) break
        current = queued.value
      }
    } catch (err) {
      latestTargetRef.current = null
      setOptimistic(UNSET)
      onErrorRef.current?.(err)
    } finally {
      inFlightRef.current = false
      setIsPending(false)
    }
  }, [])

  const set = useCallback(
    (next: T) => {
      setOptimistic(next)
      setIsPending(true)
      pendingTargetRef.current = { value: next }
      if (commitTimerRef.current) clearTimeout(commitTimerRef.current)
      commitTimerRef.current = setTimeout(() => {
        commitTimerRef.current = null
        const target = pendingTargetRef.current
        pendingTargetRef.current = null
        if (target === null) {
          setIsPending(false)
          return
        }
        void fireCommit(target.value)
      }, delayMs)
    },
    [delayMs, fireCommit],
  )

  // Flush a pending debounced click on unmount so the user's last selection
  // isn't silently dropped if they navigate away mid-debounce. Best-effort —
  // we don't await, and we swallow errors since the component is gone.
  useEffect(() => {
    return () => {
      if (commitTimerRef.current) {
        clearTimeout(commitTimerRef.current)
        commitTimerRef.current = null
        const target = pendingTargetRef.current
        pendingTargetRef.current = null
        if (target !== null) {
          void commitRef.current(target.value).catch(() => {
            /* component unmounted — nothing to surface */
          })
        }
      }
    }
  }, [])

  return { value, set, isPending }
}
