import { cn } from '@/shared/lib/utils'

import { TONE_BADGE, TONE_DOT, type StatusMeta } from '../lib/status'

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

/** Rounded status pill: dot + label, tone-tinted background. */
export function StatusPill({ meta, className }: { meta: StatusMeta; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        TONE_BADGE[meta.tone],
        className,
      )}
    >
      <StatusDot meta={meta} />
      {meta.label}
    </span>
  )
}

/** Inline dot + label for dense rows (tables, lists). */
export function StatusInline({ meta, className }: { meta: StatusMeta; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-sm whitespace-nowrap', className)}>
      <StatusDot meta={meta} />
      {meta.label}
    </span>
  )
}
