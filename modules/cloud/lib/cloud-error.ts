/**
 * Turns errors from the cloud backend (GraphQL resolvers, the document-model
 * reducer, fetch) into sentences a user can act on. Backend errors carry
 * machine codes (`DUMP_IN_PROGRESS`, `NotOwnerError`, `GraphQL request failed:
 * 503 …`) that must never reach a toast verbatim, so anything unrecognised
 * falls back to the caller's sentence.
 */

/**
 * An error whose message was written for the user. `describeCloudError`
 * passes its message through unchanged.
 */
export class CloudUserError extends Error {
  override name = 'CloudUserError'
}

/** Error classes (by name) whose messages are already user-facing. */
const USER_FACING_ERROR_NAMES = new Set([
  'CloudUserError',
  'EnvironmentAccessError',
  'EnvironmentActionRejectedError',
  'EnvironmentHandOverError',
])

export type CloudErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'ENV_NOT_FOUND'
  | 'ENV_NOT_READY'
  | 'ENV_NOT_ACTIVE'
  | 'DUMP_IN_PROGRESS'
  | 'RESTORE_IN_PROGRESS'
  | 'DUMP_NOT_FOUND'
  | 'DUMP_NOT_READY'
  | 'DUMP_EXPIRED'
  | 'DUMPS_NOT_CONFIGURED'
  | 'RESTART_NOT_CONFIGURED'
  | 'RESET_NOT_CONFIGURED'
  | 'TRUNCATE_FAILED'
  | 'DEPLOYMENT_NOT_FOUND'
  | 'AMBIGUOUS_SERVICE'
  | 'INVALID_RETENTION'
  | 'DOMAIN_TAKEN'
  | 'INVALID_APEX_SERVICE'
  | 'INVALID_REGISTRY'
  | 'NETWORK'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'

const DEFAULT_MESSAGES: Record<CloudErrorCode, string> = {
  UNAUTHENTICATED: 'Your session has expired. Log in with Renown and try again.',
  FORBIDDEN: "You don't have permission to change this environment.",
  ENV_NOT_FOUND: 'This environment could not be found. It may have been deleted.',
  ENV_NOT_READY: 'The environment must be running to do this. Try again once it is ready.',
  ENV_NOT_ACTIVE: 'This environment is no longer active.',
  DUMP_IN_PROGRESS: 'A backup is already in progress for this environment.',
  RESTORE_IN_PROGRESS: 'A restore is in progress. Try again once it has finished.',
  DUMP_NOT_FOUND: 'This backup no longer exists.',
  DUMP_NOT_READY: 'This backup is not ready yet.',
  DUMP_EXPIRED: 'This backup has expired and is no longer available.',
  DUMPS_NOT_CONFIGURED: "Backups aren't available for this environment yet.",
  RESTART_NOT_CONFIGURED: "Restart isn't available for this environment.",
  RESET_NOT_CONFIGURED: "Reset isn't available for this environment.",
  TRUNCATE_FAILED: 'Could not clear the database. Try again or contact support.',
  DEPLOYMENT_NOT_FOUND: "This service isn't deployed yet.",
  AMBIGUOUS_SERVICE: 'Could not tell which service to act on. Try again or contact support.',
  INVALID_RETENTION: 'Keep between 1 and 30 backups.',
  DOMAIN_TAKEN: 'Another environment already uses this domain.',
  INVALID_APEX_SERVICE: "That service can't be served at the bare domain.",
  INVALID_REGISTRY: "That package registry address isn't valid.",
  NETWORK: "Couldn't reach Vetra Cloud. Check your connection and try again.",
  RATE_LIMITED: 'Too many requests. Wait a moment and try again.',
  SERVER_ERROR: 'Vetra Cloud is having trouble right now. Try again in a moment.',
}

/** Literal codes the backend puts in error messages, in match order. */
const LITERAL_CODES: CloudErrorCode[] = [
  'UNAUTHENTICATED',
  'ENV_NOT_FOUND',
  'ENV_NOT_READY',
  'ENV_NOT_ACTIVE',
  'DUMP_IN_PROGRESS',
  'RESTORE_IN_PROGRESS',
  'DUMP_NOT_FOUND',
  'DUMP_NOT_READY',
  'DUMP_EXPIRED',
  'DUMPS_NOT_CONFIGURED',
  'RESTART_NOT_CONFIGURED',
  'RESET_NOT_CONFIGURED',
  'TRUNCATE_FAILED',
  'DEPLOYMENT_NOT_FOUND',
  'AMBIGUOUS_SERVICE',
  'INVALID_RETENTION',
  'DOMAIN_TAKEN',
  'INVALID_APEX_SERVICE',
  'INVALID_REGISTRY',
  'FORBIDDEN',
]

const NETWORK_PATTERNS = [
  /failed to fetch/i,
  /fetch failed/i,
  /networkerror/i,
  /network request failed/i,
  /load failed/i,
  /ECONNREFUSED|ECONNRESET|ETIMEDOUT/,
]

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return ''
}

/** Classifies an error into a known code, or `null` when unrecognised. */
export function cloudErrorCode(err: unknown): CloudErrorCode | null {
  const message = messageOf(err)
  if (!message) return null

  for (const code of LITERAL_CODES) {
    if (message.includes(code)) return code
  }
  if (/NotOwnerError/.test(message)) return 'FORBIDDEN'
  if (/logged in with Renown|not authenticated|unauthori[sz]ed/i.test(message)) {
    return 'UNAUTHENTICATED'
  }

  const status = /GraphQL request failed:\s*(\d{3})/.exec(message)?.[1]
  if (status) {
    if (status === '401') return 'UNAUTHENTICATED'
    if (status === '403') return 'FORBIDDEN'
    if (status === '429') return 'RATE_LIMITED'
    if (status.startsWith('5')) return 'SERVER_ERROR'
    return null
  }

  if (NETWORK_PATTERNS.some((re) => re.test(message))) return 'NETWORK'
  return null
}

/**
 * User-facing sentence for a cloud error. Known codes map to fixed copy
 * (`overrides` lets a caller phrase one for its context, e.g. "Only the
 * environment owner can restore a backup."); anything else returns
 * `fallback`, so a raw backend code never reaches the user.
 */
export function describeCloudError(
  err: unknown,
  fallback: string,
  overrides: Partial<Record<CloudErrorCode, string>> = {},
): string {
  if (err instanceof Error && USER_FACING_ERROR_NAMES.has(err.name) && err.message) {
    return err.message
  }
  const code = cloudErrorCode(err)
  if (!code) return fallback
  return overrides[code] ?? DEFAULT_MESSAGES[code]
}

/** User-facing sentence for a failed restart of a service or an agent. */
export function describeRestartError(err: unknown, what: 'service' | 'agent'): string {
  return describeCloudError(err, `Couldn't restart the ${what}. Try again.`, {
    DEPLOYMENT_NOT_FOUND: `This ${what} isn't deployed yet.`,
    AMBIGUOUS_SERVICE: `Could not identify the ${what}. Try again or contact support.`,
    FORBIDDEN: 'Only the environment owner can restart.',
  })
}
