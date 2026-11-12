import { isAppsError } from '../graphql'
import type { AppAccess } from '../types'

export const NO_ACCESS: AppAccess = {
  operate: false,
  release: false,
  administer: false,
  releaseManager: false,
}

/**
 * A backend without `appAccess` (before release managers): the App page is the owner's, as it
 * was, with no audit log and no release managers to name.
 */
export const LEGACY_ACCESS: AppAccess = {
  operate: true,
  release: true,
  administer: false,
  releaseManager: false,
}

export type ResolvedAccess = {
  /** null while it loads. */
  access: AppAccess | null
  /** The backend serves the audit log and roles (it knows `appAccess`). */
  supported: boolean
}

/**
 * What the caller may do, from the `appAccess` query: an error (FORBIDDEN, network) is no access;
 * a backend that lacks the field keeps the page as it was before release managers.
 */
export function resolveAccess(query: {
  data: AppAccess | undefined
  error: unknown
  isPending: boolean
}): ResolvedAccess {
  if (query.data) return { access: query.data, supported: true }
  if (query.error) {
    return isAppsError(query.error, 'APPS_UNAVAILABLE')
      ? { access: LEGACY_ACCESS, supported: false }
      : { access: NO_ACCESS, supported: true }
  }
  return { access: null, supported: true }
}

const ADDRESS = /^0x[0-9a-f]{40}$/i

/**
 * The address in what someone typed to name a release manager: `0x` and 40 hex digits, or a
 * did:pkh ending in one; lower-cased. null when it is neither.
 */
export function parseRoleAddress(input: string): string | null {
  const v = input.trim()
  if (ADDRESS.test(v)) return v.toLowerCase()
  if (/^did:pkh:/i.test(v)) {
    const last = v.split(':').at(-1) ?? ''
    return ADDRESS.test(last) ? last.toLowerCase() : null
  }
  return null
}
