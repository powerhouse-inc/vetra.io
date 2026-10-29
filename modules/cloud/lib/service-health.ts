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
