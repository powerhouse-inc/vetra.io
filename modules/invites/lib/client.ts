// Browser client for the `vetra-access-codes` subgraph on the cloud Switchboard
// (served by @powerhousedao/vetra-cloud-package). Queries are namespaced under
// `VetraAccessCodes`; redeem/status carry the caller's Renown bearer token so the
// gateway can identify the user — the subgraph derives the DID from the
// verified token, the client never asserts it.

import { BEARER_TOKEN_TTL_SECONDS } from './constants'

function readEnv(key: string): string {
  if (typeof window !== 'undefined') {
    const windowEnv = (window as unknown as { __ENV?: Record<string, string> }).__ENV
    if (windowEnv?.[key]) return windowEnv[key]
  }
  return process.env[key] ?? ''
}

function getEndpoint(): string {
  return (
    readEnv('NEXT_PUBLIC_CLOUD_SWITCHBOARD_URL') ||
    readEnv('NEXT_PUBLIC_SWITCHBOARD_URL') ||
    'https://switchboard.vetra.io/graphql'
  )
}

export type AccessStatus = {
  allowed: boolean
  code?: string | null
  label?: string | null
  accessExpires?: string | null
  /** Whether the caller's redeemed code carries a Claude key (the key itself is never sent). */
  hasAttachedKey?: boolean
}

export type ApplyInviteCodeSecretResult = {
  injected: boolean
  secretNames: string[]
}

type GqlResponse<T> = {
  data?: T
  errors?: Array<{ message?: string }>
}

async function gql<T>(
  query: string,
  variables: Record<string, unknown>,
  token?: string | null,
): Promise<T | null> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  try {
    const res = await fetch(getEndpoint(), {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    })
    if (!res.ok) return null
    const json = (await res.json()) as GqlResponse<T>
    if (json.errors?.length || !json.data) return null
    return json.data
  } catch {
    return null
  }
}

/** The Renown bearer token (a DID-JWT) the gateway verifies to identify the user. */
export async function getRenownToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null
  const renown = (
    window as unknown as {
      ph?: { renown?: { getBearerToken: (o: { expiresIn: number }) => Promise<string | null> } }
    }
  ).ph?.renown
  if (!renown) return null
  try {
    // No `aud`: the switchboard's verifyAuthBearerToken configures no expected
    // audience, and did-jwt rejects a token carrying `aud`. Mirrors the cloud
    // client's token minting.
    return await renown.getBearerToken({ expiresIn: BEARER_TOKEN_TTL_SECONDS })
  } catch {
    return null
  }
}

/** Validate-only: is the code currently usable? Never consumes it. Public. */
export async function inviteCodeValid(code: string): Promise<boolean> {
  const data = await gql<{ VetraAccessCodes: { inviteCodeValid: boolean } }>(
    `query ($code: String!) { VetraAccessCodes { inviteCodeValid(code: $code) } }`,
    { code },
  )
  return data?.VetraAccessCodes?.inviteCodeValid ?? false
}

/** Redeem a code for the authenticated caller. Returns null on failure. */
export async function redeemInviteCode(code: string, token: string): Promise<AccessStatus | null> {
  const data = await gql<{ VetraAccessCodes: { redeemInviteCode: AccessStatus } }>(
    `mutation ($code: String!) {
      VetraAccessCodes { redeemInviteCode(code: $code) { allowed code label accessExpires hasAttachedKey } }
    }`,
    { code },
    token,
  )
  return data?.VetraAccessCodes?.redeemInviteCode ?? null
}

/** Access status for the authenticated caller. Returns null on failure. */
export async function myAccessStatus(token: string): Promise<AccessStatus | null> {
  const data = await gql<{ VetraAccessCodes: { myAccessStatus: AccessStatus } }>(
    `query { VetraAccessCodes { myAccessStatus { allowed code label accessExpires hasAttachedKey } } }`,
    {},
    token,
  )
  return data?.VetraAccessCodes?.myAccessStatus ?? null
}

/**
 * Ask the subgraph to write the caller's attached Claude key into a tenant's
 * secret store under each of `secretNames`. The key is resolved and written
 * server-side — it never reaches this client. Returns `injected: false` when
 * the caller's redeemed code carries no key. Returns null on transport failure.
 */
export async function applyInviteCodeSecret(
  tenantId: string,
  secretNames: string[],
  token: string,
): Promise<ApplyInviteCodeSecretResult | null> {
  const data = await gql<{
    VetraAccessCodes: { applyInviteCodeSecret: ApplyInviteCodeSecretResult }
  }>(
    `mutation ($tenantId: String!, $secretNames: [String!]!) {
      VetraAccessCodes {
        applyInviteCodeSecret(tenantId: $tenantId, secretNames: $secretNames) {
          injected
          secretNames
        }
      }
    }`,
    { tenantId, secretNames },
    token,
  )
  return data?.VetraAccessCodes?.applyInviteCodeSecret ?? null
}
