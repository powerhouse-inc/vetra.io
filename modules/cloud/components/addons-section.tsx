'use client'

import { Settings2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { AddonSettingsDialog } from '@/modules/cloud/components/addon-settings-dialog'
import { useOptimistic } from '@/modules/cloud/hooks/use-optimistic'
import {
  ADDONS,
  type AddonConfigStore,
  type AddonControl,
  type AddonDefinition,
  type AddonId,
} from '@/modules/cloud/lib/addons'
import type { CloudEnvironmentStatus } from '@/modules/cloud/types'
import { Badge } from '@/modules/shared/components/ui/badge'
import { Button } from '@/modules/shared/components/ui/button'
import { Switch } from '@/modules/shared/components/ui/switch'
import { cn } from '@/modules/shared/lib/utils'

// Nothing is running in these, so a toggle would queue a change no workload can
// apply. The drawer's TERMINAL_STATUSES plus STOPPED (housekeeping sleep).
const NO_WORKLOAD_STATUSES = new Set<CloudEnvironmentStatus>([
  'DRAFT',
  'STOPPED',
  'TERMINATING',
  'DESTROYED',
  'ARCHIVED',
])

// Stands in for a missing handler so the hook call stays unconditional; the
// switch is disabled in that case, so it is never reached.
const noop = async () => {}

type Props = {
  environmentStatus: CloudEnvironmentStatus
  addons: Record<AddonId, AddonControl>
  /** Tenant config for add-on settings; unset until it has loaded. */
  configStore?: AddonConfigStore
}

// Kept out of the Services card: every row there has a public URL, a version
// and a logs drawer, and an add-on has none of those.
export function AddonsSection({ environmentStatus, addons, configStore }: Props) {
  const disabled = NO_WORKLOAD_STATUSES.has(environmentStatus)

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Add-ons</h2>
        <p className="text-muted-foreground text-xs">
          Optional capabilities that run inside this environment. They have no public URL.
        </p>
      </div>

      {ADDONS.map((addon) => {
        const { enabled, unavailable, toggle } = addons[addon.id]
        return (
          <AddonRow
            key={addon.id}
            addon={addon}
            initial={enabled}
            onToggle={unavailable ? undefined : toggle}
            disabled={disabled}
            environmentStatus={environmentStatus}
            configStore={configStore}
            note={unavailable ?? addon.note}
          />
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
  addon: AddonDefinition
  initial: boolean
  onToggle?: (enabled: boolean) => Promise<void>
  disabled: boolean
  environmentStatus: CloudEnvironmentStatus
  configStore?: AddonConfigStore
  note?: string
}

function AddonRow({
  addon,
  initial,
  onToggle,
  disabled,
  environmentStatus,
  configStore,
  note,
}: RowProps) {
  const { label, icon: Icon } = addon
  const { value: enabled, set: setEnabled } = useOptimistic(initial, onToggle ?? noop)
  const [settingsOpen, setSettingsOpen] = useState(false)
  // A toggle only queues a change for Approve / Deploy, so confirm it once the
  // environment is READY again after leaving it, not when the write returns.
  const [awaiting, setAwaiting] = useState<{ value: boolean; leftReady: boolean } | null>(null)

  useEffect(() => {
    if (!awaiting) return
    if (environmentStatus === 'DEPLOYMENt_FAILED') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAwaiting(null)
    } else if (environmentStatus !== 'READY') {
      if (!awaiting.leftReady) setAwaiting({ ...awaiting, leftReady: true })
    } else if (awaiting.leftReady && initial === awaiting.value) {
      toast.success(`${label} ${awaiting.value ? 'enabled' : 'disabled'}`)
      setAwaiting(null)
    }
  }, [awaiting, environmentStatus, initial, label])

  const handleToggle = async (checked: boolean) => {
    try {
      await setEnabled(checked)
      setAwaiting({ value: checked, leftReady: false })
    } catch (error) {
      console.error(`Failed to toggle ${label}:`, error)
      toast.error(error instanceof Error ? error.message : `Failed to toggle ${label}`, {
        action: { label: 'Retry', onClick: () => void handleToggle(checked) },
      })
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
            <p className="text-muted-foreground mt-1 text-xs">{addon.description}</p>
            {note && <p className="text-muted-foreground/70 mt-1 text-xs">{note}</p>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {addon.config.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground h-7 w-7"
              disabled={!configStore}
              onClick={() => setSettingsOpen(true)}
              aria-label={`${label} settings`}
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          )}
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
      {configStore && addon.config.length > 0 && (
        <AddonSettingsDialog
          addon={addon}
          store={configStore}
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
        />
      )}
    </div>
  )
}
