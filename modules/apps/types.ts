/**
 * Types for the `vetra-apps` subgraph on the vetra switchboard (contract C3).
 * Field names and nullability mirror the GraphQL schema exactly.
 */

/** DELETED = soft-deleted; only admins can still read such an app via `app(id)`. */
export type AppStatus = 'PENDING_IDENTITY' | 'ACTIVE' | 'DISCONNECTED' | 'DELETED'
export type AppDeploymentKind = 'PRODUCTION' | 'PREVIEW'
export type AppDeploymentStatus = 'PENDING' | 'DEPLOYING' | 'READY' | 'FAILED' | 'SUPERSEDED'

export type AppRepository = {
  installationId: string
  repositoryId: string
  fullName: string
}

export type AppUrls = {
  app: string | null
  connect: string | null
  switchboard: string | null
}

export type AppPreview = {
  environmentId: string
  prNumber: number
  gitRef: string | null
  prUrl: string
  lastDeployedAt: string | null
  status: AppDeploymentStatus | null
  urls: AppUrls
}

export type DeployedPackage = {
  name: string
  version: string
}

export type AppDeployment = {
  id: string
  appId: string
  environmentId: string | null
  kind: AppDeploymentKind
  prNumber: number | null
  gitRef: string
  sha: string
  packages: DeployedPackage[]
  imageTag: string | null
  status: AppDeploymentStatus
  actorDid: string | null
  actorGithub: string | null
  runUrl: string | null
  error: string | null
  createdAt: string
  updatedAt: string
  urls: AppUrls
}

export type AppInstanceStatus = 'pending' | 'updating' | 'ready' | 'degraded' | 'failed' | 'stopped'

/** A running environment of an app (`appInstances`). */
export type AppInstance = {
  id: string
  kind: string
  name: string
  branch: string | null
  pr: number | null
  url: string | null
  status: AppInstanceStatus
  reason: string | null
  targetVersion: string | null
  targetDigest: string | null
  runningVersion: string | null
  runningDigest: string | null
  environmentId: string | null
  updatedAt: string
  /** Health fields: absent on older backends, null until first checked. */
  health?: 'healthy' | 'unhealthy' | 'unknown' | null
  healthCheck?: string | null
  healthReason?: string | null
  healthCheckedAt?: string | null
  observedDigest?: string | null
  observedDigestSource?: string | null
}

/** What vetra-publish recorded: a tagged release, or a build from a release branch or PR. */
export type AppReleaseKind = 'release' | 'build'

export type AppReleasePackage = {
  name: string
  version: string
}

/** One version vetra-publish recorded for an app (`appReleases`). */
export type AppRelease = {
  version: string
  kind: AppReleaseKind
  branch: string | null
  pr: number | null
  commit: string
  notes: string | null
  customerNotes: string | null
  imageRef: string
  imageDigest: string
  host: string
  packages: AppReleasePackage[]
  migrates: boolean
  /** The project's Powerhouse version the image was built with. */
  powerhouseVersion: string
  createdAt: string
}

export type App = {
  id: string
  /** Renown organisation owning the app; absent on older backends, null when personal. */
  ownerOrgId?: string | null
  /** Studio this app was made from; absent on older backends. */
  studioEnvironmentId?: string | null
  slug: string
  name: string
  ownerAddress: string
  status: AppStatus
  repository: AppRepository
  productionBranch: string
  /** Extra branches (exact names or `*` patterns) allowed to publish releases; absent on older backends. */
  releaseBranches?: string[]
  /** Whether Vetra runs an instance per release branch; absent on older backends. */
  instancesEnabled?: boolean
  productionEnvironmentId: string
  previewsEnabled: boolean
  previewLimit: number
  previewTtlDays: number
  harborProject: string
  identityDid: string
  renownAuthorizeUrl: string
  /**
   * When the Renown delegation for the deploy identity expires (ISO date).
   * Optional: older backends don't serve the field.
   */
  identityExpiresAt?: string | null
  productionUrls: AppUrls
  previews: AppPreview[]
  latestDeployment: AppDeployment | null
  createdAt: string
  updatedAt: string
}

export type GithubDeployInstallation = {
  installationId: string
  accountLogin: string
  accountType: string
}

export type GithubRepo = {
  id: string
  fullName: string
  private: boolean
  defaultBranch: string
}

export type GithubDeployAppInfo = {
  slug: string
  installUrl: string
  authorizeUrl: string
}

export type CreateAppInput = {
  name: string
  installationId: string
  repositoryId: string
  productionBranch?: string | null
  productionEnvironmentId?: string | null
  /** Create the app for this organisation. */
  orgId?: string | null
}

export type UpdateAppInput = {
  name?: string | null
  productionBranch?: string | null
  /** Replaces the whole list; `[]` clears it. */
  releaseBranches?: string[]
  instancesEnabled?: boolean
  previewsEnabled?: boolean | null
  previewLimit?: number | null
  previewTtlDays?: number | null
}

/** `extensions.code` values the vetra-apps subgraph emits, plus client-side codes. */
export type AppsErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'BAD_USER_INPUT'
  | 'PREVIEWS_DISABLED'
  | 'APP_NOT_ACTIVE'
  | 'GITHUB_NOT_CONNECTED'
  | 'SERVICE_NOT_CONFIGURED'
  /** The switchboard does not serve the vetra-apps subgraph (yet). */
  | 'APPS_UNAVAILABLE'
  /** Transport failure (network down, 5xx, non-JSON body). */
  | 'NETWORK'
  | 'UNKNOWN'

export type DeployedPackageInput = DeployedPackage

export type DeployAppInput = {
  appId: string
  kind: AppDeploymentKind
  prNumber?: number | null
  gitRef: string
  sha: string
  runUrl?: string | null
  actorGithub?: string | null
  packages: DeployedPackageInput[]
  imageTag?: string | null
}

export type AppRegistryCredentials = {
  registry: string
  project: string
  username: string
  password: string
}

export type CreateStudioAppInput = {
  name: string
  studioEnvironmentId: string
  /** The connected GitHub account or org installation that will own the new repo. */
  installationId: string
  /** Create the app for this organisation. */
  orgId?: string | null
}
