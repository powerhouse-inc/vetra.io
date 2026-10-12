'use client'

import { usePathname } from 'next/navigation'
import { isConsoleRoute } from '@/modules/landing/lib/routes'

/**
 * Dropdown panels render in a portal outside the navbar's `dark` wrapper, so on
 * the dark console pages each panel opts into the dark tokens itself.
 */
export function consoleMenuClass(pathname: string): string | undefined {
  return isConsoleRoute(pathname) ? 'dark' : undefined
}

export function useConsoleMenuClass(): string | undefined {
  return consoleMenuClass(usePathname())
}
