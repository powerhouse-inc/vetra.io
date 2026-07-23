'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

interface LoginModalContextValue {
  open: boolean
  /** Post-login destination captured from a proxy redirect (?from=), else null. */
  from: string | null
  openLogin: () => void
  closeLogin: () => void
  /** Clear the captured `from` once it's been navigated to. */
  clearFrom: () => void
}

const LoginModalContext = createContext<LoginModalContextValue | null>(null)

// Only accept a same-origin relative path as post-login destination; drop absolute
// URLs, protocol-relative `//host`, and backslash tricks so `?from=` can't open-redirect.
function safeInternalPath(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return null
  }
  return value
}

// Holds the login-modal open state in React (not the URL). The server-side proxy
// still signals an inbound open via ?signin=1&from=<path>, consumed once below.
export function LoginModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  // Fires once per appearance of ?signin; re-arms when the param clears, so a
  // later (client-nav) proxy redirect is caught too.
  const consumed = useRef(false)

  useEffect(() => {
    if (searchParams.get('signin') !== '1') {
      consumed.current = false
      return
    }
    if (consumed.current) return
    consumed.current = true
    setFrom(safeInternalPath(searchParams.get('from')))
    setOpen(true)
    const params = new URLSearchParams(searchParams.toString())
    params.delete('signin')
    params.delete('from')
    const qs = params.toString()
    router.replace(pathname + (qs ? `?${qs}` : ''), { scroll: false })
  }, [searchParams, pathname, router])

  const openLogin = useCallback(() => {
    setFrom(null)
    setOpen(true)
  }, [])
  const closeLogin = useCallback(() => setOpen(false), [])
  const clearFrom = useCallback(() => setFrom(null), [])

  const value = useMemo<LoginModalContextValue>(
    () => ({ open, from, openLogin, closeLogin, clearFrom }),
    [open, from, openLogin, closeLogin, clearFrom],
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
