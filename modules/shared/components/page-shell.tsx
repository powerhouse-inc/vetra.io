import { Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/modules/shared/lib/utils'

/**
 * Page container that clears the fixed 64px navbar (pt-20 = 80px, same offset the
 * /user pages use). Pass a max width via `className`, e.g. `max-w-5xl`.
 */
export function PageShell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('container mx-auto px-4 pt-20 pb-8', className)}>{children}</div>
}

/** Centred page-level spinner, offset below the navbar. Never leave a page blank while loading. */
export function PageSpinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="flex min-h-[60vh] items-center justify-center pt-16"
    >
      <Loader2 className="text-muted-foreground size-6 animate-spin" aria-hidden />
    </div>
  )
}
