// Browser client for the VetraStudioPool namespace on the cloud Switchboard.

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

type GqlResponse<T> = {
  data?: T
  errors?: Array<{ message?: string }>
}

async function gql<T>(
  query: string,
  variables: Record<string, unknown>,
  token?: string | null,
): Promise<T | null> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  try {
    const res = await fetch(getEndpoint(), {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    })
    if (!res.ok) return null
    const json = (await res.json()) as GqlResponse<T>
    if (json.errors?.length || !json.data) return null
    return json.data
  } catch {
    return null
  }
}

/**
 * The vetra-cli version the backend pool currently provisions. Sourced live so
 * a stale (cached) frontend bundle still cold-provisions the current CLI instead
 * of the version baked into its bundle. Public (no token). Returns null on a
 * transport/GraphQL error or an older backend that lacks the field — the caller
 * then falls back to the bundled `STUDIO_AGENT_VERSION` constant.
 */
export async function fetchStudioPoolVersion(): Promise<string | null> {
  const data = await gql<{ VetraStudioPool: { config: { version: string } } }>(
    `query { VetraStudioPool { config { version } } }`,
    {},
  )
  return data?.VetraStudioPool?.config?.version ?? null
}

export type ClaimStudioEnvironmentResult = {
  documentId: string
  subdomain: string
  tenantId: string
}

/**
 * Claim a pre-provisioned ("warm") studio for the authenticated caller. The
 * subgraph assigns one atomically, transfers ownership, and injects the key
 * from the caller's studio licence server-side. Returns null when none is available
 * (caller should fall back to cold provisioning) or on transport failure.
 */
export async function claimStudioEnvironment(
  token: string,
): Promise<ClaimStudioEnvironmentResult | null> {
  const data = await gql<{
    VetraStudioPool: { claimStudioEnvironment: ClaimStudioEnvironmentResult | null }
  }>(
    `mutation {
      VetraStudioPool {
        claimStudioEnvironment { documentId subdomain tenantId }
      }
    }`,
    {},
    token,
  )
  return data?.VetraStudioPool?.claimStudioEnvironment ?? null
}
