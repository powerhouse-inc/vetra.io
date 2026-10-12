'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { isConsoleRoute } from '@/modules/landing/lib/routes'

/** Puts the footer on the dark console ground under the public landing pages. */
export function FooterScope({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  return (
    <div
      className={
        isConsoleRoute(pathname)
          ? 'dark [&_footer]:border-console-line [&_footer]:bg-console-bg'
          : undefined
      }
    >
      {children}
    </div>
  )
}
