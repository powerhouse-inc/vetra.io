import type { ReactNode } from 'react'

import { TONE_BADGE, TONE_DOT, type StatusMeta } from '@/modules/shared/lib/status'
import { cn } from '@/modules/shared/lib/utils'

/** Small status dot; in-flight states get a soft ping ring. */
export function StatusDot({ meta, className }: { meta: StatusMeta; className?: string }) {
  return (
    <span className={cn('relative inline-flex h-2 w-2 shrink-0', className)} aria-hidden>
      {meta.active && (
        <span
          className={cn(
            'absolute inline-flex h-full w-full animate-ping rounded-full opacity-60',
            TONE_DOT[meta.tone],
          )}
        />
      )}
      <span className={cn('relative inline-flex h-2 w-2 rounded-full', TONE_DOT[meta.tone])} />
    </span>
  )
}

type PillProps = {
  meta: StatusMeta
  className?: string
  /** Tooltip, usually the reason behind the status. */
  title?: string
  /** Replaces the dot (e.g. a moon for a sleeping studio). */
  icon?: ReactNode
}

/** Rounded status pill: dot + label, tone-tinted background. */
export function StatusPill({ meta, className, title, icon }: PillProps) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        TONE_BADGE[meta.tone],
        className,
      )}
    >
      {icon ?? <StatusDot meta={meta} />}
      {meta.label}
    </span>
  )
}

/** Inline dot + label for dense rows (tables, lists, cards). */
export function StatusInline({ meta, className }: { meta: StatusMeta; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-sm whitespace-nowrap', className)}>
      <StatusDot meta={meta} />
      {meta.label}
    </span>
  )
}

/** Placeholder the size of a pill, while the status is still loading. */
export function StatusPillSkeleton() {
  return <span className="bg-muted inline-flex h-5 w-16 animate-pulse rounded-full" aria-hidden />
}
