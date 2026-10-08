'use client'

import { Suspense, use } from 'react'

import { AppDetail } from '@/modules/apps/components/app-detail'
import { RequireLogin } from '@/modules/shared/components/renown/require-login'

type PageProps = { params: Promise<{ id: string }> }

export default function AppPage({ params }: PageProps) {
  const { id } = use(params)
  return (
    <RequireLogin>
      <main className="mx-auto mt-20 max-w-screen-xl px-4 py-8 sm:px-6">
        <Suspense fallback={null}>
          <AppDetail appId={id} />
        </Suspense>
      </main>
    </RequireLogin>
  )
}
