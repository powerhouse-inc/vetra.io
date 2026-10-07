import { getCloudEndpoint } from '@/modules/cloud/graphql'
import type {
  PublisherApp,
  PublisherLicense,
  PublisherLicenseType,
  AppUserEnvironment,
  CreateLicenseTypeInput,
  SetLicenseTypeDetailsInput,
  SetLicenseTypeTemplateInput,
  AddLicenseTypeServiceInput,
  AddLicenseTypePackageInput,
  IssueGrantInput,
  RevokeLicenseInput,
} from './types'

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>

export type PublisherErrorCode =
  | 'UNAUTHENTICATED'
  | 'UNKNOWN_APP'
  | 'APP_IDENTITY_INACTIVE'
  | 'LICENSING_DISABLED'
  | 'UNKNOWN_LICENSE_TYPE'
  | 'UNKNOWN_LICENSE'
  | 'INVALID_INPUT'
  | 'NOT_ON_ALLOW_LIST'
  | 'PUBLISHER_UNAVAILABLE'
  | 'NETWORK'
  | 'UNKNOWN'

// Codes the server sends in extensions.code. PUBLISHER_UNAVAILABLE, NETWORK and
// UNKNOWN are produced locally and are deliberately not in this set.
const KNOWN_CODES = new Set<string>([
  'UNAUTHENTICATED',
  'UNKNOWN_APP',
  'APP_IDENTITY_INACTIVE',
  'LICENSING_DISABLED',
  'UNKNOWN_LICENSE_TYPE',
  'UNKNOWN_LICENSE',
  'INVALID_INPUT',
  'NOT_ON_ALLOW_LIST',
])

type GqlError = { message?: string; extensions?: { code?: unknown } }
type GqlBody<T> = { data?: T | null; errors?: GqlError[] }

export class PublisherApiError extends Error {
  code: PublisherErrorCode
  status: number | null
  constructor(code: PublisherErrorCode, message: string, status: number | null) {
    super(message)
    this.name = 'PublisherApiError'
    this.code = code
    this.status = status
  }
}

export function isPublisherError(
  err: unknown,
  code?: PublisherErrorCode,
): err is PublisherApiError {
  return err instanceof PublisherApiError && (code === undefined || err.code === code)
}

/**
 * Map a GraphQL error (or a bare HTTP status) onto a PublisherApiError.
 * Precedence: a recognised extensions.code is authoritative; the schema-mismatch
 * regex is only a heuristic for a server too old to send codes; then 401.
 * The message is trimmed, so "verbatim" means trimmed-verbatim.
 */
export function toPublisherError(
  gqlError: { message?: string; extensions?: { code?: unknown } } | undefined,
  status: number | null,
): PublisherApiError {
  const message = (gqlError?.message ?? '').trim() || 'Request failed'
  const raw = gqlError?.extensions?.code
  if (typeof raw === 'string' && KNOWN_CODES.has(raw)) {
    return new PublisherApiError(raw as PublisherErrorCode, message, status)
  }
  if (/Cannot query field|Unknown type|Unknown argument/i.test(message)) {
    return new PublisherApiError('PUBLISHER_UNAVAILABLE', message, status)
  }
  // Only 401 maps: 403 is not "signed out", so routing to sign-in would be wrong.
  if (status === 401) return new PublisherApiError('UNAUTHENTICATED', message, status)
  return new PublisherApiError('UNKNOWN', message, status)
}

export async function publisherGql<T>(
  query: string,
  variables: Record<string, unknown> | undefined,
  token: string | null | undefined,
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  let res: Response
  try {
    res = await fetchImpl(getCloudEndpoint(), {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    })
  } catch (err) {
    throw new PublisherApiError(
      'NETWORK',
      err instanceof Error ? err.message : 'Network error',
      null,
    )
  }

  const body = (await res.json().catch(() => null)) as GqlBody<T> | null

  if (body?.errors?.length) throw toPublisherError(body.errors[0], res.status)
  if (!res.ok) throw toPublisherError({ message: `Request failed (${res.status})` }, res.status)
  if (!body || body.data == null)
    throw new PublisherApiError('UNKNOWN', 'Empty response', res.status)
  return body.data
}

