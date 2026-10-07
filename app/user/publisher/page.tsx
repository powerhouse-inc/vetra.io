'use client'

import { EarlyAccessGate } from '@/modules/invites/early-access-gate'
import PublisherDashboard from '@/modules/publisher/components/publisher-dashboard'

export default function PublisherPage() {
  return (
    <EarlyAccessGate>
      <main className="mx-auto mt-20 max-w-screen-xl px-4 py-8 sm:px-6">
        <h1 className="mb-6 text-2xl font-semibold">Licensing</h1>
        <PublisherDashboard />
      </main>
    </EarlyAccessGate>
  )
}
