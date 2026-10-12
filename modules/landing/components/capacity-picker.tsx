'use client'

import { useState } from 'react'
import { cn } from '@/shared/lib/utils'
import { CAPACITY_TIERS, UNIT } from '../lib/pricing'

export function CapacityPicker({ defaultIndex = 1 }: { defaultIndex?: number }) {
  const [index, setIndex] = useState(defaultIndex)
  const tier = CAPACITY_TIERS[index]

  return (
    <div className="border-console-line-strong bg-console-surface flex flex-col gap-6 rounded-2xl border p-6 sm:p-7">
      <p className="font-console-mono text-console-faint text-xs">capacity</p>
      <div
        role="group"
        aria-label="Choose capacity"
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      >
        {CAPACITY_TIERS.map((t, i) => (
          <button
            key={t.units}
            type="button"
            aria-pressed={i === index}
            onClick={() => setIndex(i)}
            className={cn(
              'font-console-mono min-h-12 rounded-lg border text-sm transition-colors',
              i === index
                ? 'border-console-signal bg-console-signal/10 text-console-signal'
                : 'border-console-line-strong text-console-ink hover:bg-console-raised',
            )}
          >
            {t.vcpu} vCPU
          </button>
        ))}
      </div>
      <dl className="bg-console-line border-console-line grid grid-cols-3 gap-px overflow-hidden rounded-xl border">
        {[
          ['CPU', `${tier.vcpu} vCPU`],
          ['Memory', `${tier.memoryGb} GB`],
          ['NVMe', `${tier.nvmeGb} GB`],
        ].map(([label, value]) => (
          <div key={label} className="bg-console-surface p-4">
            <dt className="text-console-faint text-xs">{label}</dt>
            <dd className="mt-1 text-xl font-semibold sm:text-2xl">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-5xl leading-none font-bold tracking-[-0.04em]" aria-live="polite">
          <span>€{tier.eurPerMonth}</span>
          <span className="text-console-faint text-base font-normal tracking-normal"> / month</span>
        </p>
        <p className="text-console-muted text-sm">{tier.fit}</p>
      </div>
      <p className="font-console-mono text-console-faint border-console-line border-t pt-4 text-xs">
        €{UNIT.eurPerMonth} per {UNIT.vcpu} vCPU · {UNIT.memoryGb} GB · {UNIT.nvmeGb} GB NVMe ·
        scale up or down anytime
      </p>
    </div>
  )
}
