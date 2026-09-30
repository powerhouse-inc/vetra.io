import { defaultPackageRegistry } from '@/modules/cloud/switchboard-url'
import { type PackageModuleType } from './types'

export const packageModuleTypes: PackageModuleType[] = [
  'documentModels',
  'editors',
  'apps',
  'subgraphs',
  'processors',
]

// The package browser lists this deployment's registry (prod → registry.vetra.io).
export const REGISTRY_URL = process.env.NEXT_PUBLIC_REGISTRY_URL || defaultPackageRegistry()
