import { publisherGql, type FetchLike } from '@/modules/publisher/graphql'
import type { InviteCodeCheck, RedeemInviteCodeInput, StudioAccess, Subscription } from './types'

// Same subgraph (vetra-licensing) and error mechanism as vetraPublisher, so the
// publisher transport and PublisherApiError are reused (decision D6).

const SUBSCRIPTION_FIELDS = `licenseId appId appName kind termLabel issuer status start end mode
  environmentId environmentLabel openUrl stoppedAt deleteAfter
  warnings { kind at message }`

type Ns<T> = { vetraSubscriptions: T }

/** Public: no token is sent. One answer for unknown, paused, expired and used up. */
export async function fetchInviteCodeCheck(
  code: string,
  fetchImpl?: FetchLike,
): Promise<InviteCodeCheck> {
  const data = await publisherGql<Ns<{ inviteCode: InviteCodeCheck }>>(
    `query ($code: String!) { vetraSubscriptions { inviteCode(code: $code) { valid appId appName kind termLabel mode } } }`,
    { code },
    null,
    fetchImpl,
  )
  return data.vetraSubscriptions.inviteCode
}

export async function fetchMySubscriptions(
  token: string | null,
  fetchImpl?: FetchLike,
): Promise<Subscription[]> {
  const data = await publisherGql<Ns<{ mySubscriptions: Subscription[] }>>(
    `query { vetraSubscriptions { mySubscriptions { ${SUBSCRIPTION_FIELDS} } } }`,
    {},
    token,
    fetchImpl,
  )
  return data.vetraSubscriptions.mySubscriptions ?? []
}

export async function fetchStudioAccess(
  token: string | null,
  fetchImpl?: FetchLike,
): Promise<StudioAccess> {
  const data = await publisherGql<Ns<{ studioAccess: StudioAccess }>>(
    `query { vetraSubscriptions { studioAccess { allowed licenseId expires hasAttachedKey } } }`,
    {},
    token,
    fetchImpl,
  )
  return data.vetraSubscriptions.studioAccess
}

export async function redeemInviteCode(
  input: RedeemInviteCodeInput,
  token: string | null,
  fetchImpl?: FetchLike,
): Promise<Subscription> {
  const data = await publisherGql<Ns<{ redeemInviteCode: Subscription }>>(
    `mutation ($input: RedeemInviteCodeInput!) { vetraSubscriptions { redeemInviteCode(input: $input) { ${SUBSCRIPTION_FIELDS} } } }`,
    { input },
    token,
    fetchImpl,
  )
  return data.vetraSubscriptions.redeemInviteCode
}

export async function cancelSubscription(
  licenseId: string,
  token: string | null,
  fetchImpl?: FetchLike,
): Promise<boolean> {
  const data = await publisherGql<Ns<{ cancelSubscription: boolean }>>(
    `mutation ($licenseId: String!) { vetraSubscriptions { cancelSubscription(licenseId: $licenseId) } }`,
    { licenseId },
    token,
    fetchImpl,
  )
  return data.vetraSubscriptions.cancelSubscription
}

/** Writes the caller's studio-licence Claude key into a tenant's secrets, server-side. */
export async function applyStudioKey(
  tenantId: string,
  secretNames: string[],
  token: string | null,
  fetchImpl?: FetchLike,
): Promise<boolean> {
  const data = await publisherGql<Ns<{ applyStudioKey: boolean }>>(
    `mutation ($tenantId: String!, $secretNames: [String!]!) { vetraSubscriptions { applyStudioKey(tenantId: $tenantId, secretNames: $secretNames) } }`,
    { tenantId, secretNames },
    token,
    fetchImpl,
  )
  return data.vetraSubscriptions.applyStudioKey
}
