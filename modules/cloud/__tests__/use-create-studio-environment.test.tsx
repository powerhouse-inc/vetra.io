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
vi.mock('@/modules/cloud/studio/pool-client', () => ({
  claimStudioEnvironment: vi.fn(),
  fetchStudioPoolVersion: vi.fn().mockResolvedValue(null),
}))
vi.mock('@/modules/cloud/studio/llm-client', () => ({ provisionStudioLlm: vi.fn() }))

import { useCanSign } from '@/modules/cloud/hooks/use-can-sign'
import { createNewEnvironmentController } from '@/modules/cloud/controller'
import { applyConfigChanges } from '@/modules/cloud/config/apply'
import { getAuthToken } from '@/modules/cloud/graphql'
import { claimStudioEnvironment } from '@/modules/cloud/studio/pool-client'
import { provisionStudioLlm } from '@/modules/cloud/studio/llm-client'
import { STUDIO_AGENT_PACKAGE, STUDIO_AGENT_VERSION } from '@/modules/cloud/studio/constants'
import { useCreateStudioEnvironment } from '@/modules/cloud/studio/use-create-studio-environment'

const DOC = 'aa726a95-1111-2222-3333-444455556666'
const TENANT = 'warm-newt-75-aa726a95'

/** Minimal controller whose push() resolves to a fixed remote document id. */
function mockController() {
  const push = vi.fn().mockResolvedValue({ remoteDocument: { id: DOC } })
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
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAuthToken).mockResolvedValue('tok')
  })

  it('throws without a signer', async () => {
    vi.mocked(useCanSign).mockReturnValue({ canSign: false, signer: null, loading: false })
    const { result } = renderHook(() => useCreateStudioEnvironment())
    await expect(result.current()).rejects.toThrow(/logged in/i)
  })

  it('returns a claimed warm Studio without cold provisioning', async () => {
    const ctrl = mockController()
    vi.mocked(claimStudioEnvironment).mockResolvedValue({
      documentId: 'd',
      subdomain: 's',
      tenantId: 't',
    })
    const { result } = renderHook(() => useCreateStudioEnvironment())
    await expect(result.current()).resolves.toEqual({
      documentId: 'd',
      subdomain: 's',
      tenantId: 't',
    })
    expect(ctrl.push).not.toHaveBeenCalled()
    expect(provisionStudioLlm).not.toHaveBeenCalled()
  })

  it('cold path: creates the env, provisions its model server-side, writes the vars, approves', async () => {
    const ctrl = mockController()
    vi.mocked(claimStudioEnvironment).mockResolvedValue(null)
    vi.mocked(provisionStudioLlm).mockResolvedValue({
      environmentId: DOC,
      connected: true,
      llmBudgetUsd: 20,
    })
    const { result } = renderHook(() => useCreateStudioEnvironment())
    let res: unknown
    await act(async () => {
      res = await result.current()
    })
    expect(ctrl.addPackage).toHaveBeenCalledWith({
      packageName: STUDIO_AGENT_PACKAGE,
      version: STUDIO_AGENT_VERSION,
    })
    expect(provisionStudioLlm).toHaveBeenCalledWith(TENANT, 'tok')
    expect(applyConfigChanges).toHaveBeenCalledOnce()
    const changes = vi.mocked(applyConfigChanges).mock.calls[0][1]
    expect(changes.map((c) => c.name).sort()).toEqual([
      'VETRA_CLOUD_SWITCHBOARD_URL',
      'VETRA_ENVIRONMENT_ID',
    ])
    // No key is ever written client-side.
    expect(changes.some((c) => /ANTHROPIC|OPENROUTER/.test(c.name))).toBe(false)
    expect(ctrl.approveChanges).toHaveBeenCalledOnce()
    expect(res).toEqual({ documentId: DOC, subdomain: 'warm-newt-75', tenantId: TENANT })
  })

  it.each([
    ['no budget', { environmentId: DOC, connected: false, llmBudgetUsd: 0 }],
    ['broker not configured', null],
  ])(
    'still finishes creation with %s (the Studio serves in connect-a-model mode)',
    async (_label, provision) => {
      const ctrl = mockController()
      vi.mocked(claimStudioEnvironment).mockResolvedValue(null)
      vi.mocked(provisionStudioLlm).mockResolvedValue(provision)
      const { result } = renderHook(() => useCreateStudioEnvironment())
      await act(async () => {
        await result.current()
      })
      expect(ctrl.approveChanges).toHaveBeenCalledOnce()
    },
  )

  it('throws and does not approve when provisioning fails for real', async () => {
    const ctrl = mockController()
    vi.mocked(claimStudioEnvironment).mockResolvedValue(null)
    vi.mocked(provisionStudioLlm).mockRejectedValue(new Error('network down'))
    const { result } = renderHook(() => useCreateStudioEnvironment())
    await expect(result.current()).rejects.toThrow('network down')
    expect(ctrl.approveChanges).not.toHaveBeenCalled()
  })

  it('refuses the cold path without a token', async () => {
    const ctrl = mockController()
    vi.mocked(getAuthToken).mockResolvedValue(null as never)
    const { result } = renderHook(() => useCreateStudioEnvironment())
    await expect(result.current()).rejects.toThrow(/authenticate/i)
    expect(ctrl.approveChanges).not.toHaveBeenCalled()
  })
})
