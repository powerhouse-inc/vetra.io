/**
 * Vetra-curated allowlist for the package library.
 *
 * `PACKAGES_RECOMMENDED` is a comma-separated list of npm package names
 * (e.g. "@scope/pkg-a,@scope/pkg-b"). Server-only: no NEXT_PUBLIC_ prefix,
 * never reaches window.__ENV. Unset/empty = no curation (all packages shown,
 * no badges, no toggle).
 *
 * Matching is case-insensitive and keyed on the registry entry name
 * (`pkg.name`) — never `manifest.name`, since some registry entries ship an
 * empty manifest name and registry names are not always lowercase.
 */
export function recommendedNames(): Set<string> {
  return new Set(
    (process.env.PACKAGES_RECOMMENDED ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  )
}

export function isRecommended(name: string): boolean {
  return recommendedNames().has(name.toLowerCase())
}