/**
 * The spec requires backend error text be surfaced verbatim, so this returns the
 * SERVER's message for every code the server can send. Only NETWORK and
 * PUBLISHER_UNAVAILABLE get copy of our own, because those two are produced here
 * and their raw text ("fetch failed") means nothing to a publisher.
 *
 * UNKNOWN_APP is deliberately ambiguous server-side ("not yours" and "no such
 * app" are indistinguishable); do not add copy that guesses which happened.
 */
export function describePublisherError(err: unknown): string {
  if (isPublisherError(err, 'NETWORK'))
    return 'Lost the connection to Vetra. Check your network and try again.'
  if (isPublisherError(err, 'PUBLISHER_UNAVAILABLE')) {
    return 'The licensing API is not available on this deployment.'
  }
  if (err instanceof Error && err.message) return err.message
  return 'Something went wrong.'
}

/**
 * Retry policy for QUERIES only. Retrying UNKNOWN is safe today because React
 * Query's useMutation defaults to retry: 0 and the mutation hooks never pass this
 * policy; wiring it into a mutation could double-apply a grant.
 * Retry only transport-level failures; a coded refusal will not change on retry.
 */
export function retryPublisher(failureCount: number, error: unknown): boolean {
  if (isPublisherError(error) && !['NETWORK', 'UNKNOWN'].includes(error.code)) return false
  return failureCount < 2
}

// ---------------------------------------------------------------------------
// Queries. Every field except myApps takes an appId which the SERVER authorises
// against apps.owner_address; fetchers pass it through and never filter.
// myApps deliberately takes NO argument: it is derived from the caller's wallet.
// ---------------------------------------------------------------------------

const APP_FIELDS = `id name status`
const TYPE_FIELDS = `id kind label status validityDays templateHash
  size baseDomain packageRegistry
  services { id type prefix }
  packages { id packageName version }`
const LICENSE_FIELDS = `id user licenseTypeId status start end environmentId`
const ENV_FIELDS = `appId user environmentId licenseId templateHash`

export async function fetchMyApps(
  token: string | null,
  fetchImpl?: FetchLike,
): Promise<PublisherApp[]> {
  const data = await publisherGql<{ vetraPublisher: { myApps: PublisherApp[] } }>(
    `query { vetraPublisher { myApps { ${APP_FIELDS} } } }`,
    {},
    token,
    fetchImpl,
  )
  return data.vetraPublisher.myApps
}

export async function fetchLicenseTypes(
  appId: string,
  token: string | null,
  fetchImpl?: FetchLike,
): Promise<PublisherLicenseType[]> {
  const data = await publisherGql<{ vetraPublisher: { licenseTypes: PublisherLicenseType[] } }>(
    `query ($appId: String!) { vetraPublisher { licenseTypes(appId: $appId) { ${TYPE_FIELDS} } } }`,
    { appId },
    token,
    fetchImpl,
  )
  return data.vetraPublisher.licenseTypes
}

export async function fetchLicenses(
  appId: string,
  status: string | null,
  token: string | null,
  fetchImpl?: FetchLike,
): Promise<PublisherLicense[]> {
  const data = await publisherGql<{ vetraPublisher: { licenses: PublisherLicense[] } }>(
    `query ($appId: String!, $status: String) { vetraPublisher { licenses(appId: $appId, status: $status) { ${LICENSE_FIELDS} } } }`,
    { appId, status },
    token,
    fetchImpl,
  )
  return data.vetraPublisher.licenses
}

export async function fetchEnvironments(
  appId: string,
  token: string | null,
  fetchImpl?: FetchLike,
): Promise<AppUserEnvironment[]> {
  const data = await publisherGql<{ vetraPublisher: { environments: AppUserEnvironment[] } }>(
    `query ($appId: String!) { vetraPublisher { environments(appId: $appId) { ${ENV_FIELDS} } } }`,
    { appId },
    token,
    fetchImpl,
  )
  return data.vetraPublisher.environments
}

