import { Check } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

const STEPS = ['Check code', 'Log in', 'Set up'] as const

/** 1-based current step. */
export function RedeemSteps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="flex items-center gap-2 text-xs sm:gap-3" aria-label="Progress">
      {STEPS.map((label, i) => {
        const n = i + 1
        const done = n < current
        return (
          <li
            key={label}
            className="flex items-center gap-2"
            aria-current={n === current ? 'step' : undefined}
          >
            <span
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold',
                done && 'bg-primary border-primary text-primary-foreground',
                n === current && 'border-primary text-primary',
                n > current && 'border-border text-muted-foreground',
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : n}
            </span>
            <span
              className={cn(
                'hidden sm:inline',
                n === current ? 'text-foreground font-medium' : 'text-muted-foreground',
              )}
            >
              {label}
            </span>
            {n < STEPS.length && <span className="bg-border h-px w-6 sm:w-10" aria-hidden />}
          </li>
        )
      })}
    </ol>
  )
}
