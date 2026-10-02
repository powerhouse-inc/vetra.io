import { getCloudEndpoint } from '@/modules/cloud/graphql'
import type {
  App,
  AppDeployment,
  AppsErrorCode,
  AppRegistryCredentials,
  CreateAppInput,
  DeployAppInput,
  GithubDeployAppInfo,
  GithubDeployInstallation,
  GithubRepo,
  UpdateAppInput,
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
      return 'Authorize the app identity on Renown before deploying.'
    case 'PREVIEWS_DISABLED':
      return 'Preview environments are turned off for this app.'
    case 'SERVICE_NOT_CONFIGURED':
      return 'Vetra Apps is not fully configured on this server yet.'
    case 'APPS_UNAVAILABLE':
      return 'Vetra Apps is not available on this server yet.'
    case 'NETWORK':
      return 'Could not reach Vetra. Check your connection and try again.'
    default:
      return err.message
  }
}

/** createApp-specific copy: FORBIDDEN there means the user can't access the repo on GitHub. */
export function describeCreateAppError(err: unknown, repoFullName: string): string {
  if (isAppsError(err, 'FORBIDDEN')) {
    return `Your GitHub account doesn't have access to ${repoFullName}. Ask a repository admin for access, or pick another repository.`
  }
  if (isAppsError(err, 'GITHUB_NOT_CONNECTED')) {
    return 'Your GitHub authorization expired. Reconnect GitHub, then create the app again.'
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
const APP_FIELDS = `id slug name ownerAddress status
  repository { installationId repositoryId fullName }
  productionBranch productionEnvironmentId previewsEnabled previewLimit previewTtlDays
  harborProject identityDid renownAuthorizeUrl
  productionUrls { ${URLS} }
  previews { environmentId prNumber gitRef prUrl lastDeployedAt status urls { ${URLS} } }
  latestDeployment { ${DEPLOYMENT_FIELDS} }
  createdAt updatedAt`

/** App fields newer backends add; dropped (once per page load) when the schema rejects them. */
const OPTIONAL_APP_FIELDS = ['identityExpiresAt'] as const
let optionalAppFieldsSupported: boolean | null = null

/** Test hook: forget what the backend supports. */
export function resetOptionalAppFields(): void {
  optionalAppFieldsSupported = null
}

/**
 * Run an App-returning operation with the optional fields selected, falling
 * back to the base selection when the schema rejects exactly those fields.
 * Validation fails before execution, so retrying a mutation is safe.
 */
async function withAppFields<T>(run: (fields: string) => Promise<T>): Promise<T> {
  if (optionalAppFieldsSupported === false) return run(APP_FIELDS)
  try {
    const result = await run(`${APP_FIELDS} ${OPTIONAL_APP_FIELDS.join(' ')}`)
    optionalAppFieldsSupported = true
    return result
  } catch (err) {
    const rejectsOptional =
      err instanceof AppsApiError &&
      err.code === 'APPS_UNAVAILABLE' &&
      OPTIONAL_APP_FIELDS.some((f) => err.message.includes(`"${f}"`))
    if (!rejectsOptional) throw err
    optionalAppFieldsSupported = false
    return run(APP_FIELDS)
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function fetchMyApps(token: string | null, fetchImpl?: FetchLike): Promise<App[]> {
  const data = await withAppFields((fields) =>
    appsGql<{ myApps: App[] }>(`query { myApps { ${fields} } }`, {}, token, fetchImpl),
  )
  return data.myApps
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
  return data.app
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
  const data = await withAppFields((fields) =>
    appsGql<{ createApp: App }>(
      `mutation ($input: CreateAppInput!) { createApp(input: $input) { ${fields} } }`,
      { input },
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
