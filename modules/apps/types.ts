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
  /** branch | preview | shared | own */
  kind: string
  /** shared/own: the plan it serves; absent on older backends. */
  planId?: string | null
  /** own: the holder's address; absent on older backends. */
  holder?: string | null
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
  /** The App settings revision the instance should run; absent on older backends. */
  settingsRevision?: string | null
  /** The settings revision it last ran healthy. */
  runningSettingsRevision?: string | null
  /** own: the release the publisher pinned it to; rollouts skip it. */
  pinnedVersion?: string | null
  /** `restore:<id>` while a backup is restored into it; `held:<id>` after a failed restore. */
  maintenance?: string | null
  /** A warm-pool instance: no holder yet, closed to everyone. */
  warm?: boolean
  claimedAt?: string | null
  /** own: how many settings its holder set (names stay the holder's). */
  holderSettingsCount?: number
  customDomain?: InstanceCustomDomain | null
}

export type CustomDomainStatus = 'DNS' | 'ISSUING' | 'ACTIVE' | 'FAILED'

/** A DNS record the holder sets. */
export type DnsRecordHint = { type: string; host: string; value: string }

export type InstanceCustomDomain = {
  domain: string
  status: CustomDomainStatus
  reason: string | null
  since: string | null
  records: DnsRecordHint[]
  /** A CNAME instead of the A record (not at an apex domain). */
  alternative: DnsRecordHint | null
}

/** Who a plan's instances serve: one shared by every holder, or one per holder. */
export type AppPlanAccess = 'shared' | 'own'

/** Instance sizes a plan can run at, smallest first. */
export const APP_PLAN_SIZES = [
  'VETRA_AGENT_S',
  'VETRA_AGENT_M',
  'VETRA_AGENT_L',
  'VETRA_AGENT_XL',
  'VETRA_AGENT_XXL',
] as const
export type AppPlanSize = (typeof APP_PLAN_SIZES)[number]

/** What holders of one licensing term get (`appPlans`); the plan adopted the term by its kind. */
export type AppPlan = {
  id: string
  appId: string
  slug: string
  name: string
  /** The licensing term's kind (its plan ID); null for the Team plan. */
  kind: string | null
  /** The App's Team plan (organisation members; follows a branch). */
  team?: boolean
  access: AppPlanAccess
  size: AppPlanSize
  /** A release (never a build) of the App; null until one is picked. */
  targetVersion: string | null
  /** manual | patches | minor | follow:<branch> */
  policy: string
  noticeHours: number
  /** When the plan's instances may be updated; null: any time after the notice. */
  updateWindow?: PlanUpdateWindow | null
  /** The last release the policy could not roll out, and why. */
  policyNote?: string | null
  /** Monthly AI budget in USD of every instance's own key; null: no AI key. */
  aiBudgetUsd?: number | null
  warmPoolSize?: number
  warmPoolEffective?: number
  /** Monthly cost of the warm instances, in euros (estimate). */
  warmPoolEurPerMonth?: number
  warmReady?: number
  status: 'active' | 'retired'
  createdAt: string
  updatedAt: string
}

/** Weekdays 1 (Monday) to 7 (Sunday) the window starts on; local HH:MM; end <= start runs past midnight. */
export type PlanUpdateWindow = {
  days: number[]
  start: string
  end: string
  timeZone: string
}

export type CreateAppPlanInput = {
  appId: string
  /** The licensing term's kind; it must have no holders yet. */
  kind: string
  access: AppPlanAccess
  size?: AppPlanSize | null
  targetVersion?: string | null
  slug?: string | null
  name?: string | null
}

export type UpdateAppPlanInput = {
  planId: string
  name?: string | null
  size?: AppPlanSize | null
  policy?: string | null
  noticeHours?: number | null
  updateWindow?: PlanUpdateWindow | null
  clearUpdateWindow?: boolean
  /** Null removes the budget. */
  aiBudgetUsd?: number | null
  /** Own plans only, 0 to 10; capped by Vetra. */
  warmPoolSize?: number | null
}

