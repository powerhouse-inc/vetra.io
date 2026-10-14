import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCreateEnvironment } from '../hooks/use-create-environment'

vi.mock('../hooks/use-can-sign', () => ({ useCanSign: vi.fn() }))
vi.mock('../controller', () => ({ createNewEnvironmentController: vi.fn() }))

import { useCanSign } from '../hooks/use-can-sign'
import { createNewEnvironmentController } from '../controller'

describe('useCreateEnvironment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws when no signer', async () => {
    vi.mocked(useCanSign).mockReturnValue({ canSign: false, signer: null, loading: false })
    const { result } = renderHook(() => useCreateEnvironment())
    await expect(
      result.current({
        label: 'env-1',
        subdomain: 'foo',
        baseDomain: 'vetra.io',
        enabledServices: [],
      }),
    ).rejects.toThrow(/logged in/i)
  })

  it('throws when signer has no user address', async () => {
    vi.mocked(useCanSign).mockReturnValue({
      canSign: true,
      signer: { sign: vi.fn() } as never,
      loading: false,
    })
    const { result } = renderHook(() => useCreateEnvironment())
    await expect(
      result.current({ label: 'e', subdomain: 'foo', baseDomain: 'vetra.io', enabledServices: [] }),
    ).rejects.toThrow(/no user address/i)
    expect(createNewEnvironmentController).not.toHaveBeenCalled()
  })

  it('dispatches actions then pushes; returns documentId', async () => {
    const fakeSigner = { sign: vi.fn(), user: { address: '0xMe' } }
    const setOwner = vi.fn()
    const setLabel = vi.fn()
    const initialize = vi.fn()
    const enableService = vi.fn()
    const push = vi.fn().mockResolvedValue({ remoteDocument: { id: 'new-doc-id' } })
    const ctrl = { setOwner, setLabel, initialize, enableService, push }

    vi.mocked(useCanSign).mockReturnValue({
      canSign: true,
      signer: fakeSigner as never,
      loading: false,
    })
    vi.mocked(createNewEnvironmentController).mockReturnValue(ctrl as never)

    const { result } = renderHook(() => useCreateEnvironment())

    let res
    await act(async () => {
      res = await result.current({
        label: 'env-1',
        subdomain: 'foo',
        baseDomain: 'vetra.io',
        defaultPackageRegistry: 'https://registry.dev.vetra.io',
        enabledServices: [
          { type: 'CONNECT', prefix: 'connect' },
          { type: 'SWITCHBOARD', prefix: 'switchboard' },
        ],
      })
    })

    expect(setOwner).toHaveBeenCalledWith({ address: '0xMe' })
    expect(setLabel).toHaveBeenCalledWith({ label: 'env-1' })
    expect(initialize).toHaveBeenCalledWith({
      genericSubdomain: 'foo',
      genericBaseDomain: 'vetra.io',
      defaultPackageRegistry: 'https://registry.dev.vetra.io',
    })
    expect(enableService).toHaveBeenCalledTimes(2)
    expect(enableService).toHaveBeenNthCalledWith(1, { type: 'CONNECT', prefix: 'connect' })
    expect(enableService).toHaveBeenNthCalledWith(2, { type: 'SWITCHBOARD', prefix: 'switchboard' })
    expect(push).toHaveBeenCalledOnce()
    expect(res).toEqual({ documentId: 'new-doc-id' })
  })
})
