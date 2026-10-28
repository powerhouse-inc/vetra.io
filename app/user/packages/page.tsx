'use client'
import { Suspense } from 'react'
import { useEnsureUserDrive } from '@/modules/profile/lib/use-ensure-user-drive'
import { PackagesTab } from '@/app/profile/components/packages-tab'
import { PageSpinner } from '@/modules/shared/components/page-shell'
import { RequireLogin } from '@/modules/shared/components/renown/require-login'

function UserPackagesPageInner() {
  useEnsureUserDrive()

  return (
    <div className="container mx-auto max-w-5xl px-4 pt-20 pb-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Packages</h1>
        <p className="text-muted-foreground mt-1 text-sm">Packages you&apos;ve published.</p>
      </div>
      <PackagesTab />
    </div>
  )
}

export default function UserPackagesPage() {
  return (
    <RequireLogin title="Log in to see your packages">
      <Suspense fallback={<PageSpinner />}>
        <UserPackagesPageInner />
      </Suspense>
    </RequireLogin>
  )
}
