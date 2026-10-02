/**
 * Types for the `vetra-apps` subgraph on the vetra switchboard (contract C3).
 * Field names and nullability mirror the GraphQL schema exactly.
 */

export type AppStatus = 'PENDING_IDENTITY' | 'ACTIVE' | 'DISCONNECTED'
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

export type App = {
  id: string
  slug: string
  name: string
  ownerAddress: string
  status: AppStatus
  repository: AppRepository
  productionBranch: string
  productionEnvironmentId: string
  previewsEnabled: boolean
  previewLimit: number
  previewTtlDays: number
  harborProject: string
  identityDid: string
  renownAuthorizeUrl: string
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
}

export type UpdateAppInput = {
  name?: string | null
  productionBranch?: string | null
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
