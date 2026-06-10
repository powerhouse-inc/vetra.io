export type EmbedStatus =
  | 'loading'
  | 'unauthenticated'
  | 'not-allowed'
  | 'not-found'
  | 'booting'
  | 'ready'

export type EmbedStatusInputs = {
  /** Renown session present. */
  authed: boolean
  /** Viewer address (null while still resolving). */
  address: string | null
  /** Whether the address is on the studio allowlist. */
  allowed: boolean
  /** Direct lookup of the target env by id. */
  resolution: 'pending' | 'not-found' | 'found'
  /** First runtime-endpoints fetch has completed (distinguishes "not checked" from "not ready"). */
  endpointsChecked: boolean
  /** The agent announced an enabled website endpoint (serving the studio). */
  websiteReady: boolean
  /** The agent host is reachable from the browser (public DNS + TLS up). */
  reachable: boolean
}

/**
 * Pure status derivation for the embedded studio. Order matters: never surface
 * `not-found` while the env is still being resolved, and never surface
 * `booting` before readiness has actually been checked (avoids the
 * loading→not-found→booting flicker an already-booted agent otherwise shows).
 */
export function deriveEmbedStatus(i: EmbedStatusInputs): EmbedStatus {
  if (!i.authed) return 'unauthenticated'
  if (!i.allowed) return i.address ? 'not-allowed' : 'loading'
  if (i.resolution === 'pending') return 'loading'
  if (i.resolution === 'not-found') return 'not-found'
  if (i.websiteReady && i.reachable) return 'ready'
  if (!i.endpointsChecked) return 'loading'
  return 'booting'
}
