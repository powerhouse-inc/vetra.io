import type { WalletAdapterDescriptor } from '@renown/sdk/wallet'
import { mockAdapter } from '@renown/sdk/wallet/mock'
import { privyAdapter } from '@renown/sdk/wallet/privy'
import { rainbowAdapter } from '@renown/sdk/wallet/rainbow'
import { readEnv } from '@/modules/shared/config/renown'

// Kept out of config/renown.ts, which the server-side DAL imports: importing an
// adapter makes its wallet library a build-time dep of every importer.

let cached: WalletAdapterDescriptor[] | undefined

/** Wallet adapters for in-page sign-in; each wallet library still loads lazily on the first login click. Memoized: the provider snapshots the array on mount and `useRenownLoginMethods` memoizes on its identity, so both call sites need one reference. */
export function walletAdapters(): WalletAdapterDescriptor[] {
  return (cached ??= buildWalletAdapters())
}

// NEXT_PUBLIC_RENOWN_MOCK=1 swaps in the headless mock signer (local dev / e2e).
function buildWalletAdapters(): WalletAdapterDescriptor[] {
  if (readEnv('NEXT_PUBLIC_RENOWN_MOCK') === '1') {
    return [mockAdapter({ methods: ['wallet', 'google', 'email'] })]
  }

  // RainbowKit is always on (offers injected wallets like MetaMask even without a
  // WalletConnect id — the adapter just hides WC). Privy added only when configured.
  const privyAppId = readEnv('NEXT_PUBLIC_PRIVY_APP_ID')
  const privyClientId = readEnv('NEXT_PUBLIC_PRIVY_CLIENT_ID')
  const walletConnectProjectId = readEnv('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID') || undefined

  return [
    rainbowAdapter({
      ...(walletConnectProjectId ? { walletConnectProjectId } : {}),
      // ssr: this is a Next.js host, so wagmi defers its hydrate onMount to an effect
      // instead of running it during render (which warns via RainbowKit's ConnectModal).
      ssr: true,
    }),
    ...(privyAppId
      ? [
          privyAdapter({
            appId: privyAppId,
            clientId: privyClientId || undefined,
            methods: ['google', 'email'],
          }),
        ]
      : []),
  ]
}
