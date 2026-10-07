'use client'

import { Suspense, use } from 'react'

import { AppDetail } from '@/modules/apps/components/app-detail'
import { EarlyAccessGate } from '@/modules/invites/early-access-gate'

type PageProps = { params: Promise<{ id: string }> }

export default function AppPage({ params }: PageProps) {
  const { id } = use(params)
  return (
    <EarlyAccessGate>
      <main className="mx-auto mt-20 max-w-screen-xl px-4 py-8 sm:px-6">
        <Suspense fallback={null}>
          <AppDetail appId={id} />
        </Suspense>
      </main>
    </EarlyAccessGate>
  )
}
