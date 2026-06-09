import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('@/modules/cloud/hooks/use-can-sign', () => ({ useCanSign: vi.fn() }))
vi.mock('@/modules/cloud/controller', () => ({ createNewEnvironmentController: vi.fn() }))
vi.mock('@/modules/cloud/config/apply', () => ({
  applyConfigChanges: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@powerhousedao/reactor-browser', () => ({ useRenown: vi.fn(() => ({})) }))
vi.mock('@/modules/cloud/subdomain', () => ({ generateSubdomain: vi.fn(() => 'warm-newt-75') }))
// client.ts calls createClient() at module load; the hook only needs DRIVE_ID.
vi.mock('@/modules/cloud/client', () => ({ DRIVE_ID: 'powerhouse' }))

import { useCanSign } from '@/modules/cloud/hooks/use-can-sign'
import { createNewEnvironmentController } from '@/modules/cloud/controller'
import { applyConfigChanges } from '@/modules/cloud/config/apply'
import { useCreateStudioEnvironment } from '@/modules/cloud/studio/use-create-studio-environment'

describe('useCreateStudioEnvironment', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws without a signer', async () => {
    vi.mocked(useCanSign).mockReturnValue({ canSign: false, signer: null, loading: false })
    const { result } = renderHook(() => useCreateStudioEnvironment())
    await expect(result.current({ anthropicApiKey: 'sk' })).rejects.toThrow(/logged in/i)
  })

  it('creates env, writes 3 secrets, approves, returns ids', async () => {
    const setOwner = vi.fn(),
      setLabel = vi.fn(),
      initialize = vi.fn(),
      addPackage = vi.fn(),
      enableService = vi.fn(),
      approveChanges = vi.fn()
    const push = vi
      .fn()
      .mockResolvedValue({ remoteDocument: { id: 'aa726a95-1111-2222-3333-444455556666' } })
    const ctrl = { setOwner, setLabel, initialize, addPackage, enableService, approveChanges, push }
    vi.mocked(createNewEnvironmentController).mockReturnValue(ctrl as never)
    vi.mocked(useCanSign).mockReturnValue({
      canSign: true,
      loading: false,
      signer: { user: { address: '0xMe' } } as never,
    })

    const { result } = renderHook(() => useCreateStudioEnvironment())
    let res: { documentId: string; subdomain: string; tenantId: string } | undefined
    await act(async () => {
      res = await result.current({ anthropicApiKey: 'sk-test' })
    })

    expect(setOwner).toHaveBeenCalledWith({ address: '0xMe' })
    expect(addPackage).toHaveBeenCalledWith({ packageName: 'vetra-cli', version: undefined })
    expect(enableService).toHaveBeenCalledOnce()
    expect(enableService.mock.calls[0][0]).toMatchObject({ type: 'CLINT', prefix: 'vetra-agent' })

    expect(applyConfigChanges).toHaveBeenCalledOnce()
    const [tenantId, changes] = vi.mocked(applyConfigChanges).mock.calls[0]
    expect(tenantId).toBe('warm-newt-75-aa726a95')
    expect(changes.map((c) => c.name).sort()).toEqual(
      ['ANTHROPIC_API_KEY', 'VETRA_ANTHROPIC_API_KEY', 'VETRA_CLI_ANTHROPIC_API_KEY'].sort(),
    )
    expect(changes.every((c) => c.kind === 'setSecret' && c.value === 'sk-test')).toBe(true)

    expect(approveChanges).toHaveBeenCalledOnce()
    expect(push).toHaveBeenCalledTimes(2)
    expect(res).toEqual({
      documentId: 'aa726a95-1111-2222-3333-444455556666',
      subdomain: 'warm-newt-75',
      tenantId: 'warm-newt-75-aa726a95',
    })
  })
})
