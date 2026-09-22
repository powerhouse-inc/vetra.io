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

/** Prefix the gitops reconciler expects for the docling service. */
export const DOCLING_PREFIX = 'docling'

type Props = {
  services: CloudEnvironmentService[]
  environmentStatus: CloudEnvironmentStatus
  /**
   * Enable/disable the tenant's private document converter. Wired to the
   * generic enableService/disableService pair in the page; kept as one narrow
   * prop so the drawer doesn't carry a service API it has no other use for.
   */
  onToggleDocling: (enabled: boolean) => Promise<void>
}

/**
 * Add-ons — optional per-environment services that have no URL of their own.
 *
 * They live here rather than in the Overview "Services" card because that card
 * is about addressable hosts: every row there has a public URL, a version and a
 * logs drawer. An add-on has none of those, so it would render three empty
 * columns and a hostname that resolves to nothing.
 */
export function AddonsSection({ services, environmentStatus, onToggleDocling }: Props) {
  const docling = services.find((s) => s.type === 'DOCLING')
  const disabled = NO_WORKLOAD_STATUSES.has(environmentStatus)

  const { value: enabled, set: setEnabled } = useOptimistic(
    docling?.enabled ?? false,
    onToggleDocling,
  )

  const handleToggle = async (checked: boolean) => {
    try {
      await setEnabled(checked)
      toast.success(`Document Conversion ${checked ? 'enabled' : 'disabled'}`)
    } catch (error) {
      console.error('Failed to toggle Document Conversion:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to toggle Document Conversion')
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium">Add-ons</h3>
        <p className="text-muted-foreground text-xs">
          Optional services that run inside this environment. They have no public URL.
        </p>
      </div>

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
              <FileText
                className={cn('h-5 w-5', enabled ? 'text-success' : 'text-muted-foreground')}
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={cn('text-sm font-medium', !enabled && 'text-muted-foreground')}>
                  Document Conversion
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
              {/* State the cost plainly. This reserves real memory on a shared
                  node and converts strictly one document at a time, which
                  otherwise only shows up later as unexplained slowness. */}
              <p className="text-muted-foreground mt-1 text-xs">
                Converts PDF, DOCX and images into documents your reactor can index. Runs privately
                inside this environment &mdash; no public URL. Reserves ~2&nbsp;GiB of memory and
                converts one document at a time.
              </p>
              {disabled && (
                <p className="text-muted-foreground/70 mt-1 text-xs italic">
                  Unavailable while the environment is {environmentStatus.toLowerCase()}.
                </p>
              )}
            </div>
          </div>
          <Switch
            checked={enabled}
            disabled={disabled}
            onCheckedChange={(checked) => void handleToggle(checked)}
            aria-label="Toggle Document Conversion"
            className={cn(
              enabled
                ? 'data-[state=checked]:bg-success'
                : 'data-[state=unchecked]:bg-zinc-400 dark:data-[state=unchecked]:bg-zinc-600',
            )}
          />
        </div>
      </div>
    </div>
  )
}
