import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'
import { consoleFontVars } from '../fonts'

/** Dark console look: scopes shadcn tokens to dark and applies console fonts and ground. */
export function ConsoleScope({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'dark console-grid bg-console-bg text-console-ink font-console-sans min-h-screen pt-16',
        consoleFontVars,
        className,
      )}
    >
      {children}
    </div>
  )
}
