import type { CloudEnvironment, CloudEnvironmentService } from '@/modules/cloud/types'
import { STUDIO_AGENT_PACKAGE } from './constants'

export type StudioAgentMatch = {
  env: CloudEnvironment
  service: CloudEnvironmentService
}

/** First enabled CLINT service whose package is the studio package, with its env. */
export function findStudioAgent(envs: CloudEnvironment[]): StudioAgentMatch | null {
  for (const env of envs) {
    const service = env.state.services.find(
      (s) => s.type === 'CLINT' && s.enabled && s.config?.package?.name === STUDIO_AGENT_PACKAGE,
    )
    if (service) return { env, service }
  }
  return null
}
