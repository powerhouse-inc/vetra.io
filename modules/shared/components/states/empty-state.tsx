import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/modules/shared/lib/utils'

export interface EmptyStateProps {
  title: string
  /** One line: what this list holds and how it gets its first entry. */
  description?: ReactNode
  icon?: LucideIcon
  /** Primary action, usually a small outline Button. */
  action?: ReactNode
  /** CLI equivalent of the action, rendered in mono, e.g. `ph publish`. */
  cliHint?: string
  className?: string
}

/** Dashed card shown in place of an empty list. */
export function EmptyState({
  title,
  description,
  icon: Icon,
  action,
  cliHint,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'text-muted-foreground bg-muted/30 flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center',
        className,
      )}
    >
      {Icon && (
        <div className="bg-background flex h-12 w-12 items-center justify-center rounded-full border">
          <Icon className="h-6 w-6" aria-hidden />
        </div>
      )}
      <div className="space-y-1">
        <p className="text-foreground text-sm font-medium">{title}</p>
        {description && <p className="text-xs">{description}</p>}
      </div>
      {action}
      {cliHint && (
        <code className="bg-background border-border rounded border px-2 py-1 font-mono text-xs">
          {cliHint}
        </code>
      )}
    </div>
  )
}
