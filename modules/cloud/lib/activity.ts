import { environmentStatusMeta } from '@/modules/cloud/lib/environment-status'
import type { CloudEnvironment } from '@/modules/cloud/types'
import type { StatusMeta } from '@/modules/shared/lib/status'

export type ActivityEnvironment = {
  id: string
  name: string
  meta: StatusMeta
}

export type FinishedTransition = ActivityEnvironment & {
  outcome: 'success' | 'failure'
  /** The moving status it left (Deploying, Syncing, Terminating). */
  from: StatusMeta
}

export type EnvironmentActivity = {
  /** Environments whose status is still moving. */
  inMotion: ActivityEnvironment[]
  /** Environments that were moving last time and have now landed. */
  finished: FinishedTransition[]
}

const SUCCESS_LABELS = new Set(['Ready', 'Healthy'])
const FAILURE_LABELS = new Set(['Failed', 'Down', 'Degraded'])

function displayName(env: CloudEnvironment): string {
  return env.state.label || env.name || 'Unnamed'
}

function metaOf(env: CloudEnvironment): StatusMeta {
  return environmentStatusMeta({
    status: env.state.status,
    argoHealthStatus: env.health?.argoHealthStatus,
    argoSyncStatus: env.health?.argoSyncStatus,
  })
}

/**
 * What is moving across the user's environments, and what just stopped moving.
 * `previous` is the list seen last time (null on first load, so nothing counts
 * as finished); a transition is an env that was active then and now reads as
 * Ready / Healthy (success) or Failed / Down / Degraded (failure).
 */
export function environmentActivity(
  previous: CloudEnvironment[] | null,
  current: CloudEnvironment[],
): EnvironmentActivity {
  const before = new Map((previous ?? []).map((env) => [env.id, metaOf(env)]))
  const inMotion: ActivityEnvironment[] = []
  const finished: FinishedTransition[] = []

  for (const env of current) {
    const meta = metaOf(env)
    const item = { id: env.id, name: displayName(env), meta }
    if (meta.active) {
      inMotion.push(item)
      continue
    }
    const from = before.get(env.id)
    if (!from?.active) continue
    if (SUCCESS_LABELS.has(meta.label)) finished.push({ ...item, outcome: 'success', from })
    else if (FAILURE_LABELS.has(meta.label)) finished.push({ ...item, outcome: 'failure', from })
  }

  return { inMotion, finished }
}

/** Toast copy for a finished transition: "acme-prod is ready", "acme-prod failed to deploy". */
export function transitionMessage(t: FinishedTransition): string {
  if (t.outcome === 'success') return `${t.name} is ready`
  if (t.meta.label === 'Failed') {
    return t.from.label === 'Terminating'
      ? `${t.name} failed to terminate`
      : `${t.name} failed to deploy`
  }
  return `${t.name} is ${t.meta.label.toLowerCase()}`
}
