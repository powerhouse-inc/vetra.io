'use client'

import { Database, Loader2, Plus } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { toast } from 'sonner'

import { BackupSchedulePanel } from '@/modules/cloud/components/backup-schedule-panel'
import { DumpRow } from '@/modules/cloud/components/dump-row'
import { useEnvironmentDumps } from '@/modules/cloud/hooks/use-environment-dumps'
import { describeCloudError } from '@/modules/cloud/lib/cloud-error'
import {
  DEFAULT_BACKUP_SCHEDULE,
  type BackupCadence,
  type BackupSchedule,
  type DatabaseRestoreStatus,
} from '@/modules/cloud/types'
import { EmptyState } from '@/modules/shared/components/states'
import { Button } from '@/modules/shared/components/ui/button'

type Props = {
  tenantId: string | null
  canEdit: boolean
  /** Current schedule from `CloudEnvironmentState.backupSchedule`. */
  schedule?: BackupSchedule | null
  /** Saves the schedule via the doc-model action. */
  onSaveSchedule?: (opts: {
    enabled: boolean
    cadence: BackupCadence
    retention: number
  }) => Promise<void>
  /**
   * Signed controller loaded, so the schedule can be changed. While false
   * (loading, logged out) the schedule renders read-only.
   */
  scheduleEditable?: boolean
}

const RESTORE_STEP_LABEL: Partial<Record<DatabaseRestoreStatus, string>> = {
  SAFETY_DUMP: 'Saving a safety backup of the current data…',
  STOPPING: 'Stopping Switchboard…',
  RESTORING: 'Restoring the database…',
  STARTING: 'Starting Switchboard…',
}

const CADENCE_LABEL: Record<BackupCadence, string> = {
  HOURLY: 'hourly',
  DAILY: 'daily',
  WEEKLY: 'weekly',
}

const CADENCE_MS: Record<BackupCadence, number> = {
  HOURLY: 3_600_000,
  DAILY: 86_400_000,
  WEEKLY: 604_800_000,
}

