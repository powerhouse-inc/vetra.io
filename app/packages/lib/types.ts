import { type PowerhouseModule } from '@powerhousedao/shared'

export type PackageModuleType = 'documentModels' | 'editors' | 'apps' | 'subgraphs' | 'processors'

export type PackageModulesRecord = Partial<Record<PackageModuleType, PowerhouseModule[]>>

export type PackageFilters = {
  moduleTypes: PackageModuleType[] | null
  categories: string[] | null
  publisherNames: string[] | null
}
