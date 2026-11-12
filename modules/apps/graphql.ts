import { getCloudEndpoint } from '@/modules/cloud/graphql'
import type {
  App,
  AppAccess,
  AppAuditPage,
  AppDeployment,
  AppInstance,
  AppPlan,
  AppRelease,
  AppReleaseKind,
  AppRole,
  AppsErrorCode,
  AppRegistryCredentials,
  AppSetting,
  AppSettingScope,
  AppSettings,
  CreateAppInput,
  CreateAppPlanInput,
  CreateStudioAppInput,
  DeployAppInput,
  GithubDeployAppInfo,
  GithubDeployInstallation,
  GithubRepo,
  HolderInstance,
  SetAppSettingInput,
  UpdateAppInput,
  UpdateAppPlanInput,
} from './types'

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

const KNOWN_CODES = new Set<AppsErrorCode>([
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'BAD_USER_INPUT',
  'PREVIEWS_DISABLED',
  'APP_NOT_ACTIVE',
  'GITHUB_NOT_CONNECTED',
  'SERVICE_NOT_CONFIGURED',
  'SERVICE_UNAVAILABLE',
])

/** Error thrown by every vetra-apps call; `code` drives the UI's reaction. */
export class AppsApiError extends Error {
  readonly code: AppsErrorCode
  readonly status: number | null

  constructor(code: AppsErrorCode, message: string, status: number | null = null) {
    super(message)
    this.name = 'AppsApiError'
    this.code = code
    this.status = status
  }
}

type GqlError = { message?: string; extensions?: { code?: unknown } }
type GqlBody<T> = { data?: T | null; errors?: GqlError[] }

/** A schema that lacks the vetra-apps subgraph rejects our selections at validation time. */
function isSchemaMismatch(message: string): boolean {
  return /Cannot query field|Unknown type|Unknown argument/i.test(message)
}

/**
 * Map a GraphQL error (or a bare HTTP status) onto an `AppsApiError`.
 * Exported for tests — the mapping is what the UI branches on.
 */
export function toAppsError(error: GqlError | null, status: number | null = null): AppsApiError {
  const message =
    error?.message?.trim() || (status ? `Request failed (${status})` : 'Request failed')
  const rawCode = typeof error?.extensions?.code === 'string' ? error.extensions.code : null

  if (rawCode && KNOWN_CODES.has(rawCode as AppsErrorCode)) {
    return new AppsApiError(rawCode as AppsErrorCode, message, status)
  }
  if (error && isSchemaMismatch(message)) {
    return new AppsApiError('APPS_UNAVAILABLE', message, status)
  }
  if (!error || !error.message) {
    if (status === 401) return new AppsApiError('UNAUTHENTICATED', message, status)
    if (status === 403) return new AppsApiError('FORBIDDEN', message, status)
    if (status !== null) return new AppsApiError('NETWORK', message, status)
  }
  return new AppsApiError('UNKNOWN', message, status)
}

/** Human copy for an error, used in toasts and inline alerts. */
export function describeAppsError(err: unknown): string {
  if (!(err instanceof AppsApiError)) {
    return err instanceof Error ? err.message : 'Something went wrong'
  }
  switch (err.code) {
    case 'UNAUTHENTICATED':
      return 'Your session expired. Log in with Renown again.'
    case 'FORBIDDEN':
      return 'You do not have access to this app.'
    case 'NOT_FOUND':
      return 'This app no longer exists.'
    case 'GITHUB_NOT_CONNECTED':
      return 'Your GitHub connection expired or is missing. Reconnect GitHub and try again.'
    case 'APP_NOT_ACTIVE':
      return 'Authorize this app on Renown before deploying.'
    case 'PREVIEWS_DISABLED':
      return 'Preview environments are turned off for this app.'
    case 'SERVICE_NOT_CONFIGURED':
      return 'Vetra Apps is not fully configured on this server yet.'
    case 'SERVICE_UNAVAILABLE':
      return err.message.trim() || 'A Vetra service is unavailable. Try again in a moment.'
    case 'APPS_UNAVAILABLE':
      return 'Vetra Apps is not available on this server yet.'
    case 'NETWORK':
      return 'Could not reach Vetra. Check your connection and try again.'
    default:
      return err.message
  }
}

