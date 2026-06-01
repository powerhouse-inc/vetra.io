import type { RenownAuth } from '@powerhousedao/reactor-browser'

/**
 * Builds the OpenPanel identity traits from the Renown auth state.
 *
 * Inspired by Connect (`apps/connect/src/components/openpanel-traits.ts`), but
 * sourced from the flattened `useRenownAuth()` result rather than the raw
 * `@renown/sdk` `User`. Building from an explicit allow-list means the
 * `credential` (JWT) can never accidentally make it into the payload.
 *
 * Rules:
 * - `profileId` is sent as the top-level `profileId` key in the `identify()`
 *   call — it is **not** duplicated inside properties.
 * - Optional fields are only included when non-nullish (guards against both
 *   `null` from `RenownProfile` fields and plain `undefined`).
 */
export function buildTraits(auth: RenownAuth): Record<string, unknown> {
  const traits: Record<string, unknown> = {}

  if (auth.address != null) traits.address = auth.address
  if (auth.ensName != null) traits.ensName = auth.ensName
  if (auth.avatarUrl != null) traits.avatarUrl = auth.avatarUrl
  if (auth.displayName != null) traits.displayName = auth.displayName

  // profile fields — optional on the Renown user; members can be null.
  const profile = auth.user?.profile
  if (profile?.username != null) traits.username = profile.username
  if (profile?.userImage != null) traits.userImage = profile.userImage
  if (profile?.documentId != null) traits.profileDocumentId = profile.documentId
  if (profile?.createdAt != null) traits.profileCreatedAt = profile.createdAt

  return traits
}
