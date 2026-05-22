export type CloudEnvironmentServiceType = 'CONNECT' | 'SWITCHBOARD' | 'FUSION' | 'CLINT'

export type ServiceStatus = 'ACTIVE' | 'SUSPENDED' | 'PROVISIONING' | 'BILLING_ISSUE'

export type CloudResourceSize =
  | 'VETRA_AGENT_S'
  | 'VETRA_AGENT_M'
  | 'VETRA_AGENT_L'
  | 'VETRA_AGENT_XL'
  | 'VETRA_AGENT_XXL'

export type CloudServiceEnv = { name: string; value: string }

export type ClintEndpointType = 'api-graphql' | 'api-mcp' | 'website'

export type ClintEndpoint = {
  id: string
  type: ClintEndpointType
  port: string
  status?: 'enabled' | 'disabled'
}

export type CloudServiceClintConfig = {
  package: CloudPackage
  env: CloudServiceEnv[]
  serviceCommand: string | null
  selectedRessource: CloudResourceSize | null
}

export type CloudEnvironmentService = {
  type: CloudEnvironmentServiceType
  prefix: string
  enabled: boolean
  url: string | null
  status: ServiceStatus
  version: string | null
  config?: CloudServiceClintConfig | null
  selectedRessource: CloudResourceSize | null
}

export type CloudEnvironmentStatus =
  | 'DRAFT'
  | 'CHANGES_PENDING'
  | 'CHANGES_APPROVED'
  | 'CHANGES_PUSHED'
  | 'DEPLOYING'
  | 'DEPLOYMENt_FAILED'
  | 'READY'
  | 'TERMINATING'
  | 'DESTROYED'
  | 'ARCHIVED'
  | 'STOPPED'

export type DnsRecord = {
  type: string
  host: string
  value: string
}

export type CloudCustomDomain = {
  enabled: boolean
  domain: string | null
  dnsRecords: DnsRecord[]
}

export type CloudPackage = {
  registry: string
  name: string
  version: string | null
}

export type CloudEnvironmentState = {
  /** Lowercased EthereumAddress of the owner; null until claimed via SET_OWNER. */
  owner: string | null
  label: string | null
  genericSubdomain: string | null
  genericBaseDomain: string | null
  customDomain: CloudCustomDomain | null
  defaultPackageRegistry: string | null
  services: CloudEnvironmentService[]
  packages: CloudPackage[]
  status: CloudEnvironmentStatus
  /**
   * Service pinned to the apex of the custom domain — that service's ingress
   * serves `customDomain.domain` directly instead of `<prefix>.<customDomain>`.
   * Populated by the doc model once the `apexService` field is added (rolling
   * update, read-tolerant for now).
   */
  apexService?: CloudEnvironmentServiceType | null
  /**
   * Release channel the environment is subscribed to for auto-updates.
   * When the monorepo publishes a new image on this channel, the observability
   * subgraph dispatches SET_SERVICE_VERSION + APPROVE_CHANGES on this env.
   * null (or undefined on envs created before the field existed) = off.
   */
  autoUpdateChannel?: AutoUpdateChannel | null
  /**
   * Recurring database backup intent. The frontend writes this via
   * SET_BACKUP_SCHEDULE; a backend job runner reads it and fires
   * `requestEnvironmentDump` on the configured cadence. `null` / `undefined`
   * = scheduled backups disabled (or feature not yet rolled out on this env).
   */
  backupSchedule?: BackupSchedule | null
}

export type AutoUpdateChannel = 'DEV' | 'STAGING' | 'LATEST'

export type BackupCadence = 'HOURLY' | 'DAILY' | 'WEEKLY'

/**
 * Discriminator for how a dump was triggered. Manual dumps come from a user
 * clicking "Create dump"; scheduled dumps come from the backend job runner
 * acting on the env's `backupSchedule`. Optional on the type for tolerance
 * with backends that haven't rolled out the column yet — `undefined`/`null`
 * is treated as MANUAL by the UI.
 */
export type DumpSource = 'MANUAL' | 'SCHEDULED'

/**
 * Frontend representation of the recurring-backup intent stored on
 * `CloudEnvironmentState.backupSchedule`.
 */
export type BackupSchedule = {
  enabled: boolean
  cadence: BackupCadence
  /** Number of completed scheduled dumps to retain. Default 7; 1–30. */
  retention: number
}
export type ReleaseTrigger = 'AUTO' | 'MANUAL' | 'ROLLBACK'

export type ReleaseIndexEntry = {
  channel: AutoUpdateChannel
  image: TenantService
  tag: string
  publishedAt: string
  releaseUrl: string | null
}

export type ReleaseHistoryEntry = {
  documentId: string
  tenantId: string | null
  service: TenantService
  fromTag: string | null
  toTag: string
  trigger: ReleaseTrigger
  channel: AutoUpdateChannel | null
  at: string
  releaseUrl: string | null
}

