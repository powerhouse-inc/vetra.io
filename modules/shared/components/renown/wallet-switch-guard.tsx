'use client'

import { useRenownAuthAsync } from '@powerhousedao/reactor-browser'
import { Wallet } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/modules/shared/components/ui/alert-dialog'
import {
  commitPendingLoginMethod,
  dismissalKey,
  readLoginMethod,
  rememberLoginMethod,
  setPendingLoginMethod,
  shortAddress,
  walletSwitchTarget,
  type SessionLoginMethod,
} from '@/modules/shared/lib/wallet-switch'

/** The slice of an EIP-1193 provider used here. */
interface InjectedProvider {
  request(args: { method: 'eth_accounts' }): Promise<unknown>
  on?(event: 'accountsChanged', listener: (accounts: unknown) => void): void
  removeListener?(event: 'accountsChanged', listener: (accounts: unknown) => void): void
}

function injectedProvider(): InjectedProvider | undefined {
  const eth = (window as unknown as { ethereum?: Partial<InjectedProvider> }).ethereum
  return typeof eth?.request === 'function' ? (eth as InjectedProvider) : undefined
}

function asAccounts(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((a): a is string => typeof a === 'string') : []
}

/**
 * Asks before continuing when the injected wallet (MetaMask & co.) moves to
 * another account than the one signed in to Renown. Listens for
 * `accountsChanged` and re-reads `eth_accounts` on mount and on window focus
 * (a switch made while the tab was hidden). Never signs out on its own.
 */
export function WalletSwitchGuard() {
  const auth = useRenownAuthAsync()
  const signedIn = auth.state === 'authenticated'
  // What the wallet last reported, with the sign-in method as recorded at that moment.
  const [wallet, setWallet] = useState<{
    accounts: string[]
    loginMethod: SessionLoginMethod | undefined
  }>({ accounts: [], loginMethod: undefined })
  const [dismissed, setDismissed] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // The login method is stored on a successful sign-in and forgotten on sign-out,
  // so a later session of unknown origin gets the cautious rule.
  useEffect(() => {
    if (auth.state === 'authenticated') commitPendingLoginMethod()
    else if (auth.state === 'unauthenticated') rememberLoginMethod(undefined)
  }, [auth.state])

  useEffect(() => {
    if (!signedIn) return
    const eth = injectedProvider()
    if (!eth) return

    let live = true
    const update = (value: unknown) => {
      if (live) setWallet({ accounts: asAccounts(value), loginMethod: readLoginMethod() })
    }
    const read = () => {
      eth.request({ method: 'eth_accounts' }).then(update, () => {})
    }
    read()
    eth.on?.('accountsChanged', update)
    window.addEventListener('focus', read)
    return () => {
      live = false
      eth.removeListener?.('accountsChanged', update)
      window.removeEventListener('focus', read)
      setWallet({ accounts: [], loginMethod: undefined })
      // A "stay" belongs to the session that chose it.
      setDismissed(null)
    }
  }, [signedIn])

  const target = signedIn
    ? walletSwitchTarget({ sessionAddress: auth.address, ...wallet, dismissed })
    : null

  if (!target || !auth.address) return null
  const sessionAddress = auth.address
  const stay = () => setDismissed(dismissalKey(sessionAddress, target))

  const switchAccount = async () => {
    setBusy(true)
    try {
      await auth.logout()
      setPendingLoginMethod('wallet')
      auth.login(undefined, 'wallet')
    } catch {
      // Still signed in as before: leave the choice open (no account details logged).
      console.warn('Wallet switch: signing out failed; still signed in as before.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AlertDialog open onOpenChange={(open) => !open && stay()}>
      <AlertDialogContent>
        <AlertDialogHeader icon={<Wallet />}>
          <AlertDialogTitle>Wallet account changed</AlertDialogTitle>
          <AlertDialogDescription>
            You switched to <span className="font-mono">{shortAddress(target)}</span> in your
            wallet. You are still signed in to Vetra as{' '}
            <span className="font-mono">{shortAddress(auth.address)}</span>.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy} onClick={stay}>
            Stay as {shortAddress(auth.address)}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={(event) => {
              // Keep the dialog until the sign-out finished; it unmounts with the session.
              event.preventDefault()
              void switchAccount()
            }}
          >
            Sign in as {shortAddress(target)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