export function DatabaseBackupsTab({
  tenantId,
  canEdit,
  schedule,
  onSaveSchedule,
  scheduleEditable = true,
}: Props) {
  const {
    dumps,
    isLoading,
    error,
    isRequesting,
    cancellingId,
    restores,
    activeRestore,
    isStartingRestore,
    request,
    cancel,
    restore,
  } = useEnvironmentDumps(tenantId)

  // A null schedule means the backend's default applies (daily, keep 7).
  const effectiveSchedule = schedule ?? DEFAULT_BACKUP_SCHEDULE
  const isRestoring = activeRestore !== null || isStartingRestore
  const inFlight =
    dumps.some((d) => d.status === 'PENDING' || d.status === 'RUNNING') || isRestoring

  // Toast once when the restore this tab watched reaches a final state.
  const watchedRestoreId = useRef<string | null>(null)
  useEffect(() => {
    if (activeRestore) {
      watchedRestoreId.current = activeRestore.id
      return
    }
    const watched = restores.find((r) => r.id === watchedRestoreId.current)
    if (!watched) return
    watchedRestoreId.current = null
    if (watched.status === 'SUCCEEDED') {
      toast.success(
        'Database restored. Reload any open Connect tabs so they pick up the restored data.',
      )
    } else if (watched.status === 'FAILED') {
      toast.error(
        watched.errorMessage ? `Restore failed: ${watched.errorMessage}` : 'Restore failed.',
      )
    }
  }, [activeRestore, restores])

  const handleCreate = async () => {
    try {
      await request()
      toast.success('Backup started. Check back in a moment.')
    } catch (err) {
      toast.error(
        describeCloudError(err, "Couldn't start the backup. Try again.", {
          FORBIDDEN: 'Only the environment owner can create a backup.',
        }),
      )
    }
  }

  const handleCancel = async (dumpId: string) => {
    try {
      await cancel(dumpId)
      toast.success('Backup cancelled.')
    } catch (err) {
      toast.error(describeCloudError(err, "Couldn't cancel the backup. Try again."))
    }
  }

  // Compute next-run timestamp client-side from the most recent SCHEDULED
  // dump + the active cadence. There's no `nextRunAt` field on the doc model
  // yet — this is the spec's documented degraded fallback.
  const nextRunAt = useMemo(() => {
    if (!effectiveSchedule.enabled) return null
    const scheduled = dumps.filter((d) => d.source === 'SCHEDULED')
    if (scheduled.length === 0) return null
    const latest = scheduled.slice().sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))[0]
    const cadenceMs = CADENCE_MS[effectiveSchedule.cadence]
    return new Date(new Date(latest.requestedAt).getTime() + cadenceMs).toISOString()
  }, [dumps, effectiveSchedule.enabled, effectiveSchedule.cadence])

  const handleSaveSchedule = async (opts: {
    enabled: boolean
    cadence: BackupCadence
    retention: number
  }) => {
    if (!onSaveSchedule) return
    try {
      await onSaveSchedule(opts)
      toast.success(opts.enabled ? 'Scheduled backups enabled.' : 'Scheduled backups disabled.')
    } catch (err) {
      toast.error(
        describeCloudError(err, "Couldn't update the backup schedule. Try again.", {
          FORBIDDEN: 'Only the environment owner can change the schedule.',
        }),
      )
      // Re-throw so the panel's draft rollback runs.
      throw err
    }
  }

  const handleRestore = async (dumpId: string) => {
    try {
      await restore(dumpId)
      toast.success('Restore started. A safety backup of the current data is taken first.')
    } catch (err) {
      toast.error(
        describeCloudError(err, "Couldn't start the restore. Try again.", {
          DUMP_IN_PROGRESS:
            'A backup is running for this environment. Try again once it has finished.',
          RESTORE_IN_PROGRESS: 'A restore is already in progress for this environment.',
          ENV_NOT_READY: 'The environment must be running to restore a backup.',
          DUMP_NOT_READY: 'This backup is no longer available for restore.',
          DUMP_EXPIRED: 'This backup is no longer available for restore.',
          FORBIDDEN: 'Only the environment owner can restore a backup.',
        }),
      )
    }
  }

  return (
    <div className="space-y-4">
      <BackupSchedulePanel
        schedule={schedule}
        canEdit={canEdit}
        onSave={handleSaveSchedule}
        nextRunAt={nextRunAt}
        editable={scheduleEditable && !!onSaveSchedule}
      />
      <div className="bg-background/40 flex items-center justify-between rounded-lg p-3">
        <div className="text-muted-foreground text-xs">
          <span className="text-foreground font-medium">{dumps.length}</span> backup
          {dumps.length === 1 ? '' : 's'} ·{' '}
          {effectiveSchedule.enabled
            ? `${CADENCE_LABEL[effectiveSchedule.cadence]} backups · ${effectiveSchedule.retention} kept`
            : 'scheduled backups off'}
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => void handleCreate()} disabled={inFlight || isRequesting}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {isRequesting ? 'Starting…' : inFlight ? 'In progress…' : 'Create backup'}
          </Button>
        )}
      </div>

      {isRestoring && (
        <div className="bg-warning/10 text-warning flex items-center gap-2 rounded-md px-3 py-2 text-sm">
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
          <span>
            {activeRestore ? (
              <>
                {RESTORE_STEP_LABEL[activeRestore.status]} Restoring{' '}
                <span className="font-mono">dump-{activeRestore.dumpId}.dump</span>
              </>
            ) : (
              'Starting restore…'
            )}
          </span>
        </div>
      )}

      {error && (
        <div className="text-destructive bg-destructive/10 rounded-md p-3 text-sm">{error}</div>
      )}

      {isLoading && dumps.length === 0 ? (
        <div className="text-muted-foreground py-8 text-center text-sm">Loading…</div>
      ) : dumps.length === 0 ? (
        <EmptyState
          icon={Database}
          title="No backups yet"
          description="Create a backup to download a portable copy of this environment’s database."
          action={
            canEdit && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleCreate()}
                disabled={isRequesting}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {isRequesting ? 'Starting…' : 'Create backup'}
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-2">
          {dumps.map((d) => (
            <DumpRow
              key={d.id}
              dump={d}
              source={d.source}
              onRetry={d.status === 'FAILED' && canEdit ? () => void handleCreate() : undefined}
              onCancel={
                canEdit && (d.status === 'PENDING' || d.status === 'RUNNING')
                  ? () => void handleCancel(d.id)
                  : undefined
              }
              isCancelling={cancellingId === d.id}
              onRestore={
                d.status === 'READY' && canEdit && !inFlight ? () => handleRestore(d.id) : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}
