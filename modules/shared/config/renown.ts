/** App identity: Renown SDK appName + localStorage namespace. */
export const RENOWN_APP_NAME = 'vetra'

/** Route handler that stores (POST) / clears (DELETE) the session cookie. */
export const RENOWN_SESSION_ENDPOINT = '/api/renown/session'

// Reads a runtime env var on both sides: window.__ENV in the browser (injected
// by the root layout), process.env on the server (layout / DAL / proxy).
export function readEnv(key: string): string {
  if (typeof window !== 'undefined') {
    const env = (window as unknown as { __ENV?: Record<string, string> }).__ENV
    if (env?.[key]) return env[key]
  }
  return process.env[key] ?? ''
}

// Switchboard GraphQL endpoint that issues + verifies Renown credentials. This
// is the dedicated Renown switchboard, distinct from vetra's own data API.
export function renownSwitchboardUrl(): string {
  return (
    readEnv('NEXT_PUBLIC_RENOWN_SWITCHBOARD_URL') ||
    // Server-side (verifySession) sees only process.env, where the container
    // sets the unprefixed name; the layout injects it as NEXT_PUBLIC_ for clients.
    readEnv('RENOWN_SWITCHBOARD_URL') ||
    'https://switchboard.renown.vetra.io/graphql'
  )
}

/** Renown service URL (redirect fallback + profile links); undefined when unset. */
export function renownUrl(): string | undefined {
  return readEnv('NEXT_PUBLIC_RENOWN_URL') || undefined
}
