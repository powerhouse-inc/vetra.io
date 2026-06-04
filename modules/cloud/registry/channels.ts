const CHANNEL_RE = /^v?(\d+)\.(\d+)\.(\d+)-([a-zA-Z]+)\.(\d+)$/
const STABLE_RE = /^v?(\d+)\.(\d+)\.(\d+)$/

type Parsed = {
  tag: string
  major: number
  minor: number
  patch: number
  bump: number
}

function parseTag(tag: string): { channel: string; parsed: Parsed } | null {
  const channelMatch = tag.match(CHANNEL_RE)
  if (channelMatch) {
    const [, maj, min, pat, channel, bump] = channelMatch
    return {
      channel: channel.toLowerCase(),
      parsed: {
        tag,
        major: Number(maj),
        minor: Number(min),
        patch: Number(pat),
        bump: Number(bump),
      },
    }
  }
  const stableMatch = tag.match(STABLE_RE)
  if (stableMatch) {
    const [, maj, min, pat] = stableMatch
    return {
      channel: 'latest',
      parsed: {
        tag,
        major: Number(maj),
        minor: Number(min),
        patch: Number(pat),
        bump: Number.POSITIVE_INFINITY,
      },
    }
  }
  return null
}

function isNewer(a: Parsed, b: Parsed): boolean {
  if (a.major !== b.major) return a.major > b.major
  if (a.minor !== b.minor) return a.minor > b.minor
  if (a.patch !== b.patch) return a.patch > b.patch
  return a.bump > b.bump
}

/**
 * Normalize a user-picked tag into the image tag the service deployment
 * expects. Semver versions arrive bare from the registry/npm (e.g. `1.2.3`)
 * but deployments pin images by `v`-prefixed tag (`v1.2.3`), so bare semver
 * gets a `v`. Floating Docker tags (`latest`, `dev`, `staging`) and
 * already-`v`-prefixed semver are passed through untouched — prefixing those
 * would point at a tag that doesn't exist (e.g. the `vlatest` bug).
 */
export function toServiceImageTag(version: string): string {
  return /^\d/.test(version) ? `v${version}` : version
}

export function computeDistTags(tags: string[]): Record<string, string> {
  const buckets: Record<string, Parsed> = {}
  for (const tag of tags) {
    const result = parseTag(tag)
    if (!result) continue
    const current = buckets[result.channel]
    if (!current || isNewer(result.parsed, current)) {
      buckets[result.channel] = result.parsed
    }
  }
  return Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, v.tag]))
}

/**
 * Sort tags newest-first using channel-aware semver order.
 * Tags that don't match either regex (e.g., floating Docker tags like `dev`,
 * `staging`, `latest`) are bubbled to the very top so users can pick them
 * to pin to "always-newest-of-channel-X".
 */
export function sortTagsNewestFirst(tags: string[]): string[] {
  const matched: Parsed[] = []
  const unmatched: string[] = []
  for (const tag of tags) {
    const result = parseTag(tag)
    if (result) matched.push(result.parsed)
    else unmatched.push(tag)
  }
  matched.sort((a, b) => (isNewer(a, b) ? -1 : isNewer(b, a) ? 1 : 0))
  return [...unmatched, ...matched.map((p) => p.tag)]
}
