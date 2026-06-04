import { beforeEach, describe, expect, it, vi } from 'vitest'
import { verifyAuthBearerToken } from '@renown/sdk'
import { verifyRenownIdentity } from '@/modules/invites/lib/verify-identity'

vi.mock('@renown/sdk', () => ({ verifyAuthBearerToken: vi.fn() }))

const mockVerify = vi.mocked(verifyAuthBearerToken)

// Resolve the mock with an arbitrary shape without fighting the SDK's types.
type Verified = Awaited<ReturnType<typeof verifyAuthBearerToken>>
const resolve = (value: unknown) => mockVerify.mockResolvedValue(value as Verified)
const credential = (subject: Record<string, unknown>) => ({
  verifiableCredential: { credentialSubject: subject },
})

describe('verifyRenownIdentity', () => {
  beforeEach(() => {
    mockVerify.mockReset()
  })

  it('returns null when the token fails verification', async () => {
    resolve(false)
    expect(await verifyRenownIdentity('bad-token')).toBeNull()
  })

  it('derives the did:pkh and lowercases the address', async () => {
    resolve(credential({ address: '0xAbC123', chainId: 1, networkId: 'eip155' }))
    expect(await verifyRenownIdentity('token')).toEqual({
      did: 'did:pkh:eip155:1:0xabc123',
      address: '0xabc123',
    })
  })

  it('handles a string chainId', async () => {
    resolve(credential({ address: '0xabc', chainId: '137', networkId: 'eip155' }))
    const result = await verifyRenownIdentity('token')
    expect(result?.did).toBe('did:pkh:eip155:137:0xabc')
  })

  it('returns null when required subject fields are missing', async () => {
    resolve(credential({ address: '0xabc' })) // no chainId / networkId
    expect(await verifyRenownIdentity('token')).toBeNull()
  })
})
