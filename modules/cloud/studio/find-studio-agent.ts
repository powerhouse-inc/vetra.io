import type { CloudEnvironment, CloudEnvironmentService } from '@/modules/cloud/types'
import { STUDIO_AGENT_PACKAGE } from './constants'

export type StudioAgentMatch = {
  env: CloudEnvironment
  service: CloudEnvironmentService
}

/** First enabled CLINT service whose package is the studio package, with its env. */
/**
 * Find an enabled studio (vetra-cli) CLINT agent in the user's environments.
 *
 * The environment list/detail GraphQL fragment returns service fields but NOT
 * the clint `config`, so `service.config.package.name` is usually absent. When
 * config IS present (e.g. a freshly-created in-memory env) we match on it
 * exactly; when it's absent we fall back to the env-level `packages` list —
 * which the fragment does return — since a studio env has the vetra-cli
 * package installed alongside its enabled CLINT agent.
 */
export function findStudioAgent(envs: CloudEnvironment[]): StudioAgentMatch | null {
  for (const env of envs) {
    const hasStudioPackage = env.state.packages.some((p) => p.name === STUDIO_AGENT_PACKAGE)
    const service = env.state.services.find((s) => {
      if (s.type !== 'CLINT' || !s.enabled) return false
      const pkgName = s.config?.package?.name
      return pkgName ? pkgName === STUDIO_AGENT_PACKAGE : hasStudioPackage
    })
    if (service) return { env, service }
  }
  return null
}
