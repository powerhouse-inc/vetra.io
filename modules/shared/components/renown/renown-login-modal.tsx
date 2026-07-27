'use client'

import { useRenownAuth, useRenownLoginMethods } from '@powerhousedao/reactor-browser/renown'
import { LoginMethod } from '@renown/sdk/wallet'
import { Loader2, Wallet } from 'lucide-react'
import { useState } from 'react'
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
  const { open, closeLogin } = useLoginModal()
  const { login, pending, status, error } = useRenownAuth()
  const methods = useRenownLoginMethods(walletAdapters())

  const busy = pending || status === 'loading' || status === 'checking'

  const wallet = methods.find((m) => m.id === LoginMethod.WALLET)
  const others = methods.filter((m) => m.id !== LoginMethod.WALLET)

  // Which button started the in-flight login, so the spinner lands on it rather
  // than on a fixed one. `null` is the no-methods "Continue with Renown" button.
  const [active, setActive] = useState<LoginMethod | null>()

  // Trigger the method's adapter; its own modal (Privy, RainbowKit) opens on top.
  const startLogin = (method?: LoginMethod) => {
    setActive(method ?? null)
    login(undefined, method)
  }

  // Gated on `busy`, so a stale `active` from a cancelled login stays invisible.
  const spinnerFor = (method: LoginMethod | null) =>
    busy && active === method ? <Loader2 className="h-4 w-4 animate-spin" /> : null

  return (
    // Non-modal so the adapter's own modal opens on top and holds focus while this
    // picker stays put; AuthRedirect closes it on success.
    <Dialog open={open} onOpenChange={(next) => !next && closeLogin()} modal={false}>
      <DialogContent
        className="sm:max-w-sm"
        // While a login is in flight, outside clicks land on the adapter modal —
        // keep this picker open so a cancel returns here instead of vanishing.
        onInteractOutside={(e) => {
          if (busy) e.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle>Sign in to Vetra</DialogTitle>
          <DialogDescription>Authenticate with Renown to continue.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 pt-2">
          {methods.length === 0 ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => startLogin()}
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
            >
              {spinnerFor(null)}
              Continue with Renown
            </button>
          ) : null}

          {wallet ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => startLogin(wallet.id)}
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
            >
              {spinnerFor(wallet.id) ?? <Wallet className="h-4 w-4" />}
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
              onClick={() => startLogin(method.id)}
              className="bg-accent text-foreground hover:bg-muted inline-flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
            >
              {spinnerFor(method.id)}
              {method.label}
            </button>
          ))}

          {error ? <p className="text-destructive text-center text-xs">{error.message}</p> : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
