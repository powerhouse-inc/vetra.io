import type { CloudEnvironment } from '@/modules/cloud/types'

/** An env belongs to an App when the read model carries an `appId` for it. */
export function isAppEnvironment(env: Pick<CloudEnvironment, 'app'>): boolean {
  return !!env.app?.appId
}

/**
 * Split the env list for the Apps home: App-owned envs (production + previews)
 * are reached through their App, everything else is a "standalone" environment
 * and keeps its own card. Backends without the link fields → all standalone.
 */
export function splitEnvironments<T extends Pick<CloudEnvironment, 'app'>>(
  envs: readonly T[],
): { standalone: T[]; appOwned: T[] } {
  const standalone: T[] = []
  const appOwned: T[] = []
  for (const env of envs) (isAppEnvironment(env) ? appOwned : standalone).push(env)
  return { standalone, appOwned }
}
