'use client'

import { useRenownAuth, useRenownSessionSynced } from '@powerhousedao/reactor-browser/renown'
import { useRenownLoginMethods } from '@powerhousedao/reactor-browser/renown'
import { LoginMethod } from '@renown/sdk/wallet'
import { Loader2, Wallet } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { useLoginModal } from '@/modules/shared/components/renown/login-modal-context'
import { walletAdapters } from '@/modules/shared/config/renown'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/modules/shared/components/ui/dialog'

// Open state lives in LoginModalProvider (React, not the URL). `from` carries the
// page a proxy redirect came from, used for the post-login navigation.
export function RenownLoginModal() {
  const { open, from, closeLogin } = useLoginModal()
  const router = useRouter()
  const { user, login, pending, status, error } = useRenownAuth()
  const sessionSynced = useRenownSessionSynced()
  const methods = useRenownLoginMethods(walletAdapters())

  const busy = pending || status === 'loading' || status === 'checking'

  // Signed in + cookie written: close and navigate once to the target (gated
  // `from`, else dashboard). Ref guard keeps it to a single navigation.
  const redirected = useRef(false)
  useEffect(() => {
    if (!open) {
      redirected.current = false
      return
    }
    if (!user || !sessionSynced || redirected.current) return
    redirected.current = true
    closeLogin()
    router.replace(from ?? '/user')
  }, [open, user, sessionSynced, from, router, closeLogin])

  const wallet = methods.find((m) => m.id === LoginMethod.WALLET)
  const others = methods.filter((m) => m.id !== LoginMethod.WALLET)

  return (
    <Dialog open={open} onOpenChange={(next) => !next && closeLogin()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Sign in to Vetra</DialogTitle>
          <DialogDescription>Authenticate with Renown to continue.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 pt-2">
          {methods.length === 0 ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => login()}
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Continue with Renown
            </button>
          ) : null}

          {wallet ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => login(undefined, wallet.id)}
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
              {wallet.label}
            </button>
          ) : null}

          {wallet && others.length > 0 ? (
            <div className="text-muted-foreground my-1 flex items-center gap-3 text-xs tracking-wider uppercase">
              <div className="bg-border h-px flex-1" />
              or
              <div className="bg-border h-px flex-1" />
            </div>
          ) : null}

          {others.map((method) => (
            <button
              key={method.id}
              type="button"
              disabled={busy}
              onClick={() => login(undefined, method.id)}
              className="bg-accent text-foreground hover:bg-muted inline-flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
            >
              {method.label}
            </button>
          ))}

          {error ? <p className="text-destructive text-center text-xs">{error.message}</p> : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
