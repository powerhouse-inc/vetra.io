import { type Manifest, type PowerhouseModule } from '@powerhousedao/shared'

export type PackageModuleType = 'documentModels' | 'editors' | 'apps' | 'subgraphs' | 'processors'

export type PackageModulesRecord = Partial<Record<PackageModuleType, PowerhouseModule[]>>

/**
 * A registry package as consumed by the packages page: the registered npm
 * name (always present; the allowlist keys on it) plus its manifest
 * (nullable in the registry payload; filtered out before use).
 */
export type PackageEntry = {
  registryName: string
  manifest: Manifest
}

export type PackageFilters = {
  moduleTypes: PackageModuleType[] | null
  categories: string[] | null
  publisherNames: string[] | null
}
