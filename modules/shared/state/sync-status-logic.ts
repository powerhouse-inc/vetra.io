/**
 * Pure logic for the app-state coordinator and sync-status chip — no React,
 * no side effects, so each rule is unit-testable in isolation.
 */

/** High-level freshness state surfaced to the user. */
export type SyncStatus = 'up-to-date' | 'refreshing' | 'offline' | 'error'

/**
 * Query-key prefixes the coordinator owns: prefetched on boot and/or
 * invalidated together on the coordinated refresh triggers. Each entry is the
 * first element of the relevant React Query key (see modules/cloud/query/keys.ts
 * and the profile hooks). Packages are server-rendered and intentionally absent.
 */
export const COORDINATED_KEY_PREFIXES = [
  ['builder-account'],
  ['my-teams'],
  ['environments'],
  ['viewer'],
] as const

/** How long the tab must be hidden before a return triggers a full refresh. */
export const AWAY_THRESHOLD_MS = 60_000

/** Derives the user-facing status. Offline wins; then refreshing; then error. */
export function deriveSyncStatus(input: {
  activeCount: number
  online: boolean
  hasError: boolean
}): SyncStatus {
  if (!input.online) return 'offline'
  if (input.activeCount > 0) return 'refreshing'
  if (input.hasError) return 'error'
  return 'up-to-date'
}

/** True when the tab was hidden for at least `thresholdMs` before returning. */
export function shouldRefreshAfterAway(
  hiddenAt: number | null,
  now: number,
  thresholdMs: number,
): boolean {
  if (hiddenAt === null) return false
  return now - hiddenAt >= thresholdMs
}

/** True when a query key starts with one of the coordinated prefixes. */
export function isCoordinatedKey(queryKey: readonly unknown[]): boolean {
  const head = queryKey[0]
  if (typeof head !== 'string') return false
  return COORDINATED_KEY_PREFIXES.some((prefix) => prefix[0] === head)
}