const ROLE_REFUSAL = /publisher role|all its apps/i

/** createApp-specific copy: FORBIDDEN there means the user can't access the repo on GitHub. */
export function describeCreateAppError(
  err: unknown,
  repoFullName: string,
  orgName?: string | null,
): string {
  // The server words its refusals; tell the role refusal from GitHub repo access by message.
  if (err instanceof AppsApiError && err.code === 'FORBIDDEN' && ROLE_REFUSAL.test(err.message)) {
    return `You need the publisher role with access to all apps of ${orgName ?? 'this organisation'} to create apps there. Ask an owner or admin.`
  }
  if (
    err instanceof AppsApiError &&
    err.code === 'BAD_USER_INPUT' &&
    /Renown identity belongs to another owner/i.test(err.message)
  ) {
    return `This repository's Renown identity already belongs to another owner or organisation. Delete the old app, or ask its creator to, then try again.`
  }
  if (isAppsError(err, 'FORBIDDEN')) {
    return `Your GitHub account doesn't have access to ${repoFullName}. Ask a repository admin for access, or pick another repository.`
  }
  if (isAppsError(err, 'GITHUB_NOT_CONNECTED')) {
    return 'Your GitHub authorization expired. Reconnect GitHub, then create the app again.'
  }
  return describeAppsError(err)
}

/** createStudioApp copy: keep the server's own FORBIDDEN wording ("You do not own this Studio"). */
export function describeCreateStudioAppError(err: unknown, orgName?: string | null): string {
  if (isAppsError(err, 'FORBIDDEN') && err instanceof Error) {
    if (ROLE_REFUSAL.test(err.message)) return describeCreateAppError(err, '', orgName)
    if (err.message.trim()) return err.message
  }
  return describeAppsError(err)
}

export function isAppsError(err: unknown, code: AppsErrorCode): boolean {
  return err instanceof AppsApiError && err.code === code
}

// ---------------------------------------------------------------------------
// Transport — same endpoint + bearer auth as modules/cloud/graphql.ts
// ---------------------------------------------------------------------------

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>

export async function appsGql<T>(
  query: string,
  variables: Record<string, unknown> | undefined,
  token: string | null | undefined,
  fetchImpl: FetchLike = (input, init) => fetch(input, init),
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  let res: Response
  try {
    res = await fetchImpl(getCloudEndpoint(), {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    })
  } catch (err) {
    throw new AppsApiError('NETWORK', err instanceof Error ? err.message : 'Network error')
  }

  const body = (await res.json().catch(() => null)) as GqlBody<T> | null

  if (body?.errors?.length) throw toAppsError(body.errors[0], res.ok ? null : res.status)
  if (!res.ok) throw toAppsError(null, res.status)
  if (!body?.data) throw new AppsApiError('UNKNOWN', 'Empty response from Vetra', res.status)
  return body.data
}

// ---------------------------------------------------------------------------
// Selections
// ---------------------------------------------------------------------------

const URLS = `app connect switchboard`
const DEPLOYMENT_FIELDS = `id appId environmentId kind prNumber gitRef sha
  packages { name version } imageTag status actorDid actorGithub runUrl error
  createdAt updatedAt urls { ${URLS} }`
const RELEASE_FIELDS = `version kind branch pr commit notes customerNotes imageRef imageDigest
  host packages { name version } migrates powerhouseVersion createdAt`
const APP_FIELDS = `id slug name ownerAddress status
  repository { installationId repositoryId fullName }
  productionBranch productionEnvironmentId previewsEnabled previewLimit previewTtlDays
  harborProject identityDid renownAuthorizeUrl
  productionUrls { ${URLS} }
  previews { environmentId prNumber gitRef prUrl lastDeployedAt status urls { ${URLS} } }
  latestDeployment { ${DEPLOYMENT_FIELDS} }
  createdAt updatedAt`

