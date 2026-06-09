// Shared constants for the invite-code feature. Pure literals only (no imports),
// so this is safe to import from both server and client code.

/** Per-user access window granted on redemption (decision B in the brief). */
export const ACCESS_DAYS = 30

/** Max length accepted for a submitted invite code. */
export const CODE_MAX_LENGTH = 100

/** sessionStorage key holding a validated code across the Renown redirect. */
export const PENDING_CODE_KEY = 'vetra_invite_code'

/** TTL (seconds) requested for the Renown bearer token used to identify the user. */
export const BEARER_TOKEN_TTL_SECONDS = 600
