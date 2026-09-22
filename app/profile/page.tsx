'use client'
import { useRenownAuthAsync } from '@powerhousedao/reactor-browser'
import { Loader2, Plus } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { useEnsureUserDrive } from '@/modules/profile/lib/use-ensure-user-drive'
import { Button } from '@/modules/shared/components/ui/button'
import { LoginPrompt } from './components/login-prompt'
import { ProfileTabs } from './components/profile-tabs'

function ProfilePageInner() {
  const auth = useRenownAuthAsync()
  const params = useSearchParams()
  const showCreateButton = (params.get('tab') ?? 'packages') === 'teams'
  // Best-effort: lazily create the caller's `user:<eth>` drive + seed a
  // BuilderAccount doc on first authenticated render. The page doesn't
  // wait on this — bootstrap runs in the background while /profile
  // renders immediately.
  useEnsureUserDrive()

  if (auth.state === 'resolving') {
    return (
      <div className="container mx-auto flex min-h-[60vh] items-center justify-center px-4 py-8">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    )
  }

  if (auth.state !== 'authenticated' || !auth.address) {
    return (
      <div className="container mx-auto px-4 py-8">
        <LoginPrompt />
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My profile</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Teams you&apos;re a member of, packages you&apos;ve published, and account settings.
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
      <ProfileTabs address={auth.address} />
    </div>
  )
}

export default function ProfilePage() {
  // Suspense boundary for useSearchParams (Next.js 15+ requirement).
  return (
    <Suspense
      fallback={
        <div className="container mx-auto flex min-h-[60vh] items-center justify-center px-4 py-8">
          <Loader2 className="text-muted-foreground size-6 animate-spin" />
        </div>
      }
    >
      <ProfilePageInner />
    </Suspense>
  )
}
