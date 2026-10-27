'use client'

import { Database, Loader2, Plus } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { toast } from 'sonner'

import { BackupSchedulePanel } from '@/modules/cloud/components/backup-schedule-panel'
import { DumpRow } from '@/modules/cloud/components/dump-row'
import { useEnvironmentDumps } from '@/modules/cloud/hooks/use-environment-dumps'
import {
  DEFAULT_BACKUP_SCHEDULE,
  type BackupCadence,
  type BackupSchedule,
  type DatabaseRestoreStatus,
} from '@/modules/cloud/types'
import { Button } from '@/modules/shared/components/ui/button'

type Props = {
  tenantId: string | null
  canEdit: boolean
  /** Current schedule from `CloudEnvironmentState.backupSchedule`. */
  schedule?: BackupSchedule | null
  /**
   * Saves the schedule via the doc-model action. The wrapping hook gates this
   * on `backupScheduleSupported`; when undefined here, the panel renders in
   * "coming soon" mode.
   */
  onSaveSchedule?: (opts: {
    enabled: boolean
    cadence: BackupCadence
    retention: number
  }) => Promise<void>
  /** Whether the controller exposes `setBackupSchedule` at runtime. */
  scheduleSupported?: boolean
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
  scheduleSupported = true,
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
      toast.error(`Restore failed: ${watched.errorMessage ?? 'unknown error'}`)
    }
  }, [activeRestore, restores])

  const handleCreate = async () => {
    try {
      await request()
      toast.success('Dump started — check back in a moment.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start dump'
      // Surface the underlying contract errors with friendlier copy.
      if (msg.includes('DUMP_IN_PROGRESS')) {
        toast.error('A dump is already in progress for this environment.')
      } else if (msg.includes('RESTORE_IN_PROGRESS')) {
        toast.error('A restore is running. Try again once it has finished.')
      } else if (msg.includes('FORBIDDEN')) {
        toast.error('Only the environment owner can request a dump.')
      } else {
        toast.error(msg)
      }
    }
  }

  const handleCancel = async (dumpId: string) => {
    try {
      await cancel(dumpId)
      toast.success('Dump cancelled.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to cancel dump'
      toast.error(msg)
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
      const msg = err instanceof Error ? err.message : 'Failed to update schedule'
      if (msg.includes('INVALID_RETENTION')) {
        toast.error('Retention must be between 1 and 30.')
      } else if (msg.includes('NotOwnerError') || msg.includes('FORBIDDEN')) {
        toast.error('Only the environment owner can change the schedule.')
      } else {
        toast.error(msg)
      }
      // Re-throw so the panel's draft rollback runs.
      throw err
    }
  }

  const handleRestore = async (dumpId: string) => {
    try {
      await restore(dumpId)
      toast.success('Restore started. A safety backup of the current data is taken first.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start restore'
      if (msg.includes('RESTORE_IN_PROGRESS')) {
        toast.error('A restore is already in progress for this environment.')
      } else if (msg.includes('DUMP_IN_PROGRESS')) {
        toast.error('A dump is running for this environment. Try again once it has finished.')
      } else if (msg.includes('ENV_NOT_READY')) {
        toast.error('The environment must be running to restore a dump.')
      } else if (msg.includes('DUMP_NOT_READY') || msg.includes('DUMP_EXPIRED')) {
        toast.error('This dump is no longer available for restore.')
      } else if (msg.includes('FORBIDDEN')) {
        toast.error('Only the environment owner can restore a dump.')
      } else {
        toast.error(msg)
      }
    }
  }

  return (
    <div className="space-y-4">
      <BackupSchedulePanel
        schedule={schedule}
        canEdit={canEdit}
        onSave={handleSaveSchedule}
        nextRunAt={nextRunAt}
        controllerSupported={scheduleSupported && !!onSaveSchedule}
      />
      <div className="bg-background/40 flex items-center justify-between rounded-lg p-3">
        <div className="text-muted-foreground text-xs">
          <span className="text-foreground font-medium">{dumps.length}</span> dump
          {dumps.length === 1 ? '' : 's'} ·{' '}
          {effectiveSchedule.enabled
            ? `${CADENCE_LABEL[effectiveSchedule.cadence]} backups · ${effectiveSchedule.retention} kept`
            : 'scheduled backups off'}
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => void handleCreate()} disabled={inFlight || isRequesting}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {isRequesting ? 'Starting…' : inFlight ? 'In progress…' : 'Create dump'}
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
        <div className="text-muted-foreground bg-muted/30 flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
          <div className="bg-background flex h-12 w-12 items-center justify-center rounded-full border">
            <Database className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <p className="text-foreground text-sm font-medium">No dumps yet</p>
            <p className="text-xs">
              Create a dump to download a portable copy of this environment&rsquo;s database.
            </p>
          </div>
          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleCreate()}
              disabled={isRequesting}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              {isRequesting ? 'Starting…' : 'Create dump'}
            </Button>
          )}
        </div>
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
