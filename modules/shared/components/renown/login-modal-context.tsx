'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

interface LoginModalContextValue {
  open: boolean
  /** Short line shown as the dialog title when it was opened for a gated page. */
  message: string | null
  openLogin: () => void
  /** Open the dialog with a reason, e.g. "Log in to continue" after a proxy bounce. */
  openLoginWithMessage: (message: string) => void
  closeLogin: () => void
}

const LoginModalContext = createContext<LoginModalContextValue | null>(null)

// Login-modal open state, held in React (not the URL). Opened by an explicit "Log in"
// action, or by AuthRedirect when the proxy bounced a visitor here with ?login=1.
export function LoginModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const openLogin = useCallback(() => {
    setMessage(null)
    setOpen(true)
  }, [])
  const openLoginWithMessage = useCallback((next: string) => {
    setMessage(next)
    setOpen(true)
  }, [])
  const closeLogin = useCallback(() => setOpen(false), [])

  const value = useMemo<LoginModalContextValue>(
    () => ({ open, message, openLogin, openLoginWithMessage, closeLogin }),
    [open, message, openLogin, openLoginWithMessage, closeLogin],
  )

  return <LoginModalContext.Provider value={value}>{children}</LoginModalContext.Provider>
}

export function useLoginModal(): LoginModalContextValue {
  const ctx = useContext(LoginModalContext)
  if (!ctx) throw new Error('useLoginModal must be used within LoginModalProvider')
  return ctx
}

/** Returns a function that opens the Renown sign-in modal. */
export function useOpenLogin(): () => void {
  return useLoginModal().openLogin
}
