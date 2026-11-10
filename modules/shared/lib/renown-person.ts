import { renownSwitchboardUrl } from '@/modules/shared/config/renown'

/** What a Renown user profile says about a person (renownUsers; public read). */
export type RenownPerson = {
  ethAddress: string
  displayName: string | null
  handle: string | null
  username: string | null
}

const ADDRESS = /^0x[0-9a-f]{40}$/i

/** The Ethereum address in an address or a did:pkh, lower-cased; null for anything else. */
export function addressOf(value: string | null | undefined): string | null {
  const last = value?.split(':').at(-1) ?? ''
  return ADDRESS.test(last) ? last.toLowerCase() : null
}

/** A username that is only an address ("0x2BbE...3aC6", or a full one) names nobody. */
export const looksLikeAddress = (s: string) => /^0x[0-9a-f]{2,}(\.{2,3}|…)?[0-9a-f]*$/i.test(s)

/** How to call a person: their Renown display name, then handle, then a real username. */
export function personName(
  person: Pick<RenownPerson, 'displayName' | 'handle' | 'username'> | null | undefined,
): string | null {
  if (!person) return null
  const display = person.displayName?.trim()
  if (display) return display
  const handle = person.handle?.trim()
  if (handle) return handle
  const username = person.username?.trim()
  return username && !looksLikeAddress(username) ? username : null
}

/** One person's Renown profile by address; null without one. */
export async function fetchRenownPerson(
  address: string,
  fetchImpl: typeof fetch = fetch,
): Promise<RenownPerson | null> {
  const res = await fetchImpl(renownSwitchboardUrl(), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query:
        'query ($input: RenownUsersInput!) { renownUsers(input: $input) { ethAddress displayName handle username } }',
      variables: { input: { ethAddresses: [address.toLowerCase()] } },
    }),
  })
  const body = (await res.json().catch(() => null)) as {
    data?: { renownUsers?: RenownPerson[] }
    errors?: { message?: string }[]
  } | null
  if (!res.ok || body?.errors?.length) {
    throw new Error(body?.errors?.[0]?.message ?? `Renown answered ${res.status}`)
  }
  return body?.data?.renownUsers?.[0] ?? null
}
