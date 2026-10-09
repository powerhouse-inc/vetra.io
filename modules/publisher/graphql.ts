import { getCloudEndpoint } from '@/modules/cloud/graphql'
import type {
  AddTemplateInput,
  AddTemplatePackageInput,
  AddTemplateServiceInput,
  AddTermInput,
  CreateInviteCodeInput,
  IssueGrantInput,
  PublisherAllowListEntry,
  PublisherApp,
  PublisherAppArtifact,
  PublisherEnvironment,
  PublisherInviteCode,
  PublisherLicense,
  PublisherTemplate,
  PublisherTerm,
  RemoveTemplateEntryInput,
  ReplaceGrantInput,
  RevokeLicenseInput,
  SetTemplateDetailsInput,
  SetTermDetailsInput,
  UpdateAppProfileInput,
} from './types'

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>

export type PublisherErrorCode =
  | 'UNAUTHENTICATED'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'INVALID_INPUT'
  | 'APP_NOT_ACTIVE'
  | 'NOT_ON_ALLOW_LIST'
  | 'TERM_NOT_ISSUABLE'
  | 'UNSUPPORTED_DID'
  | 'LICENSING_DISABLED'
  | 'INVALID_CODE'
  | 'ALREADY_HOLDS'
  | 'RATE_LIMITED'
  | 'PROFILE_UNAVAILABLE'
  | 'NO_IDENTITY'
  | 'PUBLISHER_UNAVAILABLE'
  | 'NETWORK'
  | 'UNKNOWN'

// Codes the vetra-licensing subgraph (vetraPublisher + vetraSubscriptions) sends in
// extensions.code. PUBLISHER_UNAVAILABLE, NETWORK and UNKNOWN are produced locally.
const KNOWN_CODES = new Set<string>([
  'UNAUTHENTICATED',
  'NOT_FOUND',
  'FORBIDDEN',
  'INVALID_INPUT',
  'APP_NOT_ACTIVE',
  'NOT_ON_ALLOW_LIST',
  'TERM_NOT_ISSUABLE',
  'UNSUPPORTED_DID',
  'LICENSING_DISABLED',
  'INVALID_CODE',
  'ALREADY_HOLDS',
  'RATE_LIMITED',
  'PROFILE_UNAVAILABLE',
  'NO_IDENTITY',
])

type GqlError = { message?: string; extensions?: { code?: unknown; field?: unknown } }
type GqlBody<T> = { data?: T | null; errors?: GqlError[] }

