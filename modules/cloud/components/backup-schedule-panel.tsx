'use client'

import { Clock, Minus, Plus } from 'lucide-react'
import { useState } from 'react'

import { AsyncButton } from '@/modules/cloud/components/async-button'
import { timeUntil } from '@/modules/cloud/lib/time-format'
import type { BackupCadence, BackupSchedule } from '@/modules/cloud/types'
import { Button } from '@/modules/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

const RETENTION_MIN = 1
const RETENTION_MAX = 30
const DEFAULT_RETENTION = 7
const DEFAULT_CADENCE: BackupCadence = 'DAILY'

const CADENCE_OPTIONS: ReadonlyArray<{ value: BackupCadence; label: string }> = [
  { value: 'HOURLY', label: 'Hourly' },
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
]

type Props = {
  schedule: BackupSchedule | null | undefined
  canEdit: boolean
  onSave: (next: { enabled: boolean; cadence: BackupCadence; retention: number }) => Promise<void>
  /**
   * Computed upstream from the most recent SCHEDULED dump + the active
   * cadence. Null when no scheduled dump has fired yet, or when the
   * schedule is disabled.
   */
  nextRunAt?: string | null
  /**
   * `false` when the doc-model controller doesn't expose `setBackupSchedule`
   * yet (consumer hasn't bumped the vetra-cloud-package version). Panel
   * renders a muted "coming soon" notice and disables controls.
   */
  controllerSupported?: boolean
}

/**
 * Surfaces (and writes) the recurring-backup intent stored on
 * `CloudEnvironmentState.backupSchedule`. Renders above the dump-count stat
 * bar inside the Database tab. The actual cron is owned by a backend runner
 * — this UI only persists the intent.
 */
export function BackupSchedulePanel({
  schedule,
  canEdit,
  onSave,
  nextRunAt,
  controllerSupported = true,
}: Props) {
  // No schedule set = the backend default: enabled, daily, keep 7.
  const enabled = schedule?.enabled ?? true
  const initialCadence = schedule?.cadence ?? DEFAULT_CADENCE
  const initialRetention = schedule?.retention ?? DEFAULT_RETENTION

  // Drafts mirror the upstream schedule, but accept temporary local overrides
  // while a save is in flight. The render-time sync below adopts upstream
  // changes (after a successful save, or a remote subscription update)
  // without a setState-in-effect.
  const [draft, setDraft] = useState<{
    cadence: BackupCadence
    retention: number
  }>(() => ({
    cadence: initialCadence,
    retention: initialRetention,
  }))

  // Identity-based sync via the "prev state" pattern from the React docs:
  // store the last-seen schedule reference in state, and reset the draft
  // whenever a new identity arrives. Documented behavior: any prop change
  // overwrites local edits. Cadence/retention edits auto-save when enabled,
  // so drafts are short-lived — having the next subscription tick win is
  // the right semantics (mid-edit state is reset, not silently kept).
  const [syncedFrom, setSyncedFrom] = useState(schedule)
  if (syncedFrom !== schedule) {
    setSyncedFrom(schedule)
    setDraft({
      cadence: schedule?.cadence ?? DEFAULT_CADENCE,
      retention: schedule?.retention ?? DEFAULT_RETENTION,
    })
  }

  const draftCadence = draft.cadence
  const draftRetention = draft.retention
  const setDraftCadence = (cadence: BackupCadence) => setDraft((d) => ({ ...d, cadence }))
  const setDraftRetention = (retention: number) => setDraft((d) => ({ ...d, retention }))

  const controlsDisabled = !canEdit || !controllerSupported

  const handleToggle = async () => {
    await onSave({
      enabled: !enabled,
      cadence: draftCadence,
      retention: draftRetention,
    })
  }

  const handleCadenceChange = async (cadence: BackupCadence) => {
    if (cadence === draftCadence) return
    setDraftCadence(cadence)
    if (enabled) {
      try {
        await onSave({ enabled: true, cadence, retention: draftRetention })
      } catch {
        // Roll back local draft if the save failed.
        setDraftCadence(initialCadence)
      }
    }
  }

  const handleRetentionStep = async (delta: number) => {
    const next = Math.max(RETENTION_MIN, Math.min(RETENTION_MAX, draftRetention + delta))
    if (next === draftRetention) return
    setDraftRetention(next)
    if (enabled) {
      try {
        await onSave({ enabled: true, cadence: draftCadence, retention: next })
      } catch {
        setDraftRetention(initialRetention)
      }
    }
  }

  const showNextRun = enabled && !!nextRunAt
  const nextRunLabel = nextRunAt
    ? timeUntil(nextRunAt) === 'expired'
      ? 'overdue'
      : `Next run in ${timeUntil(nextRunAt)}`
    : null

  return (
    <div className="bg-background/40 space-y-3 rounded-lg p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium">Scheduled backups</div>
          {!controllerSupported ? (
            <div className="text-muted-foreground mt-0.5 text-xs">
              Scheduled backups coming soon
            </div>
          ) : showNextRun ? (
            <div className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs">
              <Clock className="h-3 w-3" />
              <span>{nextRunLabel}</span>
            </div>
          ) : (
            <div className="text-muted-foreground mt-0.5 text-xs">
              {enabled ? 'Waiting for first scheduled dump' : 'Off — manual dumps only'}
            </div>
          )}
        </div>
        {canEdit && controllerSupported && (
          <AsyncButton
            size="sm"
            variant="outline"
            onClickAsync={handleToggle}
            pendingLabel={enabled ? 'Disabling…' : 'Enabling…'}
          >
            {enabled ? 'Disable' : 'Enable'}
          </AsyncButton>
        )}
      </div>

      {enabled && (
        <div className="space-y-2 border-t pt-3">
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground w-16 text-xs">Cadence</span>
            <div className="flex flex-wrap gap-1">
              {CADENCE_OPTIONS.map((opt) => {
                const active = draftCadence === opt.value
                return (
                  <Button
                    key={opt.value}
                    size="sm"
                    variant={active ? 'default' : 'outline'}
                    disabled={controlsDisabled}
                    onClick={() => void handleCadenceChange(opt.value)}
                    className={cn(!active && 'text-muted-foreground')}
                  >
                    {opt.label}
                  </Button>
                )
              })}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-muted-foreground w-16 text-xs">Keep</span>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                disabled={controlsDisabled || draftRetention <= RETENTION_MIN}
                onClick={() => void handleRetentionStep(-1)}
                aria-label="Decrease retention"
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="w-8 text-center text-sm font-medium">{draftRetention}</span>
              <Button
                size="sm"
                variant="outline"
                disabled={controlsDisabled || draftRetention >= RETENTION_MAX}
                onClick={() => void handleRetentionStep(1)}
                aria-label="Increase retention"
              >
                <Plus className="h-3 w-3" />
              </Button>
              <span className="text-muted-foreground ml-1 text-xs">
                scheduled dump{draftRetention === 1 ? '' : 's'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
