'use client'

import { Suspense, use } from 'react'

import { AppDetail } from '@/modules/apps/components/app-detail'
import { DetailPageSkeleton } from '@/modules/shared/components/page-shell'
import { RequireLogin } from '@/modules/shared/components/renown/require-login'

type PageProps = { params: Promise<{ id: string }> }

export default function AppPage({ params }: PageProps) {
  const { id } = use(params)
  return (
    <RequireLogin>
      <main className="mx-auto mt-20 max-w-screen-xl px-6 py-8">
        <Suspense fallback={<DetailPageSkeleton label="Loading app" />}>
          <AppDetail appId={id} />
        </Suspense>
      </main>
    </RequireLogin>
  )
}
