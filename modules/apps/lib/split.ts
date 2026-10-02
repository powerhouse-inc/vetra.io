import type { CloudEnvironment } from '@/modules/cloud/types'

import type { App } from '../types'

/**
 * Ids of the caller's live Apps, or `null` while the list is unknown (still
 * loading). DELETED apps are excluded: myApps hides them server-side already,
 * this guards against a stale cache.
 */
export function activeAppIds(
  apps: ReadonlyArray<Pick<App, 'id' | 'status'>> | null | undefined,
): ReadonlySet<string> | null {
  if (!apps) return null
  return new Set(apps.filter((a) => a.status !== 'DELETED').map((a) => a.id))
}

/**
 * An env belongs to an App when the read model carries an `appId` for it AND
 * that App is still live. Deleting an App while keeping its environments
 * leaves `appId` on the production env (so its image stays allowed); such an
 * env is standalone again. With `appIds === null` (app list unknown) the
 * `appId` alone decides, so App envs don't flash into the standalone list.
 */
export function isAppEnvironment(
  env: Pick<CloudEnvironment, 'app'>,
  appIds: ReadonlySet<string> | null = null,
): boolean {
  const appId = env.app?.appId
  if (!appId) return false
  return appIds ? appIds.has(appId) : true
}

/**
 * Split the env list: App-owned envs (production + previews) are reached
 * through their App, everything else is a "standalone" environment and keeps
 * its own card. Backends without the link fields → all standalone.
 */
export function splitEnvironments<T extends Pick<CloudEnvironment, 'app'>>(
  envs: readonly T[],
  appIds: ReadonlySet<string> | null = null,
): { standalone: T[]; appOwned: T[] } {
  const standalone: T[] = []
  const appOwned: T[] = []
  for (const env of envs) (isAppEnvironment(env, appIds) ? appOwned : standalone).push(env)
  return { standalone, appOwned }
}

/**
 * Environments the new-app flow may attach as production: no app link at all
 * (a kept production env of a deleted app still carries its appId and is
 * rejected by createApp) and not a Studio environment.
 */
export function attachableEnvironments<
  T extends Pick<CloudEnvironment, 'app'> & { state: { studioInstanceId?: string | null } },
>(envs: readonly T[]): T[] {
  return envs.filter((e) => !e.app?.appId && !e.state.studioInstanceId)
}