/** An instance the caller holds a licence for (`myInstances`). */
export type HolderInstance = {
  instanceId: string
  appId: string
  appName: string
  planName: string
  access: AppPlanAccess
  url: string | null
  status: AppInstanceStatus
  reason: string | null
  runningVersion: string | null
  /** Fields newer backends add. */
  customDomain?: InstanceCustomDomain | null
  licenceEndsAt?: string | null
  stopsAt?: string | null
  deletesAt?: string | null
  notices?: HolderNotice[]
  /** A coming update of this instance; null when none. */
  update?: HolderUpdate | null
}

export type HolderNoticeKind =
  | 'EXPIRING'
  | 'ENDED_STOP_PENDING'
  | 'STOPPED'
  | 'STOPPED_DELETE_PENDING'
  | 'DELETE_IMMINENT'
  | 'APP_DISCONTINUED'

export type HolderNotice = { kind: HolderNoticeKind; at: string | null; message: string }

/** A coming update a holder is told about. */
export type HolderUpdate = {
  rolloutId: string
  version: string
  /** Null: never as things stand (the plan's update window never opens). */
  dueAt: string | null
  notes: string | null
  paused: boolean
  canUpdateNow: boolean
}

export type HolderSettingKind = 'PLAIN' | 'SECRET' | 'FILE'

export type HolderSetting = {
  name: string
  kind: HolderSettingKind
  value: string | null
  mountPath: string | null
  updatedAt: string
}

export type HolderSettings = {
  settings: HolderSetting[]
  vetra: VetraInstanceSetting[]
  /** Names the App's publisher sets on this instance; a holder setting of the same name replaces it. */
  publisherNames: string[]
  reservedNames: string[]
  reservedPrefixes: string[]
}

export type SetHolderSettingInput = {
  instanceId: string
  name?: string | null
  kind: HolderSettingKind
  value: string
  mountPath?: string | null
}

/** Where a publisher setting applies: every instance, or only branch or preview instances. */
export type AppSettingScope = 'ALL' | 'BRANCH' | 'PREVIEW'

/** A publisher setting. Secrets are write-only: `value` is always null for them. */
export type AppSetting = {
  name: string
  scope: AppSettingScope
  secret: boolean
  value: string | null
  updatedAt: string
  /** Address of whoever set it last. */
  updatedBy: string
}

/** A setting Vetra sets on every instance; read-only. `value` describes per-instance values. */
export type VetraInstanceSetting = {
  name: string
  secret: boolean
  value: string
}

export type AppSettings = {
  settings: AppSetting[]
  vetra: VetraInstanceSetting[]
  reservedNames: string[]
  reservedPrefixes: string[]
}

