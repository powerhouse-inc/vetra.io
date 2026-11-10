import { describe, expect, it, vi } from 'vitest'
import { addressOf, fetchRenownPerson, personName } from '../renown-person'

const FRANK = '0x2bbea0145d6fb9c6709a74c1179ca0be71bb3ac6'

describe('addressOf', () => {
  it('takes the address out of a did:pkh, lower-cased, and passes an address through', () => {
    expect(addressOf(`did:pkh:eip155:137:0x2BbEA0145d6fB9C6709a74C1179CA0Be71BB3aC6`)).toBe(FRANK)
    expect(addressOf('0x2BbEA0145d6fB9C6709a74C1179CA0Be71BB3aC6')).toBe(FRANK)
    expect(addressOf('did:key:z6Mk')).toBeNull()
    expect(addressOf('')).toBeNull()
  })
})

describe('personName', () => {
  it('prefers the display name, then the handle', () => {
    expect(personName({ displayName: 'Frank', handle: 'frank', username: 'x' })).toBe('Frank')
    expect(personName({ displayName: ' ', handle: 'frank', username: null })).toBe('frank')
  })

  it('uses a username only when it is a name, never an address', () => {
    expect(personName({ displayName: null, handle: null, username: 'wouter' })).toBe('wouter')
    expect(personName({ displayName: null, handle: null, username: '0x2BbE...3aC6' })).toBeNull()
    expect(personName({ displayName: null, handle: null, username: FRANK })).toBeNull()
    expect(personName(null)).toBeNull()
  })
})

describe('fetchRenownPerson', () => {
  it('asks Renown for the profile of one address', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            data: {
              renownUsers: [
                {
                  ethAddress: FRANK,
                  displayName: 'Frank',
                  handle: 'frank',
                  username: '0x2BbE...3aC6',
                },
              ],
            },
          }),
        ),
      ),
    )
    const person = await fetchRenownPerson(FRANK, fetchImpl as unknown as typeof fetch)
    expect(person?.displayName).toBe('Frank')
    const body = JSON.parse(
      (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
    ) as {
      variables: { input: { ethAddresses: string[] } }
    }
    expect(body.variables.input.ethAddresses).toStrictEqual([FRANK])
  })

  it('is null for an address without a profile', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ data: { renownUsers: [] } }))),
    )
    expect(await fetchRenownPerson(FRANK, fetchImpl as unknown as typeof fetch)).toBeNull()
  })
})
