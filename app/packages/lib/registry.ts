import { type PackageInfo } from '@powerhousedao/shared'
import { packageModuleTypes, REGISTRY_URL } from './constants'
import { type PackageModuleType } from './types'

export interface RegistryVersionDist {
  tarball: string
  fileCount?: number
  unpackedSize?: number
  integrity?: string
}

export interface RegistryVersion {
  name: string
  version: string
  license?: string
  description?: string
  repository?: { type?: string; url?: string }
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  maintainers?: { name: string; email?: string }[]
  dist?: RegistryVersionDist
  exports?: Record<string, unknown>
}

export interface RegistryPackageData {
  name: string
  'dist-tags': Record<string, string>
  versions: Record<string, RegistryVersion>
  time?: Record<string, string>
  readme?: string
}

/** Item of a paginated `GET /packages` without `detail=full`. */
export interface PackageListItem {
  name: string
  path: string
  version?: string
  description?: string
  category?: string
  publisher?: { name?: string; url?: string }
}

/** Filter options over the `names`-restricted set, before search and filters. */
export interface PackageFacets {
  categories: string[]
  publishers: string[]
}

export interface PackagePage<T> {
  items: T[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
  facets: PackageFacets
}

/** OR within a dimension, AND across dimensions. */
export interface PackageQuery {
  search?: string | null
  /** Matched against the listing's `name` field, case-insensitively. */
  names?: string[] | null
  categories?: string[] | null
  publishers?: string[] | null
  moduleTypes?: PackageModuleType[] | null
  limit?: number
  offset?: number
}

type ListOptions = { registryUrl?: string; init?: RequestInit }

const CDN_PREFIX = '/-/cdn/'

/** npm name of a listed package; `name` holds the manifest name when it has one. */
export function npmName(pkg: { name: string; path: string }): string {
  return pkg.path.startsWith(CDN_PREFIX) ? pkg.path.slice(CDN_PREFIX.length) : pkg.name
}

export function listPackages(
  query: PackageQuery,
  options: ListOptions & { detail: 'full' },
): Promise<PackagePage<PackageInfo>>
export function listPackages(
  query: PackageQuery,
  options?: ListOptions,
): Promise<PackagePage<PackageListItem>>
export async function listPackages(
  query: PackageQuery,
  { registryUrl = REGISTRY_URL, init, detail }: ListOptions & { detail?: 'full' } = {},
): Promise<PackagePage<PackageInfo | PackageListItem>> {
  const params = new URLSearchParams({ facets: 'true' })
  if (detail) params.set('detail', detail)
  if (query.limit !== undefined) params.set('limit', String(query.limit))
  if (query.offset) params.set('offset', String(query.offset))
  if (query.search) params.set('search', query.search)
  for (const name of query.names ?? []) params.append('name', name)
  for (const category of query.categories ?? []) params.append('category', category)
  for (const publisher of query.publishers ?? []) params.append('publisher', publisher)
  for (const moduleType of query.moduleTypes ?? []) params.append('moduleType', moduleType)

  const body = await getJson(`${registryUrl}/packages?${params}`, init)
  if (isPackagePage(body)) return body

  const all = Array.isArray(body)
    ? (body as PackageInfo[])
    : ((await getJson(`${registryUrl}/packages`, init)) as PackageInfo[])
  const page = legacyQuery(all, query)
  return detail ? page : { ...page, items: page.items.map(toListItem) }
}

/** One package by npm name; undefined when the registry doesn't have it. */
export async function getPackageManifest(name: string): Promise<PackageInfo | undefined> {
  const res = await fetch(`${REGISTRY_URL}/packages/${encodeURIComponent(name)}`, {
    next: { revalidate: 30 },
  })
  if (res.status === 404) return undefined
  if (!res.ok) throw new Error(`registry returned ${res.status}`)
  return (await res.json()) as PackageInfo
}

export async function getPackageRegistryData(name: string): Promise<RegistryPackageData | null> {
  try {
    const res = await fetch(`${REGISTRY_URL}/${name}`, { next: { revalidate: 30 } })
    if (!res.ok) return null
    return (await res.json()) as RegistryPackageData
  } catch {
    return null
  }
}

async function getJson(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, init)
  if (!res.ok) throw new Error(`registry returned ${res.status}`)
  return res.json()
}

function isPackagePage(body: unknown): body is PackagePage<PackageInfo | PackageListItem> {
  return typeof body === 'object' && body !== null && 'items' in body && 'facets' in body
}

function toListItem(pkg: PackageInfo): PackageListItem {
  const publisher = pkg.manifest?.publisher
  return {
    name: pkg.name,
    path: pkg.path,
    version: pkg.version,
    description: pkg.manifest?.description || undefined,
    category: pkg.manifest?.category || undefined,
    publisher: publisher ? { name: publisher.name, url: publisher.url } : undefined,
  }
}

// Legacy fallback for registries whose /packages reply lacks `facets`: query the full list
// in-process with the server's semantics. Delete once every registry serves the paginated API.
export function legacyQuery(all: PackageInfo[], query: PackageQuery): PackagePage<PackageInfo> {
  const names = new Set((query.names ?? []).map((n) => n.toLowerCase()))
  const scoped = all
    .filter((p) => p.manifest && (!names.size || names.has(p.name.toLowerCase())))
    .sort((a, b) => a.name.localeCompare(b.name))
  const facets = {
    categories: uniqueSorted(scoped.map((p) => p.manifest?.category)),
    publishers: uniqueSorted(scoped.map((p) => p.manifest?.publisher?.name)),
  }
  const { categories, publishers, moduleTypes } = query
  const filtered = scoped.filter(({ manifest: m }) => {
    if (categories?.length && !categories.includes(m?.category ?? '')) return false
    if (publishers?.length && !publishers.includes(m?.publisher?.name ?? '')) return false
    return !moduleTypes?.length || moduleTypes.some((t) => m?.[t]?.length)
  })

  const search = query.search?.trim().toLowerCase() ?? ''
  const byName = filtered.filter((p) => p.name.toLowerCase().includes(search))
  const matches = search
    ? [...byName, ...filtered.filter((p) => !byName.includes(p) && searchText(p).includes(search))]
    : filtered

  const limit = Math.min(Math.max(Math.floor(query.limit ?? 30), 1), 50)
  const offset = Math.max(Math.floor(query.offset ?? 0), 0)
  return {
    items: matches.slice(offset, offset + limit),
    total: matches.length,
    limit,
    offset,
    hasMore: offset + limit < matches.length,
    facets,
  }
}

function searchText({ manifest: m }: PackageInfo): string {
  const modules = packageModuleTypes
    .flatMap((t) => m?.[t] ?? [])
    .flatMap((mod: { id?: string; name?: string }) => [mod.id, mod.name])
  return [m?.name, m?.description, m?.publisher?.name, ...modules]
    .filter(Boolean)
    .join('\n')
    .toLowerCase()
}

function uniqueSorted(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b))
}
