'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

interface LoginModalContextValue {
  open: boolean
  openLogin: () => void
  closeLogin: () => void
}

const LoginModalContext = createContext<LoginModalContextValue | null>(null)

// Login-modal open state, held in React (not the URL). Opened only by an explicit
// "Log in" action; the proxy gates logged-out routes to `/` without auto-opening.
export function LoginModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const openLogin = useCallback(() => setOpen(true), [])
  const closeLogin = useCallback(() => setOpen(false), [])

  const value = useMemo<LoginModalContextValue>(
    () => ({ open, openLogin, closeLogin }),
    [open, openLogin, closeLogin],
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
