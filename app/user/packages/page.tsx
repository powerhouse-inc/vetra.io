'use client'
import { useRenownAuth } from '@powerhousedao/reactor-browser'
import { Loader2 } from 'lucide-react'
import { Suspense } from 'react'
import { useEnsureUserDrive } from '@/modules/profile/lib/use-ensure-user-drive'
import { LoginPrompt } from '@/app/profile/components/login-prompt'
import { PackagesTab } from '@/app/profile/components/packages-tab'

function UserPackagesPageInner() {
  const auth = useRenownAuth()
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
