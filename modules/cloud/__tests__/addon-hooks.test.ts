import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useServiceAddon } from '@/modules/cloud/hooks/use-service-addon'
import { useWorkflowsAddon } from '@/modules/cloud/hooks/use-workflows-addon'
import type { CloudEnvironmentService } from '@/modules/cloud/types'

const service = (
  type: CloudEnvironmentService['type'],
  enabled: boolean,
): CloudEnvironmentService => ({
  type,
  prefix: type.toLowerCase(),
  enabled,
  url: null,
  status: 'ACTIVE',
  version: null,
  selectedRessource: null,
})

describe('useServiceAddon', () => {
  const setup = (services: CloudEnvironmentService[]) => {
    const enableService = vi.fn().mockResolvedValue(undefined)
    const disableService = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useServiceAddon({
        services,
        type: 'PAPERLESS',
        prefix: 'paperless',
        enableService,
        disableService,
      }),
    )
    return { result, enableService, disableService }
  }

  it('reads its own service only', () => {
    expect(setup([service('DOCLING', true)]).result.current.enabled).toBe(false)
    expect(setup([service('PAPERLESS', true)]).result.current.enabled).toBe(true)
  })

  it('enables and disables its service by type and prefix', async () => {
    const { result, enableService, disableService } = setup([])
    await result.current.toggle(true)
    expect(enableService).toHaveBeenCalledWith('PAPERLESS', 'paperless')
    await result.current.toggle(false)
    expect(disableService).toHaveBeenCalledWith('PAPERLESS', 'paperless')
  })
})

describe('useServiceAddon — SPECKLE', () => {
  const href = 'https://tall-duck-ab12-speckle.vetra.io'
  const setup = (services: CloudEnvironmentService[]) => {
    const enableService = vi.fn().mockResolvedValue(undefined)
    const disableService = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useServiceAddon({
        services,
        type: 'SPECKLE',
        prefix: 'speckle',
        enableService,
        disableService,
        href,
        hrefLabel: 'Open Speckle',
      }),
    )
    return { result, enableService, disableService }
  }

  it('reads its own service only', () => {
    expect(setup([service('PAPERLESS', true)]).result.current.enabled).toBe(false)
    expect(setup([service('SPECKLE', true)]).result.current.enabled).toBe(true)
  })

  it('enables and disables SPECKLE by type and prefix', async () => {
    const { result, enableService, disableService } = setup([])
    await result.current.toggle(true)
    expect(enableService).toHaveBeenCalledWith('SPECKLE', 'speckle')
    await result.current.toggle(false)
    expect(disableService).toHaveBeenCalledWith('SPECKLE', 'speckle')
  })

  it('passes its link through', () => {
    const { result } = setup([service('SPECKLE', true)])
    expect(result.current.href).toBe(href)
    expect(result.current.hrefLabel).toBe('Open Speckle')
  })
})

describe('useWorkflowsAddon', () => {
  const setup = (o: Partial<Parameters<typeof useWorkflowsAddon>[0]> = {}) => {
    const params = {
      tenantId: 'tenant-1',
      envVars: [],
      setVar: vi.fn().mockResolvedValue(undefined),
      tenantConfigLoaded: true,
      tenantConfigError: null,
      runtimeConfig: null,
      setRuntimeConfig: vi.fn().mockResolvedValue(undefined),
      runtimeConfigSupported: true,
      ...o,
    }
    const { result } = renderHook(() => useWorkflowsAddon(params))
    return { result, params }
  }

  it('reads ON only when both halves are set', () => {
    const envVars = [{ key: 'PH_WORKFLOWS_ENABLED', value: 'true' }]
    const runtimeConfig = { connect: { app: { workflowsEnabled: true } } }
    expect(setup({ envVars }).result.current.enabled).toBe(false)
    expect(setup({ runtimeConfig }).result.current.enabled).toBe(false)
    expect(setup({ envVars, runtimeConfig }).result.current.enabled).toBe(true)
  })

  it('writes both halves when switched on', async () => {
    const { result, params } = setup()
    await result.current.toggle(true)
    expect(params.setVar).toHaveBeenCalledWith('PH_WORKFLOWS_ENABLED', 'true')
    expect(params.setRuntimeConfig).toHaveBeenCalledWith({
      connect: { app: { workflowsEnabled: true } },
    })
  })

  it('says when only the first write landed', async () => {
    const { result } = setup({ setRuntimeConfig: vi.fn().mockRejectedValue(new Error('x')) })
    await expect(result.current.toggle(true)).rejects.toThrow(/only partly enabled/i)
  })

  it('skips the second write when the first fails', async () => {
    const { result, params } = setup({ setVar: vi.fn().mockRejectedValue(new Error('x')) })
    await expect(result.current.toggle(true)).rejects.toThrow(/couldn't enable workflows/i)
    expect(params.setRuntimeConfig).not.toHaveBeenCalled()
  })

  it('is unavailable until it can read and write both halves', () => {
    expect(setup({ runtimeConfigSupported: false }).result.current.unavailable).toMatch(
      /not supported/i,
    )
    expect(setup({ tenantId: null }).result.current.unavailable).toMatch(/once the environment/i)
    expect(setup({ tenantConfigError: new Error('x') }).result.current.unavailable).toMatch(
      /couldn't load/i,
    )
    expect(setup({ tenantConfigLoaded: false }).result.current.unavailable).toMatch(/loading/i)
    expect(setup().result.current.unavailable).toBeUndefined()
  })
})
