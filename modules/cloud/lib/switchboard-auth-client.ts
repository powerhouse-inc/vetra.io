/**
 * Per-tenant GraphQL client for the switchboard's reactor-api auth surface.
 *
 * Each tenant switchboard exposes its own auth GraphQL — `groups`,
 * `documentAccess`, `documentProtection`, `userDocumentPermissions`, etc.
 * The Auth tab in the service drawer points the same set of queries at
 * whichever tenant the viewer is inspecting, so we accept the URL as a
 * parameter rather than reading the central admin endpoint.
 *
 * IMPORTANT: bearer tokens are minted WITHOUT an `aud` claim. did-jwt
 * (the switchboard's JWT verifier) rejects aud-bearing tokens on
 * switchboards that don't have an app address configured — Vetra's
 * tenant switchboards don't. This mirrors the auth-editor demo's
 * `useAuthApi` and Vetra's `getAuthToken` helper.
 */

type Renown =
  | {
      getBearerToken: (opts: { expiresIn: number }) => Promise<string | null>
    }
  | null
  | undefined

type GraphQLResponse<T> = {
  data?: T
  errors?: Array<{ message?: string }>
}

export type SwitchboardAuthClient = {
  query: <T>(gql: string, variables?: Record<string, unknown>) => Promise<T>
}

/**
 * Normalise the tenant switchboard URL by appending `/graphql` if it isn't
 * already part of the path. We strip any trailing slash on the input first
 * so the result is always `<host>/graphql` with no double slash.
 */
function resolveGraphqlEndpoint(switchboardUrl: string): string {
  const trimmed = switchboardUrl.replace(/\/+$/, '')
  if (trimmed.endsWith('/graphql')) return trimmed
  return `${trimmed}/graphql`
}

export function createSwitchboardAuthClient(
  switchboardUrl: string,
  renown: Renown,
): SwitchboardAuthClient {
  const endpoint = resolveGraphqlEndpoint(switchboardUrl)

  async function query<T>(gql: string, variables?: Record<string, unknown>): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (renown) {
      try {
        const token = await renown.getBearerToken({ expiresIn: 600 })
        if (token) {
          headers.Authorization = `Bearer ${token}`
        }
      } catch {
        // Fall through — server returns viewer=null and most mutations 401.
        // The caller surfaces that as the inline error banner.
      }
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query: gql, variables }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`HTTP ${res.status}: ${text || res.statusText}`)
    }

    const json = (await res.json()) as GraphQLResponse<T>
    if (json.errors?.length) {
      throw new Error(json.errors.map((e) => e.message ?? 'GraphQL error').join('; '))
    }
    if (json.data === undefined || json.data === null) {
      throw new Error('No data returned')
    }
    return json.data
  }

  return { query }
}
