/**
 * The minimal, flattened shape `buildTraits` needs. Decoupled from the
 * `@renown/sdk` `User` (whose shape drifts between versions) so it can be
 * built from whatever auth state is at hand — see `analytics-provider.tsx`.
 */
export interface RenownTraitsSource {
  address?: string | null
  did?: string | null
  networkId?: string | null
  chainId?: number | null
  ensName?: string | null
  ensAvatar?: string | null
  profile?: {
    username?: string | null
    userImage?: string | null
    documentId?: string | null
    createdAt?: string | null
  } | null
}

/**
 * Builds the OpenPanel identity traits from the Renown auth state.
 *
 * Canonical trait schema (shared with Connect and Renown — each app sends
 * every field it has data for, under these names):
 * - `address`, `did`, `networkId`, `chainId`, `caip2` — wallet/chain facts.
 * - `ensName`, `ensAvatar` — raw ENS facts.
 * - `username`, `userImage`, `profileDocumentId`, `profileCreatedAt` — raw
 *   Renown profile facts.
 *
 * Rules:
 * - Building from an explicit allow-list means the `credential` (JWT) can
 *   never accidentally make it into the payload.
 * - Traits carry raw facts only; resolved presentation values (avatar,
 *   display name) go in OpenPanel's native identify fields — see
 *   {@link buildIdentifyPayload}.
 * - Fields are only included when non-nullish.
 */
export function buildTraits(source: RenownTraitsSource): Record<string, unknown> {
  const traits: Record<string, unknown> = {}

  if (source.address != null) traits.address = source.address
  if (source.did != null) traits.did = source.did
  if (source.networkId != null) traits.networkId = source.networkId
  if (source.chainId != null) traits.chainId = source.chainId
  if (source.networkId != null && source.chainId != null) {
    traits.caip2 = `${source.networkId}:${source.chainId}`
  }

  if (source.ensName != null) traits.ensName = source.ensName
  if (source.ensAvatar != null) traits.ensAvatar = source.ensAvatar

  // profile fields — optional on the Renown user; members can be null.
  const profile = source.profile
  if (profile?.username != null) traits.username = profile.username
  if (profile?.userImage != null) traits.userImage = profile.userImage
  if (profile?.documentId != null) traits.profileDocumentId = profile.documentId
  if (profile?.createdAt != null) traits.profileCreatedAt = profile.createdAt

  return traits
}

/**
 * Builds the full `identify()` payload:
 * - `profileId` is the wallet address — the cross-app profile key shared with
 *   Connect and Renown.
 * - `avatar` / `firstName` are OpenPanel's native profile fields (they drive
 *   the picture and name in the dashboard UI), resolved as
 *   `userImage ?? ensAvatar` and `ensName ?? username`.
 * - `properties` are the raw traits from {@link buildTraits}.
 */
export function buildIdentifyPayload(
  profileId: string,
  source: RenownTraitsSource,
): {
  profileId: string
  avatar?: string
  firstName?: string
  properties: Record<string, unknown>
} {
  const avatar = source.profile?.userImage ?? source.ensAvatar
  const firstName = source.ensName ?? source.profile?.username

  return {
    profileId,
    ...(avatar != null ? { avatar } : {}),
    ...(firstName != null ? { firstName } : {}),
    properties: buildTraits(source),
  }
}
