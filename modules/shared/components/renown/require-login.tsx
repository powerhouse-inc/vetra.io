'use client'

import { useRenownAuthAsync } from '@powerhousedao/reactor-browser'
import { LogIn } from 'lucide-react'
import type { ReactNode } from 'react'
import { useOpenLogin } from '@/modules/shared/components/renown/login-modal-context'
import { Button } from '@/modules/shared/components/ui/button'
import { Skeleton } from '@/modules/shared/components/ui/skeleton'

/** Renown login only — no licence needed. Used by owner pages and the app page. */
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
  if (state === 'resolving') {
    return (
      <div role="status" aria-label="Checking your login" className="space-y-4 py-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    )
  }
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
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
