function readEnv(key: string): string {
  if (typeof window !== 'undefined') {
    const windowEnv = (window as unknown as { __ENV?: Record<string, string> }).__ENV
    if (windowEnv?.[key]) return windowEnv[key]
  }
  return process.env[key] ?? ''
}

/** The cloud switchboard GraphQL URL hosting the vetra-github-auth subgraph. */
export function cloudSwitchboardUrl(): string {
  return (
    readEnv('NEXT_PUBLIC_CLOUD_SWITCHBOARD_URL') ||
    readEnv('NEXT_PUBLIC_SWITCHBOARD_URL') ||
    'https://switchboard.vetra.io/graphql'
  )
}

type GqlResponse<T> = {
  data?: T
  errors?: Array<{ message?: string; extensions?: { code?: string } }>
}

/** POSTs a GraphQL operation; returns the data and the first error code. */
async function gql<T>(
  query: string,
  variables: Record<string, unknown>,
  token?: string | null,
): Promise<{ data: T | null; errorMessage: string | null }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  try {
    const res = await fetch(cloudSwitchboardUrl(), {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    })
    if (!res.ok) return { data: null, errorMessage: `HTTP_${res.status}` }
    const json = (await res.json()) as GqlResponse<T>
    const err = json.errors?.[0]
    return {
      data: json.data ?? null,
      errorMessage: err?.extensions?.code ?? err?.message ?? null,
    }
  } catch {
    return { data: null, errorMessage: 'NETWORK_ERROR' }
  }
}

/** Where to send the user to install the app on their account. */
export function githubInstallUrl(): string | null {
  const slug = readEnv('NEXT_PUBLIC_GITHUB_APP_SLUG')
  return slug ? `https://github.com/apps/${slug}/installations/new` : null
}

export type GithubConnection = {
  environmentId: string
  installationId: string
  repoFullName: string
  repoUrl: string
  createdAt: string
}

export type GithubConnectionStatus = {
  connected: boolean
  connection: GithubConnection | null
}

export type GithubDeviceFlow = {
  deviceCode: string
  userCode: string
  verificationUri: string
  expiresIn: number
  interval: number
}

/** Result of one connectGithub poll, mapped from the backend's status/error codes. */
export type ConnectResult =
  | { status: 'connected'; connection: GithubConnection | null }
  | { status: 'pending' }
  | { status: 'slowDown' }
  | { status: 'expired' }
  | { status: 'denied' }
  | { status: 'appNotInstalled' }
  | { status: 'repoExists' }
  | { status: 'unauthenticated' }
  | { status: 'error'; message: string }

type PollStatus = Exclude<ConnectResult['status'], 'connected' | 'error'>

const CONNECT_ERROR_STATUS: Record<string, PollStatus> = {
  AUTHORIZATION_PENDING: 'pending',
  SLOW_DOWN: 'slowDown',
  DEVICE_CODE_EXPIRED: 'expired',
  ACCESS_DENIED: 'denied',
  APP_NOT_INSTALLED: 'appNotInstalled',
  REPO_ALREADY_EXISTS: 'repoExists',
  UNAUTHENTICATED: 'unauthenticated',
}

/** The authenticated caller's current GitHub connection. Null on failure. */
export async function myGithubConnection(
  environmentId: string,
  token: string,
): Promise<GithubConnectionStatus | null> {
  const { data } = await gql<{
    VetraGithubAuth: { myGithubConnection: GithubConnectionStatus }
  }>(
    `query ($environmentId: String!) {
      VetraGithubAuth {
        myGithubConnection(environmentId: $environmentId) {
          connected
          connection { environmentId installationId repoFullName repoUrl createdAt }
        }
      }
    }`,
    { environmentId },
    token,
  )
  return data?.VetraGithubAuth?.myGithubConnection ?? null
}

/** Begin device authorization. Null on failure. */
export async function startGithubDeviceFlow(token: string): Promise<GithubDeviceFlow | null> {
  const { data } = await gql<{
    VetraGithubAuth: { startGithubDeviceFlow: GithubDeviceFlow }
  }>(
    `mutation {
      VetraGithubAuth {
        startGithubDeviceFlow { deviceCode userCode verificationUri expiresIn interval }
      }
    }`,
    {},
    token,
  )
  return data?.VetraGithubAuth?.startGithubDeviceFlow ?? null
}

/**
 * Exchange the device code and, once authorized, create the repo and persist the
 * binding for the environment. Returns a discriminated result.
 */
export async function connectGithub(
  deviceCode: string,
  repoName: string,
  environmentId: string,
  token: string,
): Promise<ConnectResult> {
  const { data, errorMessage } = await gql<{
    VetraGithubAuth: { connectGithub: GithubConnectionStatus }
  }>(
    `mutation ($deviceCode: String!, $repoName: String!, $environmentId: String!) {
      VetraGithubAuth {
        connectGithub(deviceCode: $deviceCode, repoName: $repoName, environmentId: $environmentId) {
          connected
          connection { environmentId installationId repoFullName repoUrl createdAt }
        }
      }
    }`,
    { deviceCode, repoName, environmentId },
    token,
  )

  const result = data?.VetraGithubAuth?.connectGithub
  if (result) return { status: 'connected', connection: result.connection }
  if (errorMessage) {
    const mapped = CONNECT_ERROR_STATUS[errorMessage]
    return mapped ? { status: mapped } : { status: 'error', message: errorMessage }
  }
  return { status: 'error', message: 'UNKNOWN' }
}
