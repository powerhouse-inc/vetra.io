'use client'

import { Check, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import {
  ALL_SIZES,
  APP_RESOURCE_MAP,
  CLINT_RESOURCE_MAP,
  SIZE_LABELS,
  type ResourceSpec,
} from '@/modules/cloud/lib/resource-maps'
import type { CloudEnvironmentServiceType, CloudResourceSize } from '@/modules/cloud/types'
import { Button } from '@/modules/shared/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/modules/shared/components/ui/popover'
import { cn } from '@/shared/lib/utils'

type Props = {
  serviceType: CloudEnvironmentServiceType
  prefix: string
  currentSize: CloudResourceSize | null
  canEdit: boolean
  onSave: (size: CloudResourceSize) => Promise<void>
}

export function ServiceSizePopover({ serviceType, prefix, currentSize, canEdit, onSave }: Props) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<CloudResourceSize | null>(null)
  const map = serviceType === 'CLINT' ? CLINT_RESOURCE_MAP : APP_RESOURCE_MAP
  const effective: CloudResourceSize = currentSize ?? 'VETRA_AGENT_S'
  const display = pending ?? effective

  const handleChange = async (size: CloudResourceSize) => {
    if (size === effective) {
      setOpen(false)
      return
    }
    setPending(size)
    try {
      await onSave(size)
      toast.success(`Resized ${prefix} to ${SIZE_LABELS[size]}`)
      setOpen(false)
    } catch (err) {
      setPending(null)
      toast.error(err instanceof Error ? err.message : 'Failed to resize service')
    }
  }

  if (!canEdit) {
    return (
      <span className="text-muted-foreground text-xs font-medium">
        Size: {SIZE_LABELS[effective]}
      </span>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
          Size: {SIZE_LABELS[display]}
          <ChevronDown className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 space-y-3 p-3">
        <SelectableSizeTable
          map={map}
          value={display}
          pending={pending}
          onSelect={(size) => void handleChange(size)}
        />
        <p className="text-muted-foreground text-[11px] leading-snug">
          Picking a size moves the environment to <code className="font-mono">CHANGES_PENDING</code>
          . Approve from the Overview tab to deploy.
        </p>
      </PopoverContent>
    </Popover>
  )
}

function SelectableSizeTable({
  map,
  value,
  pending,
  onSelect,
}: {
  map: Record<CloudResourceSize, ResourceSpec>
  value: CloudResourceSize
  pending: CloudResourceSize | null
  onSelect: (size: CloudResourceSize) => void
}) {
  return (
    <div className="overflow-hidden rounded border">
      <div className="bg-muted/40 grid grid-cols-[2.5rem_2rem_1fr_1fr] items-center gap-2 px-3 py-1.5 text-[11px] font-medium">
        <span />
        <span>Size</span>
        <span>Requests (cpu / mem)</span>
        <span>Limits (cpu / mem)</span>
      </div>
      <div className="divide-y">
        {ALL_SIZES.map((s) => {
          const r = map[s]
          const isSelected = s === value
          const isPending = pending === s
          return (
            <button
              key={s}
              type="button"
              onClick={() => onSelect(s)}
              disabled={pending !== null}
              className={cn(
                'grid w-full grid-cols-[2.5rem_2rem_1fr_1fr] items-center gap-2 px-3 py-2 text-left text-xs transition-colors',
                'hover:bg-accent/60 focus:bg-accent/60 focus:outline-none',
                isSelected && 'bg-accent',
                pending !== null && !isPending && 'opacity-50',
              )}
            >
              <span className="flex h-4 w-4 items-center justify-center">
                {isSelected && <Check className="text-success h-4 w-4" />}
              </span>
              <span className="font-medium">{SIZE_LABELS[s]}</span>
              <span className="text-muted-foreground font-mono">
                {r.requests.cpu} / {r.requests.memory}
              </span>
              <span className="text-muted-foreground font-mono">
                {r.limits.cpu} / {r.limits.memory}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
