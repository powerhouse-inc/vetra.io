import { verifyAuthBearerToken } from '@renown/sdk'

export interface VerifiedIdentity {
  /** did:pkh:eip155:1:0x… — the canonical ecosystem identity (matches ?user=). */
  did: string
  address: string
}

interface AuthCredentialSubject {
  address?: string
  chainId?: number | string
  networkId?: string
}

/**
 * Verifies a Renown bearer token (a DID-JWT verifiable credential) and returns
 * the authoritative identity. The token is cryptographically self-verifying —
 * verifyAuthBearerToken resolves the signing key from the JWT, checks the
 * signature and expiry, and asserts it's an auth credential — so no network call
 * to Renown is needed, and the address comes from the signed payload (the client
 * can't spoof it). Returns null if verification fails.
 */
export async function verifyRenownIdentity(token: string): Promise<VerifiedIdentity | null> {
  const verified = await verifyAuthBearerToken(token)
  if (!verified) return null

  const subject = (
    verified as { verifiableCredential?: { credentialSubject?: AuthCredentialSubject } }
  ).verifiableCredential?.credentialSubject
  const address = subject?.address
  const chainId = subject?.chainId
  const networkId = subject?.networkId
  if (!address || chainId === undefined || chainId === null || !networkId) return null

  return {
    did: `did:pkh:${networkId}:${chainId}:${address.toLowerCase()}`,
    address: address.toLowerCase(),
  }
}
