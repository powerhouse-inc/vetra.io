import { getCloudEndpoint } from '@/modules/cloud/graphql'

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
