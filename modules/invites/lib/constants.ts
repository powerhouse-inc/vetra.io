// Shared constants for the early-access gate. Pure literals only (no imports),
// safe to import from client code.

/** sessionStorage key holding a validated code across the Renown redirect. */
export const PENDING_CODE_KEY = 'vetra_invite_code'

/** TTL (seconds) requested for the Renown bearer token used to identify the user. */
export const BEARER_TOKEN_TTL_SECONDS = 600
