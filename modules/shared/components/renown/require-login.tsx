'use client'

import { useRenownAuthAsync } from '@powerhousedao/reactor-browser'
import { LogIn } from 'lucide-react'
import type { ReactNode } from 'react'
import { PageSpinner } from '@/modules/shared/components/page-shell'
import { useOpenLogin } from '@/modules/shared/components/renown/login-modal-context'
import { Button } from '@/modules/shared/components/ui/button'

/**
 * Renown login only — no licence needed. The single gate for every /user and /profile
 * page: wrap the whole page (outermost), since its own states clear the fixed navbar.
 */
export function RequireLogin({
  children,
  title = 'Log in to continue',
  description = 'Vetra uses Renown to know it is you. It takes a few seconds.',
}: {
  children: ReactNode
  title?: string
  description?: string
}) {
  const { state } = useRenownAuthAsync()
  const openLogin = useOpenLogin()

  if (state === 'authenticated') return <>{children}</>
  if (state === 'resolving') return <PageSpinner label="Checking your login" />
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 pt-32 pb-16 text-center">
      <span className="bg-primary/10 text-primary flex h-12 w-12 items-center justify-center rounded-2xl">
        <LogIn className="h-5 w-5" aria-hidden />
      </span>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground text-sm">{description}</p>
      <Button size="lg" onClick={openLogin}>
        Log in with Renown
      </Button>
    </div>
  )
}
