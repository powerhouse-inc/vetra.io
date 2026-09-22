'use client'

import type { ReactNode } from 'react'
import { useOpenLogin } from '@/modules/shared/components/renown/login-modal-context'
import { Button } from '@/modules/shared/components/ui/button'
import { useCanSign } from '../hooks/use-can-sign'

/**
 * Wraps mutation UI. Renders children when the user has a Renown signer.
 * Otherwise shows a login CTA (or the provided `fallback`). Renders nothing
 * while auth is still resolving so the UI doesn't flash.
 */
export function RequireSigner({
  children,
  fallback,
}: {
  children: ReactNode
  fallback?: ReactNode
}) {
  const { canSign, loading } = useCanSign()
  const openLogin = useOpenLogin()

  if (loading) return null
  if (canSign) return <>{children}</>
  if (fallback) return <>{fallback}</>

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-6 text-center">
      <p className="text-muted-foreground text-sm">Log in with Renown to continue.</p>
      <Button onClick={openLogin}>Log in with Renown</Button>
    </div>
  )
}
