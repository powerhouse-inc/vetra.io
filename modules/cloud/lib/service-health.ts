import type { Pod } from '../types'

/** What a service's pods are doing right now, as the overview's status dot shows it. */
export type ServiceHealth = 'running' | 'starting' | 'failing' | 'not-running'

/** Restarts after which a pod that is still not ready counts as crash-looping. */
const CRASH_LOOP_RESTARTS = 3

export const SERVICE_HEALTH_LABEL: Record<ServiceHealth, string> = {
  running: 'Running',
  starting: 'Starting',
  failing: 'Failing',
  'not-running': 'Not running',
}

/**
 * Live health of one service from the environment's pods, or null when it cannot
 * be told: pods not loaded yet, or FUSION, whose pods are not labelled per service.
 * Callers fall back to the document's service status then.
 */
export function serviceHealth(
  pods: readonly Pod[] | undefined,
  serviceType: string,
): ServiceHealth | null {
  if (!pods || serviceType === 'FUSION') return null
  const own = pods.filter((pod) => pod.service === serviceType)
  if (own.length === 0) return 'not-running'
  const crashing = (pod: Pod) =>
    pod.phase === 'FAILED' || (!pod.ready && pod.restartCount >= CRASH_LOOP_RESTARTS)
  if (own.some(crashing)) return 'failing'
  if (own.every((pod) => pod.ready && pod.phase === 'RUNNING')) return 'running'
  return 'starting'
}

/**
 * How far behind the freshest pod row a pod may be and still count as live. The
 * backend re-upserts every pod still in the cluster once a minute, but never
 * removes rows for pods that are gone, so rows that stopped updating are ghosts.
 */
const LIVE_POD_WINDOW_MS = 5 * 60_000

/**
 * The pods that still exist. The observability read model keeps every pod an
 * environment ever had (a replaced crash-looping switchboard stays FAILED in it
 * forever), so a pod is only current when its row was refreshed by the latest
 * reconcile, measured against the newest row rather than the clock so a stalled
 * reconciler does not empty the list.
 */
export function livePods<T extends Pick<Pod, 'updatedAt'>>(pods: readonly T[]): T[] {
  const times = pods.map((pod) => Date.parse(pod.updatedAt))
  const newest = Math.max(...times.filter((t) => !Number.isNaN(t)))
  if (!Number.isFinite(newest)) return [...pods]
  return pods.filter((_, i) => Number.isNaN(times[i]) || newest - times[i] <= LIVE_POD_WINDOW_MS)
}
