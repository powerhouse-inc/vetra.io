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
    <div className="mx-auto max-w-screen-xl px-6 pt-20 pb-16">
      <PageHeader
        eyebrow="~/packages"
        className="mb-8"
        title="Packages"
        description="Packages you’ve published."
      />
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