export type CloudEnvironment = {
  id: string
  name: string
  documentType: string
  createdAtUtcIso: string
  lastModifiedAtUtcIso: string
  revision: number
  state: CloudEnvironmentState
}

// Observability types (from vetra-cloud-observability subgraph)

export type ArgoSyncStatus = 'SYNCED' | 'OUT_OF_SYNC' | 'UNKNOWN'
export type ArgoHealthStatus = 'HEALTHY' | 'DEGRADED' | 'PROGRESSING' | 'MISSING' | 'UNKNOWN'
export type PodPhase = 'RUNNING' | 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'UNKNOWN'
export type EventType = 'NORMAL' | 'WARNING'
export type TenantService = 'CONNECT' | 'SWITCHBOARD' | 'CLINT' | 'FUSION'
export type MetricRange =
  | 'ONE_MIN'
  | 'FIVE_MIN'
  | 'FIFTEEN_MIN'
  | 'ONE_HOUR'
  | 'SIX_HOURS'
  | 'TWENTY_FOUR_HOURS'

export type EnvironmentStatus = {
  tenantId: string
  argoSyncStatus: ArgoSyncStatus
  argoHealthStatus: ArgoHealthStatus
  argoLastSyncedAt: string | null
  argoMessage: string | null
  configDriftDetected: boolean
  tlsCertValid: boolean | null
  tlsCertExpiresAt: string | null
  domainResolves: boolean | null
  updatedAt: string
}

export type Pod = {
  name: string
  service: TenantService | null
  /**
   * Value of the `app.kubernetes.io/component` label set by the chart on every
   * pod it deploys (connect, switchboard, clint, fusion, registry, …). Null
   * for pods that don't carry the label.
   */
  component: string | null
  /**
   * Value of the `clint.vetra.io/agent` label set by the chart on every clint
   * pod. Equals the agent's `prefix`. Non-null only for clint pods.
   */
  agent: string | null
  phase: PodPhase
  ready: boolean
  restartCount: number
  updatedAt: string
}

export type KubeEvent = {
  type: EventType
  reason: string
  message: string
  involvedObject: string
  timestamp: string
}

export type MetricSeries = {
  label: string
  datapoints: Datapoint[]
}

export type Datapoint = {
  timestamp: number
  value: number
}

export type LogEntry = {
  timestamp: number
  line: string
}

/**
 * Endpoints announced by a clint agent at runtime, sourced from the
 * vetra-cloud-observability subgraph's `clintRuntimeEndpointsByEnv`
 * query. The doc model intentionally does not mirror this state.
 */
export type ClintRuntimeEndpointReport = {
  id: string
  type: ClintEndpointType
  port: string
  status: 'enabled' | 'disabled'
  /** ISO timestamp of the most recent announcement. */
  lastSeen: string
}

export type ClintRuntimeEndpointsForPrefix = {
  prefix: string
  endpoints: ClintRuntimeEndpointReport[]
}

// ---------------------------------------------------------------------------
// Database Explorer (vetra-cloud-observability subgraph)
// ---------------------------------------------------------------------------

/**
 * Result of a read-only SQL execution. Cells are serialized to strings for
 * JSON transport; `null` represents a SQL NULL value. `truncatedAt` is set
 * when the server capped the row count (either by the user-supplied limit
 * or the 4 MB payload cap).
 */
export type DatabaseQueryResult = {
  columns: string[]
  rows: (string | null)[][]
  rowCount: number
  truncatedAt: number | null
  executionMs: number
}

export type DatabaseColumnInfo = {
  name: string
  type: string
  nullable: boolean
  default: string | null
  isPrimaryKey: boolean
}

export type DatabaseIndexInfo = {
  name: string
  columns: string[]
  unique: boolean
}

export type DatabaseTableInfo = {
  name: string
  columns: DatabaseColumnInfo[]
  indexes: DatabaseIndexInfo[]
}

export type DatabaseSchemaInfo = {
  name: string
  tables: DatabaseTableInfo[]
  /** true when the table count exceeded the server cap (500). */
  truncated?: boolean
}

export type DatabaseSchema = {
  schemas: DatabaseSchemaInfo[]
}

export type DatabaseDumpStatus = 'PENDING' | 'RUNNING' | 'READY' | 'FAILED'

/**
 * On-demand pg_dump export of the env's Postgres. File has a 24h TTL on
 * S3; rows are pruned after 7d. `downloadUrl` is a 15-min presigned URL
 * minted on every read, only present when status=READY and the file
 * hasn't expired.
 */
export type DatabaseDump = {
  id: string
  status: DatabaseDumpStatus
  requestedAt: string
  startedAt: string | null
  completedAt: string | null
  expiresAt: string
  sizeBytes: number | null
  errorMessage: string | null
  downloadUrl: string | null
  /**
   * Whether the dump was manually requested or fired by the scheduled-backup
   * runner. Optional for tolerance with backends that haven't rolled out the
   * column yet — `undefined`/`null` is treated as MANUAL by the UI.
   */
  source?: DumpSource | null
}
