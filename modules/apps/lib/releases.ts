import type { AppRelease } from '../types'

/** First page of the Releases tab, and what "Show more" raises it to (the API's maximum). */
export const RELEASES_LIMIT = 50
export const RELEASES_MORE_LIMIT = 200

export type ReleaseBadge = 'Release' | 'Prerelease' | 'Build'

/** The server's rule: `x.y.z-alpha.N`, `-beta.N` or `-rc.N`, nothing more. */
const PRERELEASE = /^\d+\.\d+\.\d+-(alpha|beta|rc)\.\d+$/

/** "Build", or "Release" / "Prerelease" by the version's prerelease part (alpha, beta, rc). */
export function releaseBadge(r: Pick<AppRelease, 'kind' | 'version'>): ReleaseBadge {
  if (r.kind === 'build') return 'Build'
  return PRERELEASE.test(r.version) ? 'Prerelease' : 'Release'
}

/** `sha256:3b99fd52…`: the algorithm and the first 8 hex characters. */
export function shortDigest(digest: string): string {
  const m = /^([a-z0-9]+):([0-9a-f]+)$/i.exec(digest)
  if (!m || m[2].length <= 8) return digest
  return `${m[1]}:${m[2].slice(0, 8)}…`
}

const PACKAGE_NAME = /^(@[\w.-]+\/)?[\w.-]+$/

/** A released package's page on the Vetra registry; builds and odd names are not linked. */
export function releasePackageUrl(r: Pick<AppRelease, 'kind'>, name: string): string | null {
  return r.kind === 'release' && PACKAGE_NAME.test(name)
    ? `https://registry.vetra.io/${name}`
    : null
}
