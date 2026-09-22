'use client'
import { useRenownAuth } from '@powerhousedao/reactor-browser'

/**
 * Drive identity convention for the multi-drive ownership model (see
 * docs/superpowers/specs/2026-05-14-multi-drive-ownership-design.md).
 *
 * - User drive: `user:<eth-address-lowercase>`
 * - Team drive: `team:<slug>`
 * - Legacy:     anything else (typically `powerhouse` during migration)
 */
export type DriveId = string

export type ParsedDriveId =
  { type: 'user'; key: string } | { type: 'team'; key: string } | { type: 'legacy'; key: string }

const USER_PREFIX = 'user:'
const TEAM_PREFIX = 'team:'

/**
 * Return the drive id for a user identified by their Ethereum address.
 * Eth addresses are lowercased so drive ids are case-stable across callers.
 */
export function userDriveFor(ethAddress: string): DriveId {
  return `${USER_PREFIX}${ethAddress.toLowerCase()}`
}

/**
 * Return the drive id for a team identified by its slug. Team slugs are
 * already lowercased by the create-team validation, so we pass them through
 * verbatim.
 */
export function teamDriveFor(slug: string): DriveId {
  return `${TEAM_PREFIX}${slug}`
}

/**
 * Classify a drive id by its prefix. Any value that doesn't match the
 * `user:` or `team:` prefixes is treated as a legacy drive (most notably
 * `powerhouse` during the Phase 0/1 migration window).
 */
export function parseDriveId(driveId: string): ParsedDriveId {
  if (driveId.startsWith(USER_PREFIX)) {
    return { type: 'user', key: driveId.slice(USER_PREFIX.length) }
  }
  if (driveId.startsWith(TEAM_PREFIX)) {
    return { type: 'team', key: driveId.slice(TEAM_PREFIX.length) }
  }
  return { type: 'legacy', key: driveId }
}

/** True iff the drive id is in the new `user:<eth>` form. */
export function isUserDrive(driveId: string): boolean {
  return driveId.startsWith(USER_PREFIX)
}

/** True iff the drive id is in the new `team:<slug>` form. */
export function isTeamDrive(driveId: string): boolean {
  return driveId.startsWith(TEAM_PREFIX)
}

/**
 * Hook that returns the current user's drive id, derived from their
 * authenticated Ethereum address. Returns `null` while auth is loading or
 * if the user isn't signed in.
 */
export function useUserDrive(): DriveId | null {
  const auth = useRenownAuth()
  // `status` stays "initial" after a reload even with a restored user, so key
  // off the address (set iff a user is present), matching useViewerAddress.
  if (!auth.address) return null
  return userDriveFor(auth.address)
}
