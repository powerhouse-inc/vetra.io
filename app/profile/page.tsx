'use client'
import { useRenownAuthAsync } from '@powerhousedao/reactor-browser'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { useEnsureUserDrive } from '@/modules/profile/lib/use-ensure-user-drive'
import { PageShell, PageSpinner } from '@/modules/shared/components/page-shell'
import { RequireLogin } from '@/modules/shared/components/renown/require-login'
import { Button } from '@/modules/shared/components/ui/button'
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

  // RequireLogin gates the page; the address can trail the auth state by a render.
  if (!auth.address) return <PageSpinner />

  return (
    <PageShell className="max-w-5xl">
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
    </PageShell>
  )
}

export default function ProfilePage() {
  // Suspense boundary for useSearchParams (Next.js 15+ requirement).
  return (
    <RequireLogin title="Log in to see your profile">
      <Suspense fallback={<PageSpinner />}>
        <ProfilePageInner />
      </Suspense>
    </RequireLogin>
  )
}
