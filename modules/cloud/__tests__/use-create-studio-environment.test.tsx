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
vi.mock('@/modules/cloud/graphql', () => ({ getAuthToken: vi.fn().mockResolvedValue('tok') }))
vi.mock('@/modules/invites/lib/client', () => ({ applyInviteCodeSecret: vi.fn() }))

import { useCanSign } from '@/modules/cloud/hooks/use-can-sign'
import { createNewEnvironmentController } from '@/modules/cloud/controller'
import { applyConfigChanges } from '@/modules/cloud/config/apply'
import { applyInviteCodeSecret } from '@/modules/invites/lib/client'
import { STUDIO_AGENT_PACKAGE, STUDIO_AGENT_VERSION } from '@/modules/cloud/studio/constants'
import { useCreateStudioEnvironment } from '@/modules/cloud/studio/use-create-studio-environment'

/** Minimal controller whose push() resolves to a fixed remote document id. */
function mockController() {
  const push = vi
    .fn()
    .mockResolvedValue({ remoteDocument: { id: 'aa726a95-1111-2222-3333-444455556666' } })
  const ctrl = {
    setOwner: vi.fn(),
    setLabel: vi.fn(),
    initialize: vi.fn(),
    addPackage: vi.fn(),
    enableService: vi.fn(),
    approveChanges: vi.fn(),
    push,
  }
  vi.mocked(createNewEnvironmentController).mockReturnValue(ctrl as never)
  vi.mocked(useCanSign).mockReturnValue({
    canSign: true,
    loading: false,
    signer: { user: { address: '0xMe' } } as never,
  })
  return ctrl
}

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
    expect(addPackage).toHaveBeenCalledWith({
      packageName: STUDIO_AGENT_PACKAGE,
      version: STUDIO_AGENT_VERSION,
    })
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
    expect(applyInviteCodeSecret).not.toHaveBeenCalled()
    expect(res).toEqual({
      documentId: 'aa726a95-1111-2222-3333-444455556666',
      subdomain: 'warm-newt-75',
      tenantId: 'warm-newt-75-aa726a95',
    })
  })

  it('injects the invite-code key server-side when no key is passed', async () => {
    const ctrl = mockController()
    vi.mocked(applyInviteCodeSecret).mockResolvedValue({
      injected: true,
      secretNames: ['ANTHROPIC_API_KEY'],
    })

    const { result } = renderHook(() => useCreateStudioEnvironment())
    let res: { tenantId: string } | undefined
    await act(async () => {
      res = await result.current()
    })

    // No client-side secret write on the injection path.
    expect(applyConfigChanges).not.toHaveBeenCalled()
    expect(applyInviteCodeSecret).toHaveBeenCalledOnce()
    const [tenantId, secretNames] = vi.mocked(applyInviteCodeSecret).mock.calls[0]
    expect(tenantId).toBe('warm-newt-75-aa726a95')
    expect([...secretNames].sort()).toEqual(
      ['ANTHROPIC_API_KEY', 'VETRA_ANTHROPIC_API_KEY', 'VETRA_CLI_ANTHROPIC_API_KEY'].sort(),
    )
    expect(ctrl.approveChanges).toHaveBeenCalledOnce()
    expect(ctrl.push).toHaveBeenCalledTimes(2)
    expect(res?.tenantId).toBe('warm-newt-75-aa726a95')
  })

  it('throws when no key is passed and the code carries none', async () => {
    mockController()
    vi.mocked(applyInviteCodeSecret).mockResolvedValue({ injected: false, secretNames: [] })

    const { result } = renderHook(() => useCreateStudioEnvironment())
    await expect(result.current()).rejects.toThrow(/no anthropic api key/i)
    expect(applyConfigChanges).not.toHaveBeenCalled()
  })
})
