import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

/** A shell prompt (`~/vetra $ …`) with a blinking caret. */
export function PromptLine({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('font-console-mono text-console-signal text-sm', className)}>
      <span className="text-console-faint">~/vetra $ </span>
      {children} <span className="console-caret" aria-hidden />
    </p>
  )
}