// ---------------------------------------------------------------------------
// Mutations. Input objects are passed straight through as the `input` variable:
// a key the caller omits stays absent from the JSON body ("leave unchanged") and
// a key set to null is sent as null ("clear"). Do not normalise, default or strip
// them. No retry or swallowing here; the UI layer decides how to react to
// INVALID_INPUT and friends.
// ---------------------------------------------------------------------------

async function mutate<T>(
  field: string,
  args: string,
  call: string,
  variables: Record<string, unknown>,
  token: string | null,
  fetchImpl?: FetchLike,
): Promise<T> {
  const data = await publisherGql<{ vetraPublisher: Record<string, T> }>(
    `mutation ${args} { vetraPublisher { ${call} } }`,
    variables,
    token,
    fetchImpl,
  )
  return data.vetraPublisher[field]
}

export const createLicenseType = (
  input: CreateLicenseTypeInput,
  token: string | null,
  fetchImpl?: FetchLike,
) =>
  mutate<string>(
    'createLicenseType',
    '($input: CreateLicenseTypeInput!)',
    'createLicenseType(input: $input)',
    { input },
    token,
    fetchImpl,
  )

export const setLicenseTypeDetails = (
  input: SetLicenseTypeDetailsInput,
  token: string | null,
  fetchImpl?: FetchLike,
) =>
  mutate<boolean>(
    'setLicenseTypeDetails',
    '($input: SetLicenseTypeDetailsInput!)',
    'setLicenseTypeDetails(input: $input)',
    { input },
    token,
    fetchImpl,
  )

export const setLicenseTypeTemplate = (
  input: SetLicenseTypeTemplateInput,
  token: string | null,
  fetchImpl?: FetchLike,
) =>
  mutate<boolean>(
    'setLicenseTypeTemplate',
    '($input: SetLicenseTypeTemplateInput!)',
    'setLicenseTypeTemplate(input: $input)',
    { input },
    token,
    fetchImpl,
  )

export const addLicenseTypeService = (
  input: AddLicenseTypeServiceInput,
  token: string | null,
  fetchImpl?: FetchLike,
) =>
  mutate<boolean>(
    'addLicenseTypeService',
    '($input: AddLicenseTypeServiceInput!)',
    'addLicenseTypeService(input: $input)',
    { input },
    token,
    fetchImpl,
  )

export const addLicenseTypePackage = (
  input: AddLicenseTypePackageInput,
  token: string | null,
  fetchImpl?: FetchLike,
) =>
  mutate<boolean>(
    'addLicenseTypePackage',
    '($input: AddLicenseTypePackageInput!)',
    'addLicenseTypePackage(input: $input)',
    { input },
    token,
    fetchImpl,
  )

// publish/retire take a bare licenseTypeId argument, not an input object.
export const publishLicenseType = (
  licenseTypeId: string,
  token: string | null,
  fetchImpl?: FetchLike,
) =>
  mutate<boolean>(
    'publishLicenseType',
    '($licenseTypeId: String!)',
    'publishLicenseType(licenseTypeId: $licenseTypeId)',
    { licenseTypeId },
    token,
    fetchImpl,
  )

export const retireLicenseType = (
  licenseTypeId: string,
  token: string | null,
  fetchImpl?: FetchLike,
) =>
  mutate<boolean>(
    'retireLicenseType',
    '($licenseTypeId: String!)',
    'retireLicenseType(licenseTypeId: $licenseTypeId)',
    { licenseTypeId },
    token,
    fetchImpl,
  )

export const issueGrant = (input: IssueGrantInput, token: string | null, fetchImpl?: FetchLike) =>
  mutate<string>(
    'issueGrant',
    '($input: IssueGrantInput!)',
    'issueGrant(input: $input)',
    { input },
    token,
    fetchImpl,
  )

export const revokeLicense = (
  input: RevokeLicenseInput,
  token: string | null,
  fetchImpl?: FetchLike,
) =>
  mutate<boolean>(
    'revokeLicense',
    '($input: RevokeLicenseInput!)',
    'revokeLicense(input: $input)',
    { input },
    token,
    fetchImpl,
  )
