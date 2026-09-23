'use client'

import { Archive, FileText, Workflow } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { toast } from 'sonner'

import { useOptimistic } from '@/modules/cloud/hooks/use-optimistic'
import type { CloudEnvironmentStatus } from '@/modules/cloud/types'
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

// Stands in for a missing handler so the hook call stays unconditional; the
// switch is disabled in that case, so it is never reached.
const noop = async () => {}

export type AddonId = 'docling' | 'paperless' | 'workflows'

export type AddonDefinition = {
  id: AddonId
  label: string
  icon: LucideIcon
  /** States the add-on's cost plainly; unsaid, it only surfaces later as unexplained slowness or a bill. */
  description: string
  /** Shown under the description when the add-on is available. */
  note?: string
  /** Set when the add-on is a service in the env document. */
  service?: { type: 'DOCLING' | 'PAPERLESS'; prefix: string }
}

/** The add-ons, in display order. */
export const ADDONS: readonly AddonDefinition[] = [
  {
    id: 'docling',
    label: 'Document Conversion',
    icon: FileText,
    description:
      'Converts PDF, DOCX and images into documents your reactor can index. Runs privately inside this environment — no public URL. Reserves ~2 GiB of memory and converts one document at a time.',
    service: { type: 'DOCLING', prefix: DOCLING_PREFIX },
  },
  {
    id: 'paperless',
    label: 'Document Archive',
    icon: Archive,
    description:
      'A private Paperless-ngx archive with OCR, wired to your switchboard for paperless-sync. Reserves ~1.5 GiB of memory. Documents stay in this environment; web access arrives with single sign-on.',
    service: { type: 'PAPERLESS', prefix: PAPERLESS_PREFIX },
  },
  {
    id: 'workflows',
    label: 'Workflows',
    icon: Workflow,
    description:
      'Runs workflow documents on this environment and adds the workflow editors and Workflow Studio to Connect. Each run executes in its own process on the reactor.',
    note: 'The Connect half rolls out on your next Approve / Deploy.',
  },
]

/** An add-on's state, resolved in the page. */
export type AddonStatus = {
  enabled: boolean
  /** Why the switch can't be used right now; renders it disabled. */
  unavailable?: string
}

type Props = {
  environmentStatus: CloudEnvironmentStatus
  status: Record<AddonId, AddonStatus>
  onToggleAddon: (id: AddonId, enabled: boolean) => Promise<void>
}

/**
 * Add-ons — optional per-environment capabilities that have no URL of their own.
 *
 * They live here rather than in the Overview "Services" card because that card
 * is about addressable hosts: every row there has a public URL, a version and a
 * logs drawer. An add-on has none of those, so it would render three empty
 * columns and a hostname that resolves to nothing.
 */
export function AddonsSection({ environmentStatus, status, onToggleAddon }: Props) {
  const disabled = NO_WORKLOAD_STATUSES.has(environmentStatus)

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium">Add-ons</h3>
        <p className="text-muted-foreground text-xs">
          Optional capabilities that run inside this environment. They have no public URL.
        </p>
      </div>

      {ADDONS.map((addon) => {
        const { enabled, unavailable } = status[addon.id]
        return (
          <AddonRow
            key={addon.id}
            icon={addon.icon}
            label={addon.label}
            initial={enabled}
            onToggle={unavailable ? undefined : (next) => onToggleAddon(addon.id, next)}
            disabled={disabled}
            note={unavailable ?? addon.note}
          >
            {addon.description}
          </AddonRow>
        )
      })}
      {disabled && (
        <p className="text-muted-foreground/70 text-xs italic">
          Unavailable while the environment is {environmentStatus.toLowerCase()}.
        </p>
      )}
    </div>
  )
}

type RowProps = {
  icon: LucideIcon
  label: string
  initial: boolean
  onToggle?: (enabled: boolean) => Promise<void>
  disabled: boolean
  children: React.ReactNode
  note?: string
}

function AddonRow({ icon: Icon, label, initial, onToggle, disabled, children, note }: RowProps) {
  const { value: enabled, set: setEnabled } = useOptimistic(initial, onToggle ?? noop)

  const handleToggle = async (checked: boolean) => {
    try {
      await setEnabled(checked)
      toast.success(`${label} ${checked ? 'enabled' : 'disabled'}`)
    } catch (error) {
      console.error(`Failed to toggle ${label}:`, error)
      toast.error(error instanceof Error ? error.message : `Failed to toggle ${label}`)
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
            <Icon className={cn('h-5 w-5', enabled ? 'text-success' : 'text-muted-foreground')} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={cn('text-sm font-medium', !enabled && 'text-muted-foreground')}>
                {label}
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
            <p className="text-muted-foreground mt-1 text-xs">{children}</p>
            {note && <p className="text-muted-foreground/70 mt-1 text-xs">{note}</p>}
          </div>
        </div>
        <Switch
          checked={enabled}
          disabled={disabled || !onToggle}
          onCheckedChange={(checked) => void handleToggle(checked)}
          aria-label={`Toggle ${label}`}
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