/** App fields newer backends add; each is dropped (once per page load) when the schema rejects it by name. */
const OPTIONAL_APP_FIELDS = [
  'identityExpiresAt',
  'ownerOrgId',
  'studioEnvironmentId',
  'releaseBranches',
  'instancesEnabled',
] as const
const unsupportedAppFields = new Set<string>()

/** Test hook: forget what the backend supports. */
export function resetOptionalAppFields(): void {
  unsupportedAppFields.clear()
}

/**
 * Run an App-returning operation with the optional fields selected, dropping
 * only the optional field(s) the schema rejects by name and keeping the rest.
 * Validation fails before execution, so retrying a mutation is safe.
 */
async function withAppFields<T>(run: (fields: string) => Promise<T>): Promise<T> {
  for (;;) {
    const selected = OPTIONAL_APP_FIELDS.filter((f) => !unsupportedAppFields.has(f))
    try {
      return await run(`${APP_FIELDS} ${selected.join(' ')}`.trimEnd())
    } catch (err) {
      const rejected =
        err instanceof AppsApiError && err.code === 'APPS_UNAVAILABLE'
          ? selected.filter((f) => err.message.includes(`"${f}"`))
          : []
      if (rejected.length === 0) throw err
      for (const f of rejected) unsupportedAppFields.add(f)
    }
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * An apps row with no repository (e.g. a Studio-made app published for licensing only) has
 * nothing to deploy. The deploy UI assumes `repository` is set, so such rows are dropped here
 * and the app is shown through its licensing-only page instead.
 */
function hasRepository(app: App | null | undefined): app is App {
  return !!(app as { repository: App['repository'] | null } | null | undefined)?.repository
}

export async function fetchMyApps(
  token: string | null,
  fetchImpl?: FetchLike,
  orgId?: string | null,
): Promise<App[]> {
  const data = await withAppFields((fields) =>
    orgId
      ? appsGql<{ myApps: App[] }>(
          `query ($orgId: String) { myApps(orgId: $orgId) { ${fields} } }`,
          { orgId },
          token,
          fetchImpl,
        )
      : appsGql<{ myApps: App[] }>(`query { myApps { ${fields} } }`, {}, token, fetchImpl),
  )
  return data.myApps.filter(hasRepository)
}

export async function fetchApp(
  id: string,
  token: string | null,
  fetchImpl?: FetchLike,
): Promise<App | null> {
  const data = await withAppFields((fields) =>
    appsGql<{ app: App | null }>(
      `query ($id: ID!) { app(id: $id) { ${fields} } }`,
      { id },
      token,
      fetchImpl,
    ),
  )
  // The API still returns a deleted app to admins; deleted is gone for everyone here.
  return hasRepository(data.app) && data.app.status !== 'DELETED' ? data.app : null
}

/**
 * The apps record behind an app, with or without a repository (a Studio-made app published for
 * licensing only has one; Vetra Studio itself has none). Null when there is none, or it is
 * deleted. Its existence is what makes the app deletable.
 */
export async function fetchAppRecord(
  id: string,
  token: string | null,
  fetchImpl?: FetchLike,
): Promise<{ id: string; status: string } | null> {
  const data = await appsGql<{ app: { id: string; status: string } | null }>(
    `query ($id: ID!) { app(id: $id) { id status } }`,
    { id },
    token,
    fetchImpl,
  )
  return data.app && data.app.status !== 'DELETED' ? data.app : null
}

export async function fetchAppDeployments(
  appId: string,
  limit: number | null,
  token: string | null,
): Promise<AppDeployment[]> {
  const data = await appsGql<{ appDeployments: AppDeployment[] }>(
    `query ($appId: ID!, $limit: Int) { appDeployments(appId: $appId, limit: $limit) { ${DEPLOYMENT_FIELDS} } }`,
    { appId, limit },
    token,
  )
  return data.appDeployments
}

/** What vetra-publish recorded for the app, newest first; `kind` null for releases and builds. */
export async function fetchAppReleases(
  appId: string,
  kind: AppReleaseKind | null,
  limit: number,
  token: string | null,
  fetchImpl?: FetchLike,
): Promise<AppRelease[]> {
  const data = await appsGql<{ appReleases: AppRelease[] }>(
    `query ($appId: ID!, $kind: String, $limit: Int) { appReleases(appId: $appId, kind: $kind, limit: $limit) { ${RELEASE_FIELDS} } }`,
    { appId, kind, limit },
    token,
    fetchImpl,
  )
  return data.appReleases
}

const INSTANCE_FIELDS =
  'id kind name branch pr url status reason targetVersion targetDigest runningVersion runningDigest environmentId updatedAt'
/** Health fields newer backends add; each is dropped (once per page load) when the schema rejects it by name. */
const OPTIONAL_INSTANCE_FIELDS = [
  'health',
  'healthCheck',
  'healthReason',
  'healthCheckedAt',
  'observedDigest',
  'observedDigestSource',
  'settingsRevision',
  'runningSettingsRevision',
  'planId',
  'holder',
] as const
const unsupportedInstanceFields = new Set<string>()

/** Test hook: forget what the backend supports for instances. */
export function resetOptionalInstanceFields(): void {
  unsupportedInstanceFields.clear()
}

/** The app's running instances (one per release branch); needs a backend with `appInstances`. */
export async function fetchAppInstances(
  appId: string,
  token: string | null,
  fetchImpl?: FetchLike,
): Promise<AppInstance[]> {
  for (;;) {
    const selected = OPTIONAL_INSTANCE_FIELDS.filter((f) => !unsupportedInstanceFields.has(f))
    try {
      const data = await appsGql<{ appInstances: AppInstance[] }>(
        `query ($appId: ID!) { appInstances(appId: $appId) { ${INSTANCE_FIELDS} ${selected.join(' ')} } }`,
        { appId },
        token,
        fetchImpl,
      )
      return data.appInstances
    } catch (err) {
      const rejected =
        err instanceof AppsApiError && err.code === 'APPS_UNAVAILABLE'
          ? selected.filter((f) => err.message.includes(`"${f}"`))
          : []
      if (rejected.length === 0) throw err
      for (const f of rejected) unsupportedInstanceFields.add(f)
    }
  }
}

const PLAN_FIELDS =
  'id appId slug name kind access size targetVersion policy noticeHours status createdAt updatedAt'

/** The App's plans: the licensing terms it runs instances for (owners and viewers). */
export async function fetchAppPlans(
  appId: string,
  token: string | null,
  fetchImpl?: FetchLike,
): Promise<AppPlan[]> {
  const data = await appsGql<{ appPlans: AppPlan[] }>(
    `query ($appId: ID!) { appPlans(appId: $appId) { ${PLAN_FIELDS} } }`,
    { appId },
    token,
    fetchImpl,
  )
  return data.appPlans
}

const HOLDER_INSTANCE_FIELDS =
  'instanceId appId appName planName access url status reason runningVersion'

/** The instances of the plans the caller holds licences of. */
export async function fetchMyInstances(
  token: string | null,
  fetchImpl?: FetchLike,
): Promise<HolderInstance[]> {
  const data = await appsGql<{ myInstances: HolderInstance[] }>(
    `query { myInstances { ${HOLDER_INSTANCE_FIELDS} } }`,
    {},
    token,
    fetchImpl,
  )
  return data.myInstances
}

/**
 * Adopts a licensing term as a plan. Refused (BAD_USER_INPUT, worded by the server) when plans
 * are off, the App has licensed environments, or the term was ever issued.
 */
export async function createAppPlan(
  input: CreateAppPlanInput,
  token: string | null,
  fetchImpl?: FetchLike,
): Promise<AppPlan> {
  const data = await appsGql<{ createPlan: AppPlan }>(
    `mutation ($input: CreatePlanInput!) { createPlan(input: $input) { ${PLAN_FIELDS} } }`,
    { input },
    token,
    fetchImpl,
  )
  return data.createPlan
}

export async function updateAppPlan(
  input: UpdateAppPlanInput,
  token: string | null,
  fetchImpl?: FetchLike,
): Promise<AppPlan> {
  const data = await appsGql<{ updatePlan: AppPlan }>(
    `mutation ($input: UpdatePlanInput!) { updatePlan(input: $input) { ${PLAN_FIELDS} } }`,
    { input },
    token,
    fetchImpl,
  )
  return data.updatePlan
}

/** Moves the plan's instances to a release at once (no notice). */
export async function setAppPlanTarget(
  planId: string,
  version: string,
  token: string | null,
  fetchImpl?: FetchLike,
): Promise<AppPlan> {
  const data = await appsGql<{ setPlanTarget: AppPlan }>(
    `mutation ($planId: ID!, $version: String!) { setPlanTarget(planId: $planId, version: $version) { ${PLAN_FIELDS} } }`,
    { planId, version },
    token,
    fetchImpl,
  )
  return data.setPlanTarget
}

/** No new instances; existing holders keep theirs. */
export async function retireAppPlan(
  planId: string,
  token: string | null,
  fetchImpl?: FetchLike,
): Promise<AppPlan> {
  const data = await appsGql<{ retirePlan: AppPlan }>(
    `mutation ($planId: ID!) { retirePlan(planId: $planId) { ${PLAN_FIELDS} } }`,
    { planId },
    token,
    fetchImpl,
  )
  return data.retirePlan
}

const SETTING_FIELDS = 'name scope secret value updatedAt updatedBy'

/** The App's publisher settings and the ones Vetra sets (owners and operators only). */
export async function fetchAppSettings(
  appId: string,
  token: string | null,
  fetchImpl?: FetchLike,
): Promise<AppSettings> {
  const data = await appsGql<{ appSettings: AppSettings }>(
    `query ($appId: ID!) { appSettings(appId: $appId) { settings { ${SETTING_FIELDS} } vetra { name secret value } reservedNames reservedPrefixes } }`,
    { appId },
    token,
    fetchImpl,
  )
  return data.appSettings
}

/** Sets or replaces one setting; the App's instances roll on the reconciler's next pass. */
export async function setAppSetting(
  input: SetAppSettingInput,
  token: string | null,
  fetchImpl?: FetchLike,
): Promise<AppSetting> {
  const data = await appsGql<{ setAppSetting: AppSetting }>(
    `mutation ($input: SetAppSettingInput!) { setAppSetting(input: $input) { ${SETTING_FIELDS} } }`,
    { input },
    token,
    fetchImpl,
  )
  return data.setAppSetting
}

/** Deletes one setting; resolves false when there was none to delete. */
export async function deleteAppSetting(
  appId: string,
  name: string,
  scope: AppSettingScope,
  token: string | null,
  fetchImpl?: FetchLike,
): Promise<boolean> {
  const data = await appsGql<{ deleteAppSetting: boolean }>(
    `mutation ($appId: ID!, $name: String!, $scope: AppSettingScope) { deleteAppSetting(appId: $appId, name: $name, scope: $scope) }`,
    { appId, name, scope },
    token,
    fetchImpl,
  )
  return data.deleteAppSetting
}

const AUDIT_FIELDS = 'id appId at actor source action subject detail'

/** One page of the App's audit log, newest first; pass `nextBefore` back as `before` for more. */
export async function fetchAppAudit(
  appId: string,
  limit: number,
  before: string | null,
  token: string | null,
  fetchImpl?: FetchLike,
): Promise<AppAuditPage> {
  const data = await appsGql<{ appAudit: AppAuditPage }>(
    `query ($appId: ID!, $limit: Int, $before: String) { appAudit(appId: $appId, limit: $limit, before: $before) { entries { ${AUDIT_FIELDS} } nextBefore } }`,
    { appId, limit, before },
    token,
    fetchImpl,
  )
  return data.appAudit
}

const ROLE_FIELDS = 'appId address role grantedBy grantedAt'

/** The App's release managers (anyone who may view the App). */
export async function fetchAppRoles(
  appId: string,
  token: string | null,
  fetchImpl?: FetchLike,
): Promise<AppRole[]> {
  const data = await appsGql<{ appRoles: AppRole[] }>(
    `query ($appId: ID!) { appRoles(appId: $appId) { ${ROLE_FIELDS} } }`,
    { appId },
    token,
    fetchImpl,
  )
  return data.appRoles
}

/** What the caller may do with the App. */
export async function fetchAppAccess(
  appId: string,
  token: string | null,
  fetchImpl?: FetchLike,
): Promise<AppAccess> {
  const data = await appsGql<{ appAccess: AppAccess }>(
    `query ($appId: ID!) { appAccess(appId: $appId) { operate release administer releaseManager } }`,
    { appId },
    token,
    fetchImpl,
  )
  return data.appAccess
}

/** Names a release manager (owner, org OWNER/ADMIN); idempotent. */
export async function setAppRole(
  appId: string,
  address: string,
  token: string | null,
  fetchImpl?: FetchLike,
): Promise<AppRole> {
  const data = await appsGql<{ setAppRole: AppRole }>(
    `mutation ($appId: ID!, $address: String!) { setAppRole(appId: $appId, address: $address) { ${ROLE_FIELDS} } }`,
    { appId, address },
    token,
    fetchImpl,
  )
  return data.setAppRole
}

/** Takes the release manager role away; resolves false when there was none. */
export async function removeAppRole(
  appId: string,
  address: string,
  token: string | null,
  fetchImpl?: FetchLike,
): Promise<boolean> {
  const data = await appsGql<{ removeAppRole: boolean }>(
    `mutation ($appId: ID!, $address: String!) { removeAppRole(appId: $appId, address: $address) }`,
    { appId, address },
    token,
    fetchImpl,
  )
  return data.removeAppRole
}

export async function fetchAppDeployment(
  id: string,
  token: string | null,
): Promise<AppDeployment | null> {
  const data = await appsGql<{ appDeployment: AppDeployment | null }>(
    `query ($id: ID!) { appDeployment(id: $id) { ${DEPLOYMENT_FIELDS} } }`,
    { id },
    token,
  )
  return data.appDeployment
}

export async function fetchGithubDeployAppInfo(token: string | null): Promise<GithubDeployAppInfo> {
  const data = await appsGql<{ githubDeployAppInfo: GithubDeployAppInfo }>(
    `query { githubDeployAppInfo { slug installUrl authorizeUrl } }`,
    {},
    token,
  )
  return data.githubDeployAppInfo
}

export async function fetchMyGithubDeployInstallations(
  token: string | null,
): Promise<GithubDeployInstallation[]> {
  const data = await appsGql<{ myGithubDeployInstallations: GithubDeployInstallation[] }>(
    `query { myGithubDeployInstallations { installationId accountLogin accountType } }`,
    {},
    token,
  )
  return data.myGithubDeployInstallations
}

export async function fetchGithubDeployRepositories(
  installationId: string,
  token: string | null,
): Promise<GithubRepo[]> {
  const data = await appsGql<{ githubDeployRepositories: GithubRepo[] }>(
    `query ($installationId: String!) { githubDeployRepositories(installationId: $installationId) { id fullName private defaultBranch } }`,
    { installationId },
    token,
  )
  return data.githubDeployRepositories
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function connectGithubDeploy(
  code: string,
  token: string | null,
): Promise<GithubDeployInstallation[]> {
  const data = await appsGql<{ connectGithubDeploy: GithubDeployInstallation[] }>(
    `mutation ($code: String!) { connectGithubDeploy(code: $code) { installationId accountLogin accountType } }`,
    { code },
    token,
  )
  return data.connectGithubDeploy
}

export async function createApp(input: CreateAppInput, token: string | null): Promise<App> {
  const { orgId, ...rest } = input
  const sent = orgId ? { ...rest, orgId } : rest
  const data = await withAppFields((fields) =>
    appsGql<{ createApp: App }>(
      `mutation ($input: CreateAppInput!) { createApp(input: $input) { ${fields} } }`,
      { input: sent },
      token,
    ),
  )
  return data.createApp
}

export async function confirmAppIdentity(appId: string, token: string | null): Promise<App> {
  const data = await withAppFields((fields) =>
    appsGql<{ confirmAppIdentity: App }>(
      `mutation ($appId: ID!) { confirmAppIdentity(appId: $appId) { ${fields} } }`,
      { appId },
      token,
    ),
  )
  return data.confirmAppIdentity
}

export async function updateApp(
  appId: string,
  input: UpdateAppInput,
  token: string | null,
): Promise<App> {
  const data = await withAppFields((fields) =>
    appsGql<{ updateApp: App }>(
      `mutation ($appId: ID!, $input: UpdateAppInput!) { updateApp(appId: $appId, input: $input) { ${fields} } }`,
      { appId, input },
      token,
    ),
  )
  return data.updateApp
}

export async function deleteApp(
  appId: string,
  deleteEnvironments: boolean,
  token: string | null,
): Promise<boolean> {
  const data = await appsGql<{ deleteApp: boolean }>(
    `mutation ($appId: ID!, $deleteEnvironments: Boolean!) { deleteApp(appId: $appId, deleteEnvironments: $deleteEnvironments) }`,
    { appId, deleteEnvironments },
    token,
  )
  return data.deleteApp
}

/** Opens (or reuses) the setup pull request; resolves to the PR URL. */
export async function openAppSetupPullRequest(
  appId: string,
  token: string | null,
): Promise<string> {
  const data = await appsGql<{ openAppSetupPullRequest: string }>(
    `mutation ($appId: ID!) { openAppSetupPullRequest(appId: $appId) }`,
    { appId },
    token,
  )
  return data.openAppSetupPullRequest
}

export async function rollbackApp(
  deploymentId: string,
  token: string | null,
): Promise<AppDeployment> {
  const data = await appsGql<{ rollbackApp: AppDeployment }>(
    `mutation ($deploymentId: ID!) { rollbackApp(deploymentId: $deploymentId) { ${DEPLOYMENT_FIELDS} } }`,
    { deploymentId },
    token,
  )
  return data.rollbackApp
}

/**
 * Manual deploy (owner/admin). CI (vetra-deploy-action) does not use GraphQL:
 * it calls the HTTP routes `apps/ci/*` on the vetra switchboard.
 */
export async function deployApp(
  input: DeployAppInput,
  token: string | null,
): Promise<AppDeployment> {
  const data = await appsGql<{ deployApp: AppDeployment }>(
    `mutation ($input: DeployAppInput!) { deployApp(input: $input) { ${DEPLOYMENT_FIELDS} } }`,
    { input },
    token,
  )
  return data.deployApp
}

/**
 * Push-only Harbor robot for the App's project. The UI never calls it, and CI
 * uses the HTTP route `apps/ci/registry-credentials` instead. The result
 * carries a secret: never cache or log it.
 */
export async function fetchAppRegistryCredentials(
  appId: string,
  token: string | null,
): Promise<AppRegistryCredentials> {
  const data = await appsGql<{ appRegistryCredentials: AppRegistryCredentials }>(
    `mutation ($appId: ID!) { appRegistryCredentials(appId: $appId) { registry project username password } }`,
    { appId },
    token,
  )
  return data.appRegistryCredentials
}

/** Turn a Studio into an App: the backend creates the managed repo and wires deploys. */
export async function createStudioApp(
  input: CreateStudioAppInput,
  token: string | null,
): Promise<App> {
  const { orgId, ...rest } = input
  const sent = orgId ? { ...rest, orgId } : rest
  const data = await withAppFields((fields) =>
    appsGql<{ createStudioApp: App }>(
      `mutation ($input: CreateStudioAppInput!) { createStudioApp(input: $input) { ${fields} } }`,
      { input: sent },
      token,
    ),
  )
  return data.createStudioApp
}
