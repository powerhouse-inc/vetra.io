import { describe, expect, it } from 'vitest'
import { findStudioAgent, findStudioAgents } from '@/modules/cloud/studio/find-studio-agent'
import type { CloudEnvironment, CloudEnvironmentService } from '@/modules/cloud/types'

function svc(partial: Partial<CloudEnvironmentService>): CloudEnvironmentService {
  return {
    type: 'CLINT',
    prefix: 'vetra-agent',
    enabled: true,
    url: null,
    status: 'ACTIVE',
    version: null,
    selectedRessource: 'VETRA_AGENT_XL',
    config: {
      package: { registry: 'r', name: 'vetra-cli', version: null },
      env: [],
      serviceCommand: null,
      selectedRessource: 'VETRA_AGENT_XL',
    },
    ...partial,
  }
}
function env(services: CloudEnvironmentService[], id = 'e1'): CloudEnvironment {
  return {
    id,
    name: 'Vetra Studio',
    documentType: 'powerhouse/vetra-cloud-environment',
    createdAtUtcIso: '',
    lastModifiedAtUtcIso: '',
    revision: 1,
    state: {
      owner: null,
      label: 'Vetra Studio',
      genericSubdomain: 'sub',
      genericBaseDomain: 'vetra.io',
      customDomain: null,
      defaultPackageRegistry: null,
      services,
      packages: [],
      status: 'READY',
    },
  }
}

describe('findStudioAgent', () => {
  it('returns the env + service when a vetra-cli CLINT agent exists', () => {
    const match = findStudioAgent([env([svc({})])])
    expect(match?.env.id).toBe('e1')
    expect(match?.service.prefix).toBe('vetra-agent')
  })
  it('ignores disabled agents', () => {
    expect(findStudioAgent([env([svc({ enabled: false })])])).toBeNull()
  })
  it('ignores non-vetra-cli CLINT agents', () => {
    expect(
      findStudioAgent([
        env([
          svc({
            config: {
              package: { registry: 'r', name: 'ph-pirate-cli', version: null },
              env: [],
              serviceCommand: null,
              selectedRessource: 'VETRA_AGENT_S',
            },
          }),
        ]),
      ]),
    ).toBeNull()
  })
  it('ignores non-CLINT services', () => {
    expect(findStudioAgent([env([svc({ type: 'CONNECT', config: null })])])).toBeNull()
  })
  it('returns null for empty input', () => {
    expect(findStudioAgent([])).toBeNull()
  })
  it('returns the first matching env across multiple', () => {
    const match = findStudioAgent([env([], 'e0'), env([svc({})], 'e1')])
    expect(match?.env.id).toBe('e1')
  })

  it('matches via env packages when service config is omitted (detail fragment lacks config)', () => {
    const e = env([svc({ config: null })])
    e.state.packages = [{ registry: 'r', name: 'vetra-cli', version: '0.0.1-dev.9' }]
    const match = findStudioAgent([e])
    expect(match?.env.id).toBe('e1')
    expect(match?.service.prefix).toBe('vetra-agent')
  })

  it('does not match a config-less CLINT agent when the env lacks the studio package', () => {
    const e = env([svc({ config: null })])
    e.state.packages = [{ registry: 'r', name: 'ph-pirate-cli', version: '1' }]
    expect(findStudioAgent([e])).toBeNull()
  })

  it('findStudioAgents returns all matching envs', () => {
    const a = env([svc({})], 'a')
    const b = env([svc({})], 'b')
    const none = env([], 'c')
    expect(findStudioAgents([a, none, b]).map((m) => m.env.id)).toEqual(['a', 'b'])
  })

  it('findStudioAgents returns [] when none match', () => {
    expect(findStudioAgents([env([], 'c')])).toEqual([])
  })
})
