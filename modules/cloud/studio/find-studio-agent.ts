import type { CloudEnvironment, CloudEnvironmentService } from '@/modules/cloud/types'
import { STUDIO_AGENT_PACKAGE } from './constants'

export type StudioAgentMatch = {
  env: CloudEnvironment
  service: CloudEnvironmentService
}

/**
 * The enabled studio (vetra-cli) CLINT service in an env, if any.
 *
 * The environment list/detail GraphQL fragment returns service fields but NOT
 * the clint `config`, so `service.config.package.name` is usually absent. When
 * config IS present (e.g. a freshly-created in-memory env) we match on it
 * exactly; when it's absent we fall back to the env-level `packages` list —
 * which the fragment does return — since a studio env has the vetra-cli
 * package installed alongside its enabled CLINT agent.
 */
function matchStudioService(env: CloudEnvironment): CloudEnvironmentService | undefined {
  const hasStudioPackage = env.state.packages.some((p) => p.name === STUDIO_AGENT_PACKAGE)
  return env.state.services.find((s) => {
    if (s.type !== 'CLINT' || !s.enabled) return false
    const pkgName = s.config?.package?.name
    return pkgName ? pkgName === STUDIO_AGENT_PACKAGE : hasStudioPackage
  })
}

/** All of the user's environments that host an enabled vetra-cli studio agent. */
export function findStudioAgents(envs: CloudEnvironment[]): StudioAgentMatch[] {
  const out: StudioAgentMatch[] = []
  for (const env of envs) {
    const service = matchStudioService(env)
    if (service) out.push({ env, service })
  }
  return out
}

/** First studio agent match (back-compat for single-studio callers). */
export function findStudioAgent(envs: CloudEnvironment[]): StudioAgentMatch | null {
  return findStudioAgents(envs)[0] ?? null
}
