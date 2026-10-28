'use client'
import { Suspense } from 'react'
import { useEnsureUserDrive } from '@/modules/profile/lib/use-ensure-user-drive'
import { PackagesTab } from '@/app/profile/components/packages-tab'
import { PageHeader } from '@/modules/shared/components/page-header'
import { PageSpinner } from '@/modules/shared/components/page-shell'
import { RequireLogin } from '@/modules/shared/components/renown/require-login'

function UserPackagesPageInner() {
  useEnsureUserDrive()

  return (
    <div className="container mx-auto max-w-5xl px-4 pt-20 pb-8">
      <PageHeader className="mb-8" title="Packages" description="Packages you’ve published." />
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
