import type { WalletAdaptersConfig } from '@renown/sdk/wallet'

/** App identity: Renown SDK appName + localStorage namespace. */
export const RENOWN_APP_NAME = 'vetra'

/** Route handler that stores (POST) / clears (DELETE) the session cookie. */
export const RENOWN_SESSION_ENDPOINT = '/api/renown/session'

// Reads a runtime env var on both sides: window.__ENV in the browser (injected
// by the root layout), process.env on the server (layout / DAL / proxy).
function readEnv(key: string): string {
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

// Wallet adapters for in-page sign-in, lazy-loaded on first login click.
// NEXT_PUBLIC_RENOWN_MOCK=1 swaps in the headless mock signer (local dev / e2e).
export function walletAdapters(): WalletAdaptersConfig {
  if (readEnv('NEXT_PUBLIC_RENOWN_MOCK') === '1') {
    return { mock: { methods: ['wallet', 'google', 'email'] } }
  }

  // RainbowKit is always on (offers injected wallets like MetaMask even without a
  // WalletConnect id — the adapter just hides WC). Privy added only when configured.
  const privyAppId = readEnv('NEXT_PUBLIC_PRIVY_APP_ID')
  const privyClientId = readEnv('NEXT_PUBLIC_PRIVY_CLIENT_ID')
  const walletConnectProjectId = readEnv('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID') || undefined

  return {
    // ssr: this is a Next.js host, so wagmi defers its hydrate onMount to an effect
    // instead of running it during render (which warns via RainbowKit's ConnectModal).
    rainbow: { ...(walletConnectProjectId ? { walletConnectProjectId } : {}), ssr: true },
    ...(privyAppId
      ? {
          privy: {
            appId: privyAppId,
            clientId: privyClientId || undefined,
            methods: ['google', 'email'],
          },
        }
      : {}),
  }
}
