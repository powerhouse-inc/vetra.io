import type { ReactNode } from 'react'
import { Label } from '@/modules/shared/components/ui/label'
import { cn } from '@/shared/lib/utils'

/** Label, control, then the error (or a hint); an optional character counter. */
export function ProfileField({
  id,
  label,
  hint,
  error,
  count,
  max,
  className,
  children,
}: {
  id: string
  label: string
  hint?: ReactNode
  error?: string
  count?: number
  max?: number
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        {count !== undefined && max !== undefined && (
          <span aria-hidden className={cn('text-xs tabular-nums', count > max ? 'text-destructive' : 'text-muted-foreground')}>
            {count}/{max}
          </span>
        )}
      </div>
      {children}
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-muted-foreground text-xs">{hint}</p>
      ) : null}
    </div>
  )
}
