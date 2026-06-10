import { Inter } from 'next/font/google'
import { headers } from 'next/headers'
import { CloudAuthBridge } from '@/modules/cloud/components/cloud-auth-bridge'
import { OpenPanelProvider } from '@/modules/shared/components/openpanel'
import { RenownProvider } from '@/modules/shared/components/renown/renown-provider'
import { AmbientBackground } from '@/modules/shared/components/ui/ambient-background'
import { GlobalRefreshIndicator } from '@/modules/shared/components/ui/global-refresh-indicator'
import { Toaster } from '@/modules/shared/components/ui/sonner'
import { ThemeProvider } from '@/modules/shared/providers/theme-provider'
import { Footer } from '@/shared/components/footer/footer'
import Navbar from '@/shared/components/navbar/navbar'
import { QueryClientProvider } from '@/shared/providers/query-client'
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
              NEXT_PUBLIC_STUDIO_ALLOWLIST: process.env.NEXT_PUBLIC_STUDIO_ALLOWLIST || '',
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
          <ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange>
            <QueryClientProvider>
              <GlobalRefreshIndicator />
              <RenownProvider appName="vetra" url={process.env.NEXT_PUBLIC_RENOWN_URL} />
              <CloudAuthBridge />
              <div className="items-right flex min-h-screen flex-col">
                <Navbar />
                <main className="flex-1">{children}</main>
                <Footer />
              </div>
              <Toaster />
            </QueryClientProvider>
          </ThemeProvider>
        </NuqsAdapter>
      </body>
    </html>
  )
}
