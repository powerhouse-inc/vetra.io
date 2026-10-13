import { createClient } from '@powerhousedao/reactor-browser'

// Read env vars from window.__ENV (injected at runtime by the server layout)
// with fallback to process.env (inlined at build time by Next.js).
function readEnv(key: string): string {
  if (typeof window !== 'undefined') {
    const windowEnv = (window as unknown as { __ENV?: Record<string, string> }).__ENV
    if (windowEnv?.[key]) return windowEnv[key]
  }
  return process.env[key] ?? ''
}

function getEndpoint(): string {
  return (
    readEnv('NEXT_PUBLIC_CLOUD_SWITCHBOARD_URL') ||
    readEnv('NEXT_PUBLIC_SWITCHBOARD_URL') ||
    'https://switchboard.vetra.io/graphql'
  )
}

function getDriveId(): string {
  return readEnv('NEXT_PUBLIC_CLOUD_DRIVE_ID') || 'powerhouse'
}

/**
 * A function that resolves the current user's Renown bearer token, or null
 * if the user is not logged in. Set at runtime via `setAuthTokenProvider`
 * (typically from a React component that has access to `useRenown()`).
 */
export type AuthTokenProvider = () => Promise<string | null>

let authTokenProvider: AuthTokenProvider | null = null

/**
 * Register the bearer-token provider for all reactor client requests.
 * Call this once at app startup (after Renown is available) so every
 * request carries the caller's identity.
 */
export function setAuthTokenProvider(provider: AuthTokenProvider | null): void {
  authTokenProvider = provider
}

/**
 * Resolve a bearer token, trying the registered provider first, then
 * falling back to the global Renown instance (window.ph.renown). The
 * fallback covers the race where the signer/controller is ready before
 * CloudAuthBridge's useEffect has fired.
 */
export async function resolveAuthToken(): Promise<string | null> {
  if (authTokenProvider) {
    try {
      return await authTokenProvider()
    } catch {
      /* fall through to global fallback */
    }
  }
  if (typeof window !== 'undefined') {
    try {
      const renown = (
        window as unknown as {
          ph?: {
            renown?: { getBearerToken: (opts: { expiresIn: number }) => Promise<string | null> }
          }
        }
      ).ph?.renown
      if (renown) return await renown.getBearerToken({ expiresIn: 600 })
    } catch {
      /* no token available */
    }
  }
  return null
}

/**
 * SDK middleware that attaches an `Authorization: Bearer <renown-token>`
 * header to every reactor GraphQL request. Falls back to window.ph.renown
 * when the React-level provider hasn't been registered yet.
 */
async function withAuth<T>(
  action: (requestHeaders?: Record<string, string>) => Promise<T>,
): Promise<T> {
  const token = await resolveAuthToken()
  if (!token) return action()
  return action({ authorization: `Bearer ${token}` })
}

/** Reactor GraphQL client used for signed action push/pull. */
export const client = createClient(getEndpoint(), withAuth)

/** ID of the drive that holds vetra-cloud-environment documents. */
export const DRIVE_ID = getDriveId()
