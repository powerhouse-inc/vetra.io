import { Check } from 'lucide-react'

import { cn } from '@/shared/lib/utils'

export type StepDef = { id: string; label: string }

/** Horizontal step indicator; labels collapse to numbers on narrow screens. */
export function Stepper({ steps, current }: { steps: readonly StepDef[]; current: number }) {
  return (
    <nav aria-label="Progress">
      <ol className="flex items-center gap-2">
        {steps.map((step, i) => {
          const done = i < current
          const active = i === current
          return (
            <li key={step.id} className="flex flex-1 items-center gap-2 last:flex-none">
              <span
                aria-current={active ? 'step' : undefined}
                className="flex items-center gap-2 whitespace-nowrap"
              >
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors',
                    done && 'bg-primary border-primary text-primary-foreground',
                    active && 'border-primary text-primary ring-primary/20 ring-4',
                    !done && !active && 'text-muted-foreground',
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
                </span>
                <span
                  className={cn(
                    'sr-only text-sm font-medium sm:not-sr-only',
                    active ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {step.label}
                </span>
                <span className="sr-only">
                  {done ? ' (completed)' : active ? ' (current)' : ''}
                </span>
              </span>
              {i < steps.length - 1 && (
                <span
                  aria-hidden
                  className={cn('h-px flex-1 transition-colors', done ? 'bg-primary' : 'bg-border')}
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
