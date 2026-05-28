/**
 * Runtime config types — mirror the powerhouse.config.json schema's `connect.*`
 * subtree. Source of truth: ph-monorepo
 *   packages/builder-tools/connect-utils/runtime-config.schema.json
 *   packages/shared/connect/runtime-config.ts
 *
 * Only the `connect.*` block is user-editable from this UI; the surrounding
 * top-level fields (schemaVersion, packages, packageRegistryUrl, localPackage)
 * are managed elsewhere (package manager, env creation flow, build pipeline).
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export type PreserveStrategy = 'preserve-all' | 'preserve-by-url-and-detach'

export type DriveSection = {
  enabled: boolean
  allowAdd: boolean
  allowDelete: boolean
}

export type DefaultDrive = {
  url: string
  name?: string | null
  icon?: string | null
}

export type HomeBackground = {
  avif?: string
  png?: string
} | null

export type ConnectBranding = {
  appName?: string
  homeBackground?: HomeBackground
}

export type ConnectApp = {
  logLevel?: LogLevel
  basePath?: string
}

export type ConnectPackages = {
  externalEnabled?: boolean
}

export type ConnectDrives = {
  allowAddDrive?: boolean
  defaultDrives?: DefaultDrive[]
  preserveStrategy?: PreserveStrategy
  sections?: {
    remote?: Partial<DriveSection>
    local?: Partial<DriveSection>
  }
}

export type ConnectRenown = {
  url?: string
  networkId?: string
  chainId?: number
}

export type PHConnectRuntimeConfig = {
  branding?: ConnectBranding
  app?: ConnectApp
  packages?: ConnectPackages
  drives?: ConnectDrives
  renown?: ConnectRenown
}

/**
 * Payload returned by the future `runtimeConfig` query and `setRuntimeConfig`
 * mutation. See RUNTIME-CONFIG-SUBGRAPH-PLAN.md.
 */
export type RuntimeConfigPayload = {
  /** DEFAULT_CONNECT_CONFIG + overrides, fully merged. Always populated. */
  effective: PHConnectRuntimeConfig
  /** Only the keys the user has explicitly set. */
  overrides: PHConnectRuntimeConfig
  schemaVersion: string
  updatedAt: string | null
}
