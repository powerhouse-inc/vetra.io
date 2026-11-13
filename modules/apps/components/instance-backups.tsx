'use client'

import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { PersonName } from '@/modules/shared/components/person-name'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/modules/shared/components/ui/alert-dialog'
import { Button } from '@/modules/shared/components/ui/button'
import { Input } from '@/modules/shared/components/ui/input'
import { Label } from '@/modules/shared/components/ui/label'
import { Skeleton } from '@/modules/shared/components/ui/skeleton'
import { formatTimestamp, timeAgo } from '@/modules/shared/lib/time'

import { describeAppsError } from '../graphql'
import {
  useBackUpInstance,
  useInstanceBackups,
  useInstanceRestores,
  useRestoreInstanceBackup,
} from '../hooks/use-apps'
import {
  RESTORE_PHASE_LABEL,
  backupReasonLabel,
  canRestore,
  formatBytes,
  isHeld,
  isRestoring,
  isVetraActor,
  restoreOf,
} from '../lib/rollouts'
import type { AppInstance, InstanceBackup } from '../types'

/**
 * While a backup is restored into the instance: the phase it is in. After a failed restore:
 * why it is stopped. Renders nothing otherwise.
 */
export function MaintenanceLine({ instance }: { instance: AppInstance }) {
  const restoring = isRestoring(instance.maintenance)
  const held = isHeld(instance.maintenance)
  const restores = useInstanceRestores(instance.id, restoring, restoring || held)
  if (!restoring && !held) return null
  const restore = restoreOf(instance.maintenance, restores.data)
  if (held) {
    return (
      <p
        role="alert"
        className="border-destructive/40 bg-destructive/10 text-destructive basis-full rounded-md border px-3 py-1.5 text-xs"
      >
        Stopped after a failed restore{restore?.error ? `: ${restore.error}` : ''}. Restore a backup
        to bring it back.
      </p>
    )
  }
  return (
    <p
      role="status"
      className="text-info basis-full text-xs"
      data-testid={`restore-progress-${instance.id}`}
    >
      <Loader2 className="mr-1 inline h-3 w-3 animate-spin" aria-hidden />
      Restoring a backup: {restore ? RESTORE_PHASE_LABEL[restore.status] : 'starting'}
    </p>
  )
}

function RestoreDialog({
  appId,
  instance,
  backup,
  onClose,
}: {
  appId: string
  instance: AppInstance
  backup: InstanceBackup
  onClose: () => void
}) {
  const restore = useRestoreInstanceBackup(appId, instance.id)
  const [typed, setTyped] = useState('')
  const matches = typed.trim() === instance.name
  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Restore this backup?</AlertDialogTitle>
          <AlertDialogDescription>
            The instance goes back to its state of {formatTimestamp(backup.createdAt)}. Everything
            written since is lost. A safety backup of its current state is taken first.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor="restore-confirm">
            Type <span className="font-mono">{instance.name}</span> to confirm
          </Label>
          <Input
            id="restore-confirm"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
          />
        </div>
        {restore.error && (
          <p role="alert" className="text-destructive text-sm">
            {describeAppsError(restore.error)}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={restore.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={!matches || restore.isPending}
            onClick={(e) => {
              e.preventDefault()
              restore.mutate(backup.id, {
                onSuccess: () => {
                  toast.success('Restore started')
                  onClose()
                },
              })
            }}
          >
            {restore.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Restore and lose newer data
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** An instance's backups, "Back up now" and "Restore" (publisher side; needs `release`). */
export function InstanceBackups({
  appId,
  instance,
  canRelease,
}: {
  appId: string
  instance: AppInstance
  canRelease: boolean
}) {
  const backups = useInstanceBackups(instance.id)
  const backUp = useBackUpInstance(appId, instance.id)
  const [restoring, setRestoring] = useState<InstanceBackup | null>(null)
  const held = isHeld(instance.maintenance)
  const busy = isRestoring(instance.maintenance)
  const list = backups.data ?? []

  return (
    <div
      data-testid={`backups-${instance.id}`}
      className="bg-muted/30 border-border basis-full space-y-3 rounded-lg border px-4 py-3"
    >
      <div className="flex flex-wrap items-center gap-3">
        <h4 className="text-sm font-medium">Backups</h4>
        {canRelease && (
          <Button
            size="sm"
            variant="outline"
            disabled={backUp.isPending || held || busy}
            onClick={() =>
              backUp.mutate(undefined, { onSuccess: () => toast.success('Backup started') })
            }
          >
            {backUp.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Back up now
          </Button>
        )}
      </div>
      {backUp.error && (
        <p role="alert" className="text-destructive text-sm">
          {describeAppsError(backUp.error)}
        </p>
      )}
      {backups.isPending ? (
        <Skeleton className="h-10 w-full" />
      ) : backups.error ? (
        <p role="alert" className="text-destructive text-sm">
          {describeAppsError(backups.error)}
        </p>
      ) : list.length === 0 ? (
        <p className="text-muted-foreground text-sm">No backups yet.</p>
      ) : (
        <ul className="divide-border divide-y text-sm">
          {list.map((b) => {
            const allowed = canRelease && !busy && canRestore(b, instance.runningVersion)
            return (
              <li
                key={b.id}
                data-testid={`backup-${b.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2"
              >
                <span className="font-medium">{backupReasonLabel(b)}</span>
                <span className="text-muted-foreground text-xs" title={b.createdAt}>
                  {formatTimestamp(b.createdAt)} ({timeAgo(b.createdAt)})
                </span>
                {b.version && <span className="font-mono text-xs">{b.version}</span>}
                <span className="text-muted-foreground text-xs">{formatBytes(b.sizeBytes)}</span>
                <span className="text-xs">{b.status}</span>
                <span className="text-muted-foreground text-xs">
                  {isVetraActor(b.requestedBy) ? (
                    'Vetra'
                  ) : (
                    <PersonName value={b.requestedBy} avatar />
                  )}
                </span>
                <span className="text-muted-foreground text-xs">
                  expires {formatTimestamp(b.expiresAt)}
                </span>
                {b.error && <span className="text-destructive text-xs">{b.error}</span>}
                {allowed && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto"
                    onClick={() => setRestoring(b)}
                  >
                    Restore
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {restoring && (
        <RestoreDialog
          appId={appId}
          instance={instance}
          backup={restoring}
          onClose={() => setRestoring(null)}
        />
      )}
    </div>
  )
}
