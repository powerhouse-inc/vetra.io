'use client'

import { ALL_SIZES, SIZE_LABELS } from '@/modules/cloud/lib/resource-maps'
import type { CloudResourceSize } from '@/modules/cloud/types'
import { Label } from '@/modules/shared/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/modules/shared/components/ui/radio-group'

type Props = {
  supported: CloudResourceSize[]
  value: CloudResourceSize | null
  onChange: (size: CloudResourceSize) => void
  disabled?: boolean
}

export function ResourceSizePicker({ supported, value, onChange, disabled }: Props) {
  const supportedSet = new Set(supported)
  const ordered = ALL_SIZES.filter((s) => supportedSet.has(s))
  return (
    <RadioGroup
      value={value ?? undefined}
      onValueChange={(v) => onChange(v as CloudResourceSize)}
      disabled={disabled}
      className="flex flex-wrap gap-3"
    >
      {ordered.map((size) => (
        <div key={size} className="flex items-center gap-2">
          <RadioGroupItem value={size} id={`rs-${size}`} />
          <Label htmlFor={`rs-${size}`}>{SIZE_LABELS[size]}</Label>
        </div>
      ))}
    </RadioGroup>
  )
}