export type SetAppSettingInput = {
  appId: string
  name: string
  value: string
  secret: boolean
  scope: AppSettingScope
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
  /** Withdrawn by the publisher: no plan may target it. Absent on older backends. */
  withdrawnAt?: string | null
  withdrawnBy?: string | null
  withdrawnReason?: string | null
  /** When this release ran healthy on the App's Team instance. */
  teamHealthyAt?: string | null
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
  /** A dependency is down, e.g. "Secret storage unavailable". */
  | 'SERVICE_UNAVAILABLE'
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

/** Where an audit row came from (`AppAuditEntry.source`). */
export type AppAuditSource = 'console' | 'api' | 'ci' | 'system' | 'policy'

/**
 * Who did what to an App, when and from where (`appAudit`). `actor` is a lowercased address, or
 * `vetra` for Vetra itself; `detail` is a JSON object (never a setting value or secret).
 */
export type AppAuditEntry = {
  id: string
  appId: string
  at: string
  actor: string
  /** console | api | ci | system | policy; kept a string so a new source still renders. */
  source: string
  /** plan.created | plan.updated | plan.target_set | plan.retired | setting.set | … */
  action: string
  /** plan:<id> | setting:<SCOPE>/<NAME> | role:<address> | instance:<id> | release:<version> */
  subject: string
  detail: string
}

export type AppAuditPage = {
  /** Newest first. */
  entries: AppAuditEntry[]
  /** Pass as `before` for the next (older) page; null on the last page. */
  nextBefore: string | null
}

/** A per-App role Vetra keeps (`appRoles`): release managers. */
export type AppRole = {
  appId: string
  address: string
  /** release_manager */
  role: string
  grantedBy: string
  grantedAt: string
}

/** What the signed-in caller may do with an App (`appAccess`). */
export type AppAccess = {
  /** Edit, deploy, roll back, delete (owner, org OWNER/ADMIN, publishers in scope). */
  operate: boolean
  /** Plans, environment settings, rollouts (operators and release managers). */
  release: boolean
  /** Name release managers (owner, org OWNER/ADMIN). */
  administer: boolean
  releaseManager: boolean
}

export type RolloutStatus = 'active' | 'paused' | 'complete' | 'cancelled' | 'rolled_back'

export type AppRolloutPlan = { planId: string; fromVersion: string | null; noticeHours: number }

export type RolloutStepStatus =
  | 'pending'
  | 'backing_up'
  | 'applying'
  | 'restoring'
  | 'succeeded'
  | 'failed'
  | 'skipped'
  | 'revert_pending'
  | 'reverting'
  | 'revert_failed'
  | 'rolled_back'

export type AppRolloutStep = {
  id: string
  instanceId: string
  instanceName: string
  /** shared | own */
  instanceKind: string
  planId: string
  position: number
  fromVersion: string | null
  toVersion: string
  status: RolloutStepStatus
  dueAt: string
  requestedAt: string | null
  startedAt: string | null
  finishedAt: string | null
  attempts: number
  error: string | null
  note: string | null
  backupId?: string | null
  restoreId?: string | null
}

/** A move of one or more plans to a release, one instance at a time. */
export type AppRollout = {
  id: string
  appId: string
  version: string
  status: RolloutStatus
  /** forward | back */
  direction: string
  /** console | api | policy */
  source: string
  /** An address, or `vetra` (a policy). */
  startedBy: string
  startedAt: string
  notes: string | null
  pausedAt: string | null
  pausedReason: string | null
  finishedAt: string | null
  rolledBackBy: string | null
  rolledBackAt: string | null
  plans: AppRolloutPlan[]
  steps: AppRolloutStep[]
}

export type AppRolloutStepPreview = {
  instanceId: string
  instanceName: string
  instanceKind: string
  planId: string
  fromVersion: string | null
  /** pending | skipped */
  status: string
  note: string | null
  dueAt: string
}

/** What `startRollout` would do. */
export type AppRolloutCheck = {
  version: string
  ok: boolean
  problems: string[]
  steps: AppRolloutStepPreview[]
}

export type StartRolloutInput = {
  appId: string
  version: string
  planIds: string[]
  noticeHours?: number | null
}

export type InstanceBackup = {
  id: string
  instanceId: string
  /** pre_update | daily | manual | pre_restore | pre_stop */
  reason: string
  /** pending | ready | failed */
  status: string
  version: string | null
  sizeBytes: number | null
  error: string | null
  requestedBy: string
  createdAt: string
  finishedAt: string | null
  expiresAt: string
  rolloutStepId: string | null
}

export type InstanceRestoreStatus =
  | 'safety_backup'
  | 'stopping'
  | 'restoring_db'
  | 'restoring_data'
  | 'starting'
  | 'succeeded'
  | 'failed'

export type InstanceRestore = {
  id: string
  instanceId: string
  backupId: string
  /** rollback | failed_update | manual */
  purpose: string
  status: InstanceRestoreStatus
  thenVersion: string | null
  error: string | null
  /** Failed with /data possibly half restored: the instance stays stopped. */
  held: boolean
  requestedBy: string
  createdAt: string
  finishedAt: string | null
}
