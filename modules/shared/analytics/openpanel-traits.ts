/**
 * The minimal, flattened shape `buildTraits` needs. Decoupled from the
 * `@renown/sdk` `User` (whose shape drifts between versions) and from
 * `RenownAuth` (whose React hooks subscribe to a store) so it can be built
 * imperatively from the raw Renown instance — see `analytics-provider.tsx`.
 */
export interface RenownTraitsSource {
  address?: string | null
  ensName?: string | null
  avatarUrl?: string | null
  displayName?: string | null
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
 * Inspired by Connect (`apps/connect/src/components/openpanel-traits.ts`).
 * Building from an explicit allow-list means the `credential` (JWT) can never
 * accidentally make it into the payload.
 *
 * Rules:
 * - `profileId` is sent as the top-level `profileId` key in the `identify()`
 *   call — it is **not** duplicated inside properties.
 * - Optional fields are only included when non-nullish (guards against both
 *   `null` from `RenownProfile` fields and plain `undefined`).
 */
export function buildTraits(source: RenownTraitsSource): Record<string, unknown> {
  const traits: Record<string, unknown> = {}

  if (source.address != null) traits.address = source.address
  if (source.ensName != null) traits.ensName = source.ensName
  if (source.avatarUrl != null) traits.avatarUrl = source.avatarUrl
  if (source.displayName != null) traits.displayName = source.displayName

  // profile fields — optional on the Renown user; members can be null.
  const profile = source.profile
  if (profile?.username != null) traits.username = profile.username
  if (profile?.userImage != null) traits.userImage = profile.userImage
  if (profile?.documentId != null) traits.profileDocumentId = profile.documentId
  if (profile?.createdAt != null) traits.profileCreatedAt = profile.createdAt

  return traits
}
