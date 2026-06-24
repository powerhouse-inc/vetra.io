/**
 * Boot-time identity guard for the persisted React Query cache.
 *
 * Per-user query keys embed the DID, so a different user can't *read* the
 * previous user's entries — but non-DID-scoped entries (and the persisted
 * localStorage blob as a whole) can linger across an account switch that
 * happens between sessions. We persist the last-known DID and, on boot,
 * clear the cache when it no longer matches the resolved identity.
 */

/** localStorage key holding the last-known signed-in DID. */
export const IDENTITY_MARKER_KEY = 'vetra-rq-identity'

/**
 * True when the cache should be cleared for an identity mismatch.
 *
 * - No stored marker (fresh browser): keep — nothing to leak.
 * - Current still resolving (null): keep — decide once identity settles.
 * - Stored differs from current: clear.
 */
export function shouldClearForIdentity(
  storedDid: string | null,
  currentDid: string | null,
): boolean {
  if (storedDid === null) return false
  if (currentDid === null) return false
  return storedDid !== currentDid
}

/** Reads the persisted identity marker (SSR-safe). */
export function readIdentityMarker(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(IDENTITY_MARKER_KEY)
}

/** Writes (or, with `null`, removes) the persisted identity marker (SSR-safe). */
export function writeIdentityMarker(did: string | null): void {
  if (typeof window === 'undefined') return
  if (did === null) {
    window.localStorage.removeItem(IDENTITY_MARKER_KEY)
    return
  }
  window.localStorage.setItem(IDENTITY_MARKER_KEY, did)
}
