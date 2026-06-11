'use client'
import { useRenownAuth } from '@powerhousedao/reactor-browser'
import { Loader2, Plus } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { useEnsureUserDrive } from '@/modules/profile/lib/use-ensure-user-drive'
import { Button } from '@/modules/shared/components/ui/button'
import { LoginPrompt } from '@/app/profile/components/login-prompt'
import { ProfileTabs } from '@/app/profile/components/profile-tabs'

function UserPackagesPageInner() {
  const auth = useRenownAuth()
  const params = useSearchParams()
  const showCreateButton = (params.get('tab') ?? 'packages') === 'teams'
  useEnsureUserDrive()

  if (auth.status === 'loading' || auth.status === 'checking') {
    return (
      <div className="container mx-auto flex min-h-[60vh] items-center justify-center px-4 py-8">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    )
  }

  if (auth.status !== 'authorized' || !auth.address) {
    return (
      <div className="container mx-auto px-4 py-8">
        <LoginPrompt onLogin={auth.login} />
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My profile</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Packages you&apos;ve published, teams you&apos;re a member of, and account settings.
          </p>
        </div>
        {showCreateButton && (
          <Button asChild>
            <Link href="/profile/create-team">
              <Plus className="mr-1.5 size-4" />
              Create team
            </Link>
          </Button>
        )}
      </div>
      <ProfileTabs address={auth.address} basePath="/user/packages" />
    </div>
  )
}

export default function UserPackagesPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto flex min-h-[60vh] items-center justify-center px-4 py-8">
          <Loader2 className="text-muted-foreground size-6 animate-spin" />
        </div>
      }
    >
      <UserPackagesPageInner />
    </Suspense>
  )
}
