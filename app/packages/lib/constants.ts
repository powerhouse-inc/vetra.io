import Fuse from 'fuse.js'
import { type PackageEntry, type PackageModuleType } from './types'

export const packageModuleTypes: PackageModuleType[] = [
  'documentModels',
  'editors',
  'apps',
  'subgraphs',
  'processors',
]

export const REGISTRY_URL = process.env.NEXT_PUBLIC_REGISTRY_URL || 'https://registry.dev.vetra.io'

const searchKeys = [
  'registryName',
  'manifest.name',
  'manifest.description',
  'manifest.category',
  'manifest.publisher.name',
  'manifest.publisher.url',
  ...packageModuleTypes.map((pmt) => `manifest.${pmt}.name`),
  ...packageModuleTypes.map((pmt) => `manifest.${pmt}.id`),
]
export const fuse = new Fuse<PackageEntry>([], {
  keys: searchKeys,
  includeMatches: true,
})