export class PublisherApiError extends Error {
  code: PublisherErrorCode
  status: number | null
  /** The input a refusal names (extensions.field), so a form can show it inline. */
  field: string | null
  constructor(
    code: PublisherErrorCode,
    message: string,
    status: number | null,
    field: string | null = null,
  ) {
    super(message)
    this.name = 'PublisherApiError'
    this.code = code
    this.status = status
    this.field = field
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
  gqlError: GqlError | undefined,
  status: number | null,
): PublisherApiError {
  const message = (gqlError?.message ?? '').trim() || 'Request failed'
  const raw = gqlError?.extensions?.code
  if (typeof raw === 'string' && KNOWN_CODES.has(raw)) {
    const field = gqlError?.extensions?.field
    return new PublisherApiError(
      raw as PublisherErrorCode,
      message,
      status,
      typeof field === 'string' ? field : null,
    )
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
 * Plain-language copy per code. INVALID_INPUT carries the reducer's own, specific
 * sentence ("kind … already exists") and UNKNOWN is whatever the server said, so
 * those two stay verbatim; everything else reads the same wherever it surfaces.
 */
export const ERROR_COPY: Partial<Record<PublisherErrorCode, string>> = {
  NETWORK: 'Lost the connection to Vetra. Check your network and try again.',
  PUBLISHER_UNAVAILABLE: 'Licensing is not available on this deployment yet.',
  UNAUTHENTICATED: 'Your login has expired. Log in again and retry.',
  NOT_FOUND: 'We could not find that. It may have been removed, or it belongs to another account.',
  FORBIDDEN: 'You are not allowed to do that for this app.',
  APP_NOT_ACTIVE:
    'This app is not active right now, so licensing changes are paused. Open the app’s Overview to see what it needs, then try again.',
  NOT_ON_ALLOW_LIST: 'That person is not on your allow list yet. Add them, then grant again.',
  TERM_NOT_ISSUABLE:
    'That plan can’t be handed out this way. Check it is published and allows this way of giving it out.',
  UNSUPPORTED_DID:
    'Use a wallet address (0x…) or a did:pkh identity. Other identity types are not supported.',
  LICENSING_DISABLED:
    'Licensing is switched off on this deployment right now. You can look, but not change anything.',
  INVALID_CODE: 'This code can’t be used. It may be mistyped, paused, expired or used up.',
  ALREADY_HOLDS: 'You already have this plan. Nothing to renew.',
  RATE_LIMITED: 'Too many saves in a short time. Wait a minute and try again.',
  PROFILE_UNAVAILABLE:
    'Renown is not reachable right now, so the profile was not saved. Try again in a minute.',
  NO_IDENTITY: 'This app has no Renown identity yet. Authorize its deploy identity first.',
}

export function describePublisherError(err: unknown): string {
  if (isPublisherError(err)) {
    const copy = ERROR_COPY[err.code]
    if (copy) return copy
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
// Reads. Every per-app field takes an appId the SERVER authorises against the
// app's owner; fetchers pass it through and never filter. myApps takes no
// argument: the server derives it from the caller's wallet.
// ---------------------------------------------------------------------------

const APP_FIELDS = `id name status identityDid`
const TEMPLATE_FIELDS = `id name mode sharedEnvironment size baseDomain packageRegistry
  templateHash environmentCount
  services { id type prefix artifactName artifactChannel }
  packages { id packageName version }`
const TERM_FIELDS = `id kind label templateId validityDays issuers status activeLicenses`
const ARTIFACT_FIELDS = `kind name versions { version reference } channels { channel version }`
const LICENSE_FIELDS = `id user kind issuer status start end environmentId replacedBy`
const ENVIRONMENT_FIELDS = `environmentId user licenseId rootLicenseId label templateHash stoppedAt deleteAfter`
export const INVITE_CODE_FIELDS = `code kind label active expiresAt maxUses redemptions hasAnthropicKey createdAt`
const ALLOW_LIST_FIELDS = `user addedAt`

async function read<T>(
  field: string,
  declaration: string,
  call: string,
  variables: Record<string, unknown>,
  token: string | null,
  fetchImpl?: FetchLike,
): Promise<T> {
  const data = await publisherGql<{ vetraPublisher: Record<string, T> }>(
    `query ${declaration} { vetraPublisher { ${call} } }`.replace('query  {', 'query {'),
    variables,
    token,
    fetchImpl,
  )
  return data.vetraPublisher[field]
}

const APP_ID = '($appId: String!)'

export const fetchPublisherApps = (token: string | null, fetchImpl?: FetchLike) =>
  read<PublisherApp[]>('myApps', '', `myApps { ${APP_FIELDS} }`, {}, token, fetchImpl)

export const fetchTemplates = (appId: string, token: string | null, fetchImpl?: FetchLike) =>
  read<PublisherTemplate[]>(
    'templates',
    APP_ID,
    `templates(appId: $appId) { ${TEMPLATE_FIELDS} }`,
    { appId },
    token,
    fetchImpl,
  )

export const fetchTerms = (appId: string, token: string | null, fetchImpl?: FetchLike) =>
  read<PublisherTerm[]>(
    'terms',
    APP_ID,
    `terms(appId: $appId) { ${TERM_FIELDS} }`,
    { appId },
    token,
    fetchImpl,
  )

/** Published artifacts. An app that has published nothing returns []. */
export const fetchAppArtifacts = (appId: string, token: string | null, fetchImpl?: FetchLike) =>
  read<PublisherAppArtifact[]>(
    'appArtifacts',
    APP_ID,
    `appArtifacts(appId: $appId) { ${ARTIFACT_FIELDS} }`,
    { appId },
    token,
    fetchImpl,
  )

export const fetchLicenses = (
  appId: string,
  status: string | null,
  token: string | null,
  fetchImpl?: FetchLike,
) =>
  read<PublisherLicense[]>(
    'licenses',
    '($appId: String!, $status: String)',
    `licenses(appId: $appId, status: $status) { ${LICENSE_FIELDS} }`,
    { appId, status },
    token,
    fetchImpl,
  )

export const fetchEnvironments = (appId: string, token: string | null, fetchImpl?: FetchLike) =>
  read<PublisherEnvironment[]>(
    'environments',
    APP_ID,
    `environments(appId: $appId) { ${ENVIRONMENT_FIELDS} }`,
    { appId },
    token,
    fetchImpl,
  )

export const fetchInviteCodes = (appId: string, token: string | null, fetchImpl?: FetchLike) =>
  read<PublisherInviteCode[]>(
    'inviteCodes',
    APP_ID,
    `inviteCodes(appId: $appId) { ${INVITE_CODE_FIELDS} }`,
    { appId },
    token,
    fetchImpl,
  )

export const fetchAllowList = (appId: string, token: string | null, fetchImpl?: FetchLike) =>
  read<PublisherAllowListEntry[]>(
    'allowList',
    APP_ID,
    `allowList(appId: $appId) { ${ALLOW_LIST_FIELDS} }`,
    { appId },
    token,
    fetchImpl,
  )

// ---------------------------------------------------------------------------
// Writes. Inputs and arguments go through untouched: a key the caller omits stays
// absent from the JSON and null stays null. No retry or swallowing here.
// ---------------------------------------------------------------------------

async function mutate<T>(
  field: string,
  declaration: string,
  call: string,
  variables: Record<string, unknown>,
  token: string | null,
  fetchImpl?: FetchLike,
): Promise<T> {
  const data = await publisherGql<{ vetraPublisher: Record<string, T> }>(
    `mutation ${declaration} { vetraPublisher { ${call} } }`,
    variables,
    token,
    fetchImpl,
  )
  return data.vetraPublisher[field]
}

/** A mutation that takes one `input` object. `selection` is for object results. */
function inputWrite<I extends object, R>(field: string, inputType: string, selection?: string) {
  return (input: I, token: string | null, fetchImpl?: FetchLike) =>
    mutate<R>(
      field,
      `($input: ${inputType}!)`,
      selection ? `${field}(input: $input) { ${selection} }` : `${field}(input: $input)`,
      { input },
      token,
      fetchImpl,
    )
}

/** A mutation that takes bare scalar arguments and returns Boolean!. */
function argsWrite<A extends Record<string, string | boolean>>(
  field: string,
  types: { [K in keyof A & string]: string },
) {
  const names = Object.keys(types) as Array<keyof A & string>
  const declaration = `(${names.map((n) => `$${n}: ${types[n]}`).join(', ')})`
  const call = `${field}(${names.map((n) => `${n}: $${n}`).join(', ')})`
  return (args: A, token: string | null, fetchImpl?: FetchLike) =>
    mutate<boolean>(field, declaration, call, args, token, fetchImpl)
}

export const addTemplate = inputWrite<AddTemplateInput, string>('addTemplate', 'AddTemplateInput')
export const setTemplateDetails = inputWrite<SetTemplateDetailsInput, boolean>(
  'setTemplateDetails',
  'SetTemplateDetailsInput',
)
export const addTemplateService = inputWrite<AddTemplateServiceInput, boolean>(
  'addTemplateService',
  'AddTemplateServiceInput',
)
export const removeTemplateService = inputWrite<RemoveTemplateEntryInput, boolean>(
  'removeTemplateService',
  'RemoveTemplateEntryInput',
)
export const addTemplatePackage = inputWrite<AddTemplatePackageInput, boolean>(
  'addTemplatePackage',
  'AddTemplatePackageInput',
)
export const removeTemplatePackage = inputWrite<RemoveTemplateEntryInput, boolean>(
  'removeTemplatePackage',
  'RemoveTemplateEntryInput',
)
export const addTerm = inputWrite<AddTermInput, string>('addTerm', 'AddTermInput')
export const setTermDetails = inputWrite<SetTermDetailsInput, boolean>(
  'setTermDetails',
  'SetTermDetailsInput',
)
export const issueGrant = inputWrite<IssueGrantInput, string>('issueGrant', 'IssueGrantInput')
export const replaceGrant = inputWrite<ReplaceGrantInput, string>(
  'replaceGrant',
  'ReplaceGrantInput',
)
export const revokeLicense = inputWrite<RevokeLicenseInput, boolean>(
  'revokeLicense',
  'RevokeLicenseInput',
)
export const createInviteCode = inputWrite<CreateInviteCodeInput, PublisherInviteCode>(
  'createInviteCode',
  'CreateInviteCodeInput',
  INVITE_CODE_FIELDS,
)

/** The app's public Renown profile; Vetra relays it to Renown (see vetra-cloud-package renown-profile.ts). */
export const updateAppProfile = inputWrite<UpdateAppProfileInput, boolean>(
  'updateAppProfile',
  'UpdateAppProfileInput',
)

export const deleteTemplate = argsWrite<{ appId: string; templateId: string }>('deleteTemplate', {
  appId: 'String!',
  templateId: 'String!',
})
export const publishTerm = argsWrite<{ appId: string; termId: string }>('publishTerm', {
  appId: 'String!',
  termId: 'String!',
})
export const retireTerm = argsWrite<{ appId: string; termId: string }>('retireTerm', {
  appId: 'String!',
  termId: 'String!',
})
export const setInviteCodeActive = argsWrite<{ appId: string; code: string; active: boolean }>(
  'setInviteCodeActive',
  { appId: 'String!', code: 'String!', active: 'Boolean!' },
)
export const addToAllowList = argsWrite<{ appId: string; user: string }>('addToAllowList', {
  appId: 'String!',
  user: 'String!',
})
export const removeFromAllowList = argsWrite<{ appId: string; user: string }>(
  'removeFromAllowList',
  { appId: 'String!', user: 'String!' },
)
