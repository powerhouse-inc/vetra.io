// Decides when to ask a signed-in user about a wallet account switch. Renown's
// session address is the credential issuer's; nothing in the SDK follows the
// wallet after login, so the page has to notice and ask.

/** How the current session was started (the login modal's buttons). */
export type SessionLoginMethod = 'wallet' | 'google' | 'email' | 'apple'

const LOGIN_METHOD_KEY = 'vetra:renown-login-method'
const METHODS: readonly string[] = ['wallet', 'google', 'email', 'apple']

export function sameAddress(a: string | null | undefined, b: string | null | undefined): boolean {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase()
}

export function shortAddress(address: string): string {
  return address.length < 12 ? address : `${address.slice(0, 6)}…${address.slice(-4)}`
}

/**
 * The account to offer switching to, or null to stay quiet.
 *
 * - only for wallet sessions: Privy email/Google/Apple sessions sign with an embedded
 *   wallet, so an unrelated browser extension says nothing about them;
 * - a session of unknown origin (signed in before this was recorded) counts as
 *   the extension's only when the extension also holds the session account;
 * - "stay" (`dismissed`, a {@link dismissalKey}) holds for that signed-in account
 *   until the wallet moves to yet another account.
 */
export function walletSwitchTarget({
  sessionAddress,
  loginMethod,
  accounts,
  dismissed,
}: {
  sessionAddress: string | undefined
  loginMethod: SessionLoginMethod | undefined
  /** eth_accounts / accountsChanged: the active account first. */
  accounts: readonly string[]
  /** {@link dismissalKey} of the pair the user chose to stay on. */
  dismissed: string | null
}): string | null {
  const active = accounts[0]
  if (!sessionAddress || !active) return null
  if (loginMethod && loginMethod !== 'wallet') return null
  if (sameAddress(active, sessionAddress)) return null
  if (!loginMethod && !accounts.some((a) => sameAddress(a, sessionAddress))) return null
  if (dismissed === dismissalKey(sessionAddress, active)) return null
  return active
}

/** Identifies a "stay" choice: this signed-in account, this wallet account. */
export function dismissalKey(sessionAddress: string, target: string): string {
  return `${sessionAddress.toLowerCase()}|${target.toLowerCase()}`
}

// The method of the sign-in in flight; stored only once it succeeds.
let pendingLoginMethod: string | undefined

/** Notes the method a sign-in was started with (login modal, wallet switch). */
export function setPendingLoginMethod(method: string | undefined): void {
  pendingLoginMethod = method
}

/** On a successful sign-in: stores the pending method, if any. */
export function commitPendingLoginMethod(): void {
  if (pendingLoginMethod === undefined) return
  rememberLoginMethod(pendingLoginMethod)
  pendingLoginMethod = undefined
}

/** Stores the session's login method (undefined clears it: unknown is the safe default). */
export function rememberLoginMethod(method: string | undefined): void {
  try {
    if (method && METHODS.includes(method)) localStorage.setItem(LOGIN_METHOD_KEY, method)
    else localStorage.removeItem(LOGIN_METHOD_KEY)
  } catch {
    // Storage blocked: the guard falls back to the unknown-method rule.
  }
}

export function readLoginMethod(): SessionLoginMethod | undefined {
  try {
    const value = localStorage.getItem(LOGIN_METHOD_KEY)
    return value && METHODS.includes(value) ? (value as SessionLoginMethod) : undefined
  } catch {
    return undefined
  }
}
