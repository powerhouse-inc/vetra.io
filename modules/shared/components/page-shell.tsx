import { Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Skeleton } from '@/modules/shared/components/ui/skeleton'
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

/**
 * Skeleton for a detail page body (title + status, tab bar, two content cards), so a
 * detail page holds its layout while it loads instead of flashing blank or a lone spinner.
 */
export function DetailPageSkeleton({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-11 w-11 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-1/3" />
          <Skeleton className="h-4 w-1/4" />
        </div>
        <Skeleton className="hidden h-9 w-28 sm:block" />
      </div>
      <div className="flex gap-4 border-b pb-2">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-20" />
      </div>
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  )
}
