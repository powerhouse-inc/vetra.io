// Shared constants for the early-access gate. Pure literals only (no imports),
// safe to import from client code.

/** sessionStorage key holding a validated code across the Renown redirect. */
export const PENDING_CODE_KEY = 'vetra_invite_code'

/**
 * localStorage key marking that this browser has already been granted early
 * access. Lets returning users skip the full-screen "setting up access" splash
 * (we reveal the studio immediately and revalidate access in the background).
 */
export const ACCESS_GRANTED_KEY = 'vetra_access_granted'

/** TTL (seconds) requested for the Renown bearer token used to identify the user. */
export const BEARER_TOKEN_TTL_SECONDS = 600
