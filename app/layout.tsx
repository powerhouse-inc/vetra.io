import { Inter } from 'next/font/google'
import { headers } from 'next/headers'
import { CloudAuthBridge } from '@/modules/cloud/components/cloud-auth-bridge'
import { OpenPanelProvider } from '@/modules/shared/components/openpanel'
import { LoginModalProvider } from '@/modules/shared/components/renown/login-modal-context'
import { RenownLoginModal } from '@/modules/shared/components/renown/renown-login-modal'
import { RenownProviders } from '@/modules/shared/components/renown/renown-providers'
import { AmbientBackground } from '@/modules/shared/components/ui/ambient-background'
import { GlobalRefreshIndicator } from '@/modules/shared/components/ui/global-refresh-indicator'
import { SyncStatusChip } from '@/modules/shared/components/ui/sync-status-chip'
import { AppStateCoordinator } from '@/modules/shared/state'
import { Toaster } from '@/modules/shared/components/ui/sonner'
import { ThemeProvider } from '@/modules/shared/providers/theme-provider'
import { Footer } from '@/shared/components/footer/footer'
import Navbar from '@/shared/components/navbar/navbar'
import { QueryClientProvider } from '@/shared/providers/query-client'
import { verifySession } from '@/modules/shared/lib/renown-session'
import type { Metadata } from 'next'
import { NuqsAdapter } from 'nuqs/adapters/next/app'

import './globals.css'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
})

export const metadata: Metadata = {
  title: 'Vetra',
  description: 'Vetra',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Calling headers() opts this layout into dynamic rendering,
  // ensuring process.env is read at request time, not build time.
  await headers()

  // Server-verified session seeds the client provider so the first render is
  // already authenticated when a valid cookie is present (no logged-out flash).
  const session = await verifySession()

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__ENV=${JSON.stringify({
              NEXT_PUBLIC_SWITCHBOARD_URL:
                process.env.SWITCHBOARD_URL ||
                process.env.GRAPHQL_ENDPOINT ||
                process.env.NEXT_PUBLIC_SWITCHBOARD_URL ||
                '',
              NEXT_PUBLIC_CLOUD_SWITCHBOARD_URL:
                process.env.CLOUD_SWITCHBOARD_URL ||
                process.env.NEXT_PUBLIC_CLOUD_SWITCHBOARD_URL ||
                '',
              NEXT_PUBLIC_CLOUD_DRIVE_ID:
                process.env.CLOUD_DRIVE_ID || process.env.NEXT_PUBLIC_CLOUD_DRIVE_ID || '',
              NEXT_PUBLIC_RENOWN_URL:
                process.env.RENOWN_URL || process.env.NEXT_PUBLIC_RENOWN_URL || '',
              NEXT_PUBLIC_RENOWN_SWITCHBOARD_URL:
                process.env.RENOWN_SWITCHBOARD_URL ||
                process.env.NEXT_PUBLIC_RENOWN_SWITCHBOARD_URL ||
                '',
              NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID:
                process.env.WALLETCONNECT_PROJECT_ID ||
                process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
                '',
              NEXT_PUBLIC_PRIVY_APP_ID:
                process.env.PRIVY_APP_ID || process.env.NEXT_PUBLIC_PRIVY_APP_ID || '',
              NEXT_PUBLIC_PRIVY_CLIENT_ID:
                process.env.PRIVY_CLIENT_ID || process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID || '',
              NEXT_PUBLIC_RENOWN_MOCK:
                process.env.RENOWN_MOCK || process.env.NEXT_PUBLIC_RENOWN_MOCK || '',
              NEXT_PUBLIC_GITHUB_APP_SLUG:
                process.env.GITHUB_APP_SLUG || process.env.NEXT_PUBLIC_GITHUB_APP_SLUG || '',
              NEXT_PUBLIC_STUDIO_REGISTRY:
                process.env.STUDIO_REGISTRY || process.env.NEXT_PUBLIC_STUDIO_REGISTRY || '',
              NEXT_PUBLIC_MAX_STUDIOS_PER_USER:
                process.env.MAX_STUDIOS_PER_USER ||
                process.env.NEXT_PUBLIC_MAX_STUDIOS_PER_USER ||
                '',
            })}`,
          }}
        />
      </head>
      <body className={`${inter.variable} bg-background antialiased`}>
        <AmbientBackground />
        <OpenPanelProvider
          clientId={process.env.OPENPANEL_CLIENT_ID || process.env.NEXT_PUBLIC_OPENPANEL_CLIENT_ID}
          apiUrl={process.env.OPENPANEL_API_URL || process.env.NEXT_PUBLIC_OPENPANEL_API_URL}
          environment={process.env.OPENPANEL_ENV || process.env.NEXT_PUBLIC_OPENPANEL_ENV}
        />
        <NuqsAdapter>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <QueryClientProvider>
              <RenownProviders session={session}>
                <LoginModalProvider>
                  <AppStateCoordinator>
                    <GlobalRefreshIndicator />
                    <SyncStatusChip />
                    <CloudAuthBridge />
                    <RenownLoginModal />
                    <div className="items-right flex min-h-screen flex-col">
                      <Navbar />
                      <main className="flex-1">{children}</main>
                      <Footer />
                    </div>
                    <Toaster />
                  </AppStateCoordinator>
                </LoginModalProvider>
              </RenownProviders>
            </QueryClientProvider>
          </ThemeProvider>
        </NuqsAdapter>
      </body>
    </html>
  )
}
