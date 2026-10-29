import { type PackageInfo } from '@powerhousedao/shared'
import { packageModuleTypes } from './constants'
import { isRecommended } from './recommended'
import { getPackageRegistryData, listPackages, npmName, type RegistryPackageData } from './registry'
import { type PackageModuleType } from './types'

/** Major version of the Powerhouse platform the cloud runs. Older packages don't load on it. */
export const PLATFORM_MAJOR = 6

const STALE_AFTER_MS = 365 * 24 * 60 * 60 * 1000

/** One package as the public directory shows it. */
export type DirectoryEntry = {
  /** npm name, used for install commands and links. */
  name: string
  title: string
  description: string | null
  category: string | null
  publisher: string | null
  version: string | null
  /** When the latest version was published. */
  releasedAt: string | null
  /** When the package was first published. */
  createdAt: string | null
  modules: Partial<Record<PackageModuleType, number>>
  deprecated: boolean
  /** Platform major the package is built for, from its document-model dependency. */
  platformMajor: number | null
  recommended: boolean
}

export type HiddenReason = 'deprecated' | 'old-platform' | 'stale'

export const HIDDEN_REASON_LABEL: Record<HiddenReason, string> = {
  deprecated: 'Deprecated',
  'old-platform': `Built for an older platform`,
  stale: 'No release in 12 months',
}

/** Why a package is left out of the default listing, or null when it is listed. */
export function hiddenReason(entry: DirectoryEntry, now: number): HiddenReason | null {
  if (entry.deprecated) return 'deprecated'
  if (entry.platformMajor !== null && entry.platformMajor < PLATFORM_MAJOR) return 'old-platform'
  if (entry.releasedAt && now - Date.parse(entry.releasedAt) > STALE_AFTER_MS) return 'stale'
  return null
}

/** Default description the package generator writes; it says nothing about the package. */
const TEMPLATE_DESCRIPTION = 'This Document Model Boilerplate provides'

/** A registry description as plain text: markdown emphasis and links reduced to their words. */
export function plainDescription(text: string | null | undefined): string | null {
  if (!text || text.startsWith(TEMPLATE_DESCRIPTION)) return null
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__|`)/g, '')
    .trim()
}

/** Major version in a dependency range like "6.2.2-dev.47", "^5.0.0" or "~4.1". */
export function majorOf(range: string | undefined): number | null {
  const match = range?.match(/(\d+)\./)
  return match ? Number(match[1]) : null
}

export function toDirectoryEntry(
  pkg: PackageInfo,
  data: RegistryPackageData | null,
): DirectoryEntry {
  const name = npmName(pkg)
  const latest = data?.['dist-tags'].latest ?? pkg.version ?? null
  const latestData = latest ? data?.versions[latest] : undefined
  const manifest = pkg.manifest
  const modules: DirectoryEntry['modules'] = {}
  for (const type of packageModuleTypes) {
    const list: unknown = manifest?.[type]
    if (Array.isArray(list) && list.length > 0) modules[type] = list.length
  }
  const platformRange =
    latestData?.peerDependencies?.['document-model'] ?? latestData?.dependencies?.['document-model']

  return {
    name,
    title: manifest?.name || name,
    description: plainDescription(manifest?.description || latestData?.description),
    category: manifest?.category || null,
    publisher: manifest?.publisher?.name || null,
    version: latest,
    releasedAt: (latest && data?.time?.[latest]) || data?.time?.modified || null,
    createdAt: data?.time?.created ?? null,
    modules,
    deprecated: Boolean(latestData?.deprecated),
    platformMajor: majorOf(platformRange),
    recommended: isRecommended(pkg.name),
  }
}

export type DirectoryTab = 'updated' | 'new' | 'recommended'

const newestFirst = (a: string | null, b: string | null) =>
  (b ? Date.parse(b) : 0) - (a ? Date.parse(a) : 0)

/** Search, tab and the hidden filter applied to the full list. */
export function directoryView(
  entries: readonly DirectoryEntry[],
  { tab, query, showHidden }: { tab: DirectoryTab; query: string; showHidden: boolean },
  now: number,
): { entries: DirectoryEntry[]; hiddenCount: number } {
  const q = query.trim().toLowerCase()
  const matching = entries.filter(
    (e) =>
      !q ||
      [e.name, e.title, e.description, e.category, e.publisher].some((field) =>
        field?.toLowerCase().includes(q),
      ),
  )
  const inTab = tab === 'recommended' ? matching.filter((e) => e.recommended) : matching
  const listed = inTab.filter((e) => showHidden || !hiddenReason(e, now))
  const sorted = [...listed].sort((a, b) =>
    tab === 'new' ? newestFirst(a.createdAt, b.createdAt) : newestFirst(a.releasedAt, b.releasedAt),
  )
  return { entries: sorted, hiddenCount: inTab.length - listed.length }
}

/** Every registry package with its release dates (one registry lookup per package). */
export async function loadDirectory(): Promise<DirectoryEntry[]> {
  const page = await listPackages(
    { limit: 500 },
    { detail: 'full', init: { next: { revalidate: 600 } } },
  )
  return Promise.all(
    page.items.map(async (pkg) =>
      toDirectoryEntry(pkg, await getPackageRegistryData(npmName(pkg))),
    ),
  )
}
