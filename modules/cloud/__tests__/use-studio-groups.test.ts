import { describe, expect, it } from 'vitest'
import { groupStudioEnvironments } from '@/modules/cloud/studio/use-studio-groups'
import type { StudioProduct } from '@/modules/cloud/studio/use-studio-products'
import type { CloudEnvironment } from '@/modules/cloud/types'

function studio(envId: string): StudioProduct {
  return {
    envId,
    subdomain: envId,
    prefix: 'vetra-agent',
    label: 'Vetra Studio',
    brand: null,
    status: 'ready',
  }
}

function env(id: string, studioInstanceId: string | null): CloudEnvironment {
  return {
    id,
    name: id,
    documentType: 'powerhouse/vetra-cloud-environment',
    createdAtUtcIso: '',
    lastModifiedAtUtcIso: '',
    revision: 0,
    state: {
      owner: null,
      label: id,
      genericSubdomain: id,
      genericBaseDomain: 'vetra.io',
      customDomain: null,
      defaultPackageRegistry: null,
      services: [],
      packages: [],
      status: 'READY',
      studioInstanceId,
    },
  }
}

/** A studio-type env: runs a vetra-cli CLINT agent, so findStudioAgents detects
 * it even when it isn't among the ready `myStudioProducts`. */
function studioEnv(id: string): CloudEnvironment {
  const e = env(id, null)
  e.state.services = [
    {
      type: 'CLINT',
      prefix: 'vetra-agent',
      enabled: true,
      url: null,
      status: 'ACTIVE',
      version: null,
      selectedRessource: 'VETRA_AGENT_XXL',
    },
  ]
  e.state.packages = [{ registry: 'r', name: 'vetra-cli', version: null }]
  return e
}

describe('groupStudioEnvironments', () => {
  it('nests each env under the studio its studioInstanceId points to', () => {
    const studios = [studio('studio-a'), studio('studio-b')]
    const envs = [env('a-prod', 'studio-a'), env('a-test', 'studio-a'), env('b-prod', 'studio-b')]

    const { groups, standalone } = groupStudioEnvironments(studios, envs)

    expect(groups).toHaveLength(2)
    expect(groups[0].environments.map((e) => e.id)).toEqual(['a-prod', 'a-test'])
    expect(groups[1].environments.map((e) => e.id)).toEqual(['b-prod'])
    expect(standalone).toHaveLength(0)
  })

  it('puts an unstamped (null) env under standalone', () => {
    const { groups, standalone } = groupStudioEnvironments(
      [studio('studio-a')],
      [env('a-prod', 'studio-a'), env('solo', null)],
    )

    expect(groups[0].environments.map((e) => e.id)).toEqual(['a-prod'])
    expect(standalone.map((e) => e.id)).toEqual(['solo'])
  })

  it('never renders a studio env as a nested or standalone card', () => {
    // The studio env itself appears in the env list (studioInstanceId null) but
    // is a header, not a card.
    const studios = [studio('studio-a')]
    const envs = [env('studio-a', null), env('a-prod', 'studio-a')]

    const { groups, standalone } = groupStudioEnvironments(studios, envs)

    expect(groups[0].environments.map((e) => e.id)).toEqual(['a-prod'])
    expect(standalone).toHaveLength(0)
  })

  it('excludes a studio env detected by vetra-cli, even when not in myStudioProducts', () => {
    // Users accrue many stopped/old studio envs that never surface as ready
    // products; detection (not just the products list) must keep them out of
    // "Other environments".
    const { groups, standalone } = groupStudioEnvironments(
      [studio('studio-a')],
      [env('a-prod', 'studio-a'), studioEnv('old-studio'), env('solo', null)],
    )

    expect(groups[0].environments.map((e) => e.id)).toEqual(['a-prod'])
    // old-studio is excluded (detected as a studio); only the real deployable
    // env is standalone.
    expect(standalone.map((e) => e.id)).toEqual(['solo'])
  })

  it('treats an env pointing at an unknown studio as standalone (dangling link stays visible)', () => {
    const { groups, standalone } = groupStudioEnvironments(
      [studio('studio-a')],
      [env('orphan', 'studio-gone')],
    )

    expect(groups[0].environments).toHaveLength(0)
    expect(standalone.map((e) => e.id)).toEqual(['orphan'])
  })
})
