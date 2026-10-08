'use client'

import { RefreshCw, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/modules/shared/components/ui/button'
import { Skeleton } from '@/modules/shared/components/ui/skeleton'
import { describePublisherError } from '../graphql'

/** Title + one-line explanation + primary action, shared by every licensing tab. */
export function TabHeader({
  title,
  description,
  action,
}: {
  title: string
  description: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <p className="text-muted-foreground max-w-2xl text-sm">{description}</p>
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
    </div>
  )
}

export function TabSkeleton({ rows = 3, label }: { rows?: number; label: string }) {
  return (
    <div className="space-y-3" role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="bg-card border-border flex items-center gap-4 rounded-xl border p-4">
          <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <Skeleton className="hidden h-8 w-20 sm:block" />
        </div>
      ))}
    </div>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon
  title: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="border-border flex flex-col items-center gap-4 rounded-xl border border-dashed px-6 py-14 text-center">
      <span className="bg-primary/10 text-primary flex h-12 w-12 items-center justify-center rounded-2xl">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="space-y-1.5">
        <p className="font-semibold">{title}</p>
        <p className="text-muted-foreground mx-auto max-w-md text-sm">{children}</p>
      </div>
      {action}
    </div>
  )
}

export function TabError({
  error,
  onRetry,
  retrying = false,
}: {
  error: unknown
  onRetry: () => void
  retrying?: boolean
}) {
  return (
    <div
      role="alert"
      className="border-destructive/30 bg-destructive/5 flex flex-col items-center gap-3 rounded-xl border px-6 py-10 text-center"
    >
      <p className="text-sm font-semibold">This did not load</p>
      <p className="text-muted-foreground max-w-md text-sm">{describePublisherError(error)}</p>
      <Button size="sm" variant="outline" onClick={onRetry} disabled={retrying}>
        <RefreshCw className={retrying ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
        Try again
      </Button>
    </div>
  )
}

export function SectionCard({
  title,
  description,
  action,
  children,
}: {
  title: string
  description?: ReactNode
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="bg-card border-border space-y-4 rounded-xl border p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-0.5">
          <h3 className="font-semibold">{title}</h3>
          {description && <p className="text-muted-foreground text-sm">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}
