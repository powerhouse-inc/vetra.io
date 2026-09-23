'use client'

import { FileText } from 'lucide-react'
import { toast } from 'sonner'

import { useOptimistic } from '@/modules/cloud/hooks/use-optimistic'
import type { CloudEnvironmentService, CloudEnvironmentStatus } from '@/modules/cloud/types'
import { Badge } from '@/modules/shared/components/ui/badge'
import { Switch } from '@/modules/shared/components/ui/switch'
import { cn } from '@/shared/lib/utils'

/**
 * Environment statuses where nothing is running, so flipping an add-on would
 * queue a change against a workload that cannot apply it. Mirrors the drawer's
 * own TERMINAL_STATUSES plus STOPPED (housekeeping sleep).
 */
const NO_WORKLOAD_STATUSES = new Set<CloudEnvironmentStatus>([
  'DRAFT',
  'STOPPED',
  'TERMINATING',
  'DESTROYED',
  'ARCHIVED',
])

/** Prefixes the gitops reconciler expects. */
export const DOCLING_PREFIX = 'docling'
export const PAPERLESS_PREFIX = 'paperless'

export type AddonType = 'DOCLING' | 'PAPERLESS'

/**
 * The add-ons, in display order. Each costs real memory on a shared node, so
 * the description states it plainly -- otherwise it only surfaces later as
 * unexplained slowness or a bill.
 */
export const ADDONS: readonly {
  type: AddonType
  prefix: string
  label: string
  description: string
}[] = [
  {
    type: 'DOCLING',
    prefix: DOCLING_PREFIX,
    label: 'Document Conversion',
    description:
      'Converts PDF, DOCX and images into documents your reactor can index. Runs privately inside this environment — no public URL. Reserves ~2 GiB of memory and converts one document at a time.',
  },
  {
    type: 'PAPERLESS',
    prefix: PAPERLESS_PREFIX,
    label: 'Document Archive',
    description:
      'A private Paperless-ngx archive with OCR, wired to your switchboard for paperless-sync. Reserves ~1.5 GiB of memory. Documents stay in this environment; web access arrives with single sign-on.',
  },
]

type Props = {
  services: CloudEnvironmentService[]
  environmentStatus: CloudEnvironmentStatus
  /** Wired to the generic enableService/disableService pair in the page. */
  onToggleAddon: (type: AddonType, prefix: string, enabled: boolean) => Promise<void>
}

/**
 * Add-ons — optional per-environment services that have no URL of their own.
 * They live here rather than in the Overview "Services" card because that card
 * is about addressable hosts.
 */
export function AddonsSection({ services, environmentStatus, onToggleAddon }: Props) {
  const disabled = NO_WORKLOAD_STATUSES.has(environmentStatus)
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium">Add-ons</h3>
        <p className="text-muted-foreground text-xs">
          Optional services that run inside this environment. They have no public URL.
        </p>
      </div>
      {ADDONS.map((addon) => (
        <AddonRow
          key={addon.type}
          addon={addon}
          service={services.find((s) => s.type === addon.type)}
          disabled={disabled}
          onToggle={(enabled) => onToggleAddon(addon.type, addon.prefix, enabled)}
        />
      ))}
      {disabled && (
        <p className="text-muted-foreground/70 text-xs italic">
          Unavailable while the environment is {environmentStatus.toLowerCase()}.
        </p>
      )}
    </div>
  )
}

function AddonRow({
  addon,
  service,
  disabled,
  onToggle,
}: {
  addon: (typeof ADDONS)[number]
  service: CloudEnvironmentService | undefined
  disabled: boolean
  onToggle: (enabled: boolean) => Promise<void>
}) {
  const { value: enabled, set: setEnabled } = useOptimistic(service?.enabled ?? false, onToggle)

  const handleToggle = async (checked: boolean) => {
    try {
      await setEnabled(checked)
      toast.success(`${addon.label} ${checked ? 'enabled' : 'disabled'}`)
    } catch (error) {
      console.error(`Failed to toggle ${addon.label}:`, error)
      toast.error(error instanceof Error ? error.message : `Failed to toggle ${addon.label}`)
    }
  }

  return (
    <div
      className={cn(
        'rounded-lg border p-3 transition-colors',
        enabled ? 'border-success/30 bg-success/5' : 'border-border/50 bg-muted/30',
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
              enabled ? 'bg-success/15 dark:bg-success/20' : 'bg-muted',
            )}
          >
            <FileText className={cn('h-5 w-5', enabled ? 'text-success' : 'text-muted-foreground')} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={cn('text-sm font-medium', !enabled && 'text-muted-foreground')}>
                {addon.label}
              </span>
              {!enabled && (
                <Badge
                  size="xs"
                  variant="outline"
                  className="text-muted-foreground border-border/50 px-1.5 py-0"
                >
                  OFF
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-1 text-xs">{addon.description}</p>
          </div>
        </div>
        <Switch
          checked={enabled}
          disabled={disabled}
          onCheckedChange={(checked) => void handleToggle(checked)}
          aria-label={`Toggle ${addon.label}`}
          className={cn(
            enabled
              ? 'data-[state=checked]:bg-success'
              : 'data-[state=unchecked]:bg-zinc-400 dark:data-[state=unchecked]:bg-zinc-600',
          )}
        />
      </div>
    </div>
  )
}
