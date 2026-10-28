import type { ReactNode } from 'react'

import { cn } from '@/modules/shared/lib/utils'

type PageHeaderProps = {
  /** The page's one h1, in sentence case ("Your environments", not "Your Environments"). */
  title: ReactNode
  /** Short mono path above the title, like the landing pages' prompt line (e.g. "~/apps"). */
  eyebrow?: string
  description?: ReactNode
  /** Buttons on the right (stacked below the title on phones). */
  actions?: ReactNode
  className?: string
}

/** Title block shared by the /user pages: console typography, same size and weight everywhere. */
export function PageHeader({ title, eyebrow, description, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}
    >
      <div className="min-w-0 space-y-2">
        {eyebrow && <p className="text-primary font-mono text-sm">{eyebrow}</p>}
        <h1 className="text-3xl font-bold tracking-[-0.03em] sm:text-4xl">{title}</h1>
        {description && <p className="text-muted-foreground max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
