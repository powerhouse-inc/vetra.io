'use client'

import { Server, Users } from 'lucide-react'
import { RadioGroup, RadioGroupItem } from '@/modules/shared/components/ui/radio-group'
import { cn } from '@/shared/lib/utils'
import type { TemplateMode } from '../../types'

const OPTIONS = [
  {
    value: 'SHARED' as const,
    icon: Users,
    title: 'Shared',
    body: 'Everyone gets an account on one environment you run. Good for free tiers and communities.',
  },
  {
    value: 'DEDICATED' as const,
    icon: Server,
    title: 'Dedicated',
    body: 'Every licence gets its own environment, built from the services and packages you pick.',
  },
]

export function ModeChoice({
  value,
  onChange,
  sharedDisabledReason,
}: {
  value: TemplateMode
  onChange: (mode: TemplateMode) => void
  sharedDisabledReason?: string | null
}) {
  return (
    <div className="space-y-2">
      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(v as TemplateMode)}
        className="grid gap-3 sm:grid-cols-2"
        aria-label="Template type"
      >
        {OPTIONS.map((o) => {
          const disabled = o.value === 'SHARED' && !!sharedDisabledReason && value !== 'SHARED'
          return (
            <label
              key={o.value}
              className={cn(
                'border-border flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors',
                value === o.value && 'border-primary bg-primary/5 ring-primary/30 ring-1',
                disabled && 'cursor-not-allowed opacity-60',
              )}
            >
              <RadioGroupItem
                value={o.value}
                disabled={disabled}
                aria-label={o.title}
                className="border-muted-foreground/50 data-[state=checked]:border-primary mt-1"
              />
              <span className="space-y-1">
                <span className="flex items-center gap-2 font-medium">
                  <o.icon className="h-4 w-4" aria-hidden />
                  {o.title}
                </span>
                <span className="text-muted-foreground block text-sm">{o.body}</span>
              </span>
            </label>
          )
        })}
      </RadioGroup>
      {sharedDisabledReason && value !== 'SHARED' && (
        <p className="text-muted-foreground text-xs">{sharedDisabledReason}</p>
      )}
    </div>
  )
}
