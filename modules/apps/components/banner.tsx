import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function Banner({
  tone,
  icon: Icon,
  title,
  children,
  actions,
}: {
  tone: 'warning' | 'danger' | 'neutral'
  icon: LucideIcon
  title: string
  children: ReactNode
  actions?: ReactNode
}) {
  return (
    <div
      role="status"
      className={
        tone === 'warning'
          ? 'border-warning/40 bg-warning/10 flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center'
          : tone === 'danger'
            ? 'border-destructive/40 bg-destructive/10 flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center'
            : 'border-border bg-muted/50 flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center'
      }
    >
      <Icon
        className={
          tone === 'warning'
            ? 'text-warning h-5 w-5 shrink-0'
            : tone === 'danger'
              ? 'text-destructive h-5 w-5 shrink-0'
              : 'text-muted-foreground h-5 w-5 shrink-0'
        }
        aria-hidden
      />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-muted-foreground text-sm">{children}</p>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
