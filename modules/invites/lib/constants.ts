// Shared constants for the invite-code feature. Pure literals only (no imports),
// so this is safe to import from both server and client code.

/** Per-user access window granted on redemption (decision B in the brief). */
export const ACCESS_DAYS = 30

/** Max length accepted for a submitted invite code. */
export const CODE_MAX_LENGTH = 100

/** Per-IP rate-limit window shared by the invite endpoints. */
export const RATE_LIMIT_WINDOW_MS = 60_000

/** Max validate attempts per IP per window (the brute-force surface). */
export const VALIDATE_RATE_LIMIT = 15

/** Max redeem attempts per IP per window (each does a JWT verify + DB write). */
export const REDEEM_RATE_LIMIT = 10

/** Prune expired limiter buckets once the map grows past this size. */
export const RATE_LIMIT_MAX_BUCKETS = 10_000

/** sessionStorage key holding a validated code across the Renown redirect. */
export const PENDING_CODE_KEY = 'vetra_invite_code'

/** TTL (seconds) requested for the Renown bearer token used to identify the user. */
export const BEARER_TOKEN_TTL_SECONDS = 600
