import type { ReactNode } from 'react'

import { cn } from '@/modules/shared/lib/utils'

type PageHeaderProps = {
  /** The page's one h1, in sentence case ("Your environments", not "Your Environments"). */
  title: ReactNode
  description?: ReactNode
  /** Buttons on the right (stacked below the title on phones). */
  actions?: ReactNode
  className?: string
}

/** Title block shared by the /user pages, so every page heading has the same size and weight. */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}
    >
      <div className="min-w-0 space-y-1.5">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
