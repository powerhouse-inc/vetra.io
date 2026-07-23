'use client'

import { RenownProvider } from '@powerhousedao/reactor-browser/renown'
import type { User } from '@renown/sdk'
import type { WalletTheme } from '@renown/sdk/wallet'
import { useTheme } from 'next-themes'
import type { ReactNode } from 'react'
import {
  RENOWN_APP_NAME,
  RENOWN_SESSION_ENDPOINT,
  renownSwitchboardUrl,
  renownUrl,
  walletAdapters,
} from '@/modules/shared/config/renown'

// One provider: SDK init, first-render seed from the server `session`, wallet
// adapters (lazy), and the cookie sync. A defined `session` enables both.
export function RenownProviders({
  children,
  session,
}: {
  children: ReactNode
  session: { user?: User } | null
}) {
  const { resolvedTheme } = useTheme()
  const theme: WalletTheme = resolvedTheme === 'dark' ? 'dark' : 'light'

  return (
    <RenownProvider
      appName={RENOWN_APP_NAME}
      namespace={RENOWN_APP_NAME}
      url={renownUrl()}
      switchboardUrl={renownSwitchboardUrl()}
      adapters={walletAdapters()}
      theme={theme}
      session={session}
      sessionEndpoint={RENOWN_SESSION_ENDPOINT}
      // Trust the localStorage-restored credential across reloads. "always" would
      // re-read it from the switchboard and log out on any read-back miss (#2881).
      revalidate="never"
      onError={(error) => console.error('Renown init failed', error)}
    >
      {children}
    </RenownProvider>
  )
}
