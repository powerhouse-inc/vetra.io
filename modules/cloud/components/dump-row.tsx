'use client'

import { Clock, Database, Download, Loader2, RefreshCw, RotateCcw, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { AsyncButton } from '@/modules/cloud/components/async-button'
import { fmtBytes, timeAgo, timeUntil } from '@/modules/cloud/lib/time-format'
import type { DatabaseDump, DatabaseDumpStatus, DumpSource } from '@/modules/cloud/types'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/modules/shared/components/ui/alert-dialog'
import { Badge } from '@/modules/shared/components/ui/badge'
import { Button } from '@/modules/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

const PILL_BY_STATUS: Record<DatabaseDumpStatus, { label: string; cls: string }> = {
  PENDING: { label: 'PENDING', cls: 'bg-muted text-muted-foreground' },
  RUNNING: { label: 'RUNNING', cls: 'bg-info/15 text-info' },
  READY: { label: 'READY', cls: 'bg-success/15 text-success' },
  FAILED: { label: 'FAILED', cls: 'bg-destructive/15 text-destructive' },
}
const EXPIRED_PILL = { label: 'EXPIRED', cls: 'bg-muted text-muted-foreground' }

type Props = {
  dump: DatabaseDump
  onRetry?: () => void
  onCancel?: () => void
  isCancelling?: boolean
  onRestore?: () => Promise<void>
  /**
   * Override `dump.source` (useful when the caller already destructured it).
   * Falls back to `dump.source` when not provided.
   */
  source?: DumpSource | null
}

export function DumpRow({ dump, onRetry, onCancel, isCancelling, onRestore, source }: Props) {
  const effectiveSource = source ?? dump.source ?? null
  const [confirmOpen, setConfirmOpen] = useState(false)
  // eslint-disable-next-line react-hooks/purity
  const now = useMemo(() => Date.now(), [])
  const isExpired = new Date(dump.expiresAt).getTime() < now
  const isExpiredReady = isExpired && dump.status === 'READY'
  const pill = isExpiredReady ? EXPIRED_PILL : PILL_BY_STATUS[dump.status]
  const filename = `dump-${dump.id}.dump`
  const sizeStr = fmtBytes(dump.sizeBytes)

  return (
    <div className="bg-background/40 hover:bg-background/60 flex items-center gap-3 rounded-lg p-4 transition-colors">
      <div className="bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-md">
        {dump.status === 'RUNNING' ? (
          <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
        ) : isExpiredReady ? (
          <Clock className="text-muted-foreground h-4 w-4" />
        ) : (
          <Database className="text-muted-foreground h-4 w-4" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{filename}</span>
          {effectiveSource === 'SCHEDULED' && (
            <Badge size="xs" variant="secondary">
              auto
            </Badge>
          )}
          {effectiveSource === 'PRE_RESTORE' && (
            <Badge size="xs" variant="secondary">
              before restore
            </Badge>
          )}
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide',
              pill.cls,
            )}
          >
            {pill.label}
          </span>
        </div>
        <div className="text-muted-foreground mt-0.5 truncate text-xs">
          {dump.status === 'READY' && !isExpired && (
            <>
              {sizeStr && <>{sizeStr} · </>}
              {timeAgo(dump.completedAt ?? dump.requestedAt)} · expires in{' '}
              {timeUntil(dump.expiresAt)}
            </>
          )}
          {isExpiredReady && <>expired {timeAgo(dump.expiresAt)}</>}
          {dump.status === 'RUNNING' && (
            <>started {timeAgo(dump.startedAt ?? dump.requestedAt)} · saving backup</>
          )}
          {dump.status === 'PENDING' && <>requested {timeAgo(dump.requestedAt)}</>}
          {dump.status === 'FAILED' && (
            <>
              {timeAgo(dump.completedAt ?? dump.requestedAt)} ·{' '}
              {dump.errorMessage ?? 'unknown error'}
            </>
          )}
        </div>
        {dump.status === 'RUNNING' && (
          <div className="bg-muted mt-2 h-0.5 overflow-hidden rounded-full">
            <div className="bg-info h-full w-1/3 animate-pulse" />
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {dump.status === 'READY' && !isExpired && dump.downloadUrl && (
          <Button asChild size="sm">
            <a href={dump.downloadUrl} download={filename}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Download
            </a>
          </Button>
        )}
        {dump.status === 'READY' && !isExpired && onRestore && (
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="outline">
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Restore
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Restore this backup?</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-2">
                    <p>
                      The whole database is replaced with the contents of{' '}
                      <span className="font-mono">{filename}</span>. Everything written after this
                      backup is removed.
                    </p>
                    <ul className="list-disc space-y-1 pl-4">
                      <li>
                        A safety backup of the current data is taken first, so you can undo this by
                        restoring it.
                      </li>
                      <li>The Switchboard is offline for the duration of the restore.</li>
                      <li>
                        Packages and configuration are not rolled back. If a package update caused
                        the problem, roll the package back first.
                      </li>
                    </ul>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AsyncButton
                  variant="destructive"
                  size="sm"
                  pendingLabel="Restoring…"
                  onClickAsync={async (e) => {
                    e.preventDefault()
                    await onRestore()
                    setConfirmOpen(false)
                  }}
                >
                  Restore
                </AsyncButton>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        {dump.status === 'FAILED' && onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Retry
          </Button>
        )}
        {(dump.status === 'PENDING' || dump.status === 'RUNNING') && onCancel && (
          <Button size="sm" variant="outline" onClick={onCancel} disabled={isCancelling}>
            <X className="mr-1.5 h-3.5 w-3.5" />
            {isCancelling ? 'Cancelling…' : 'Cancel'}
          </Button>
        )}
      </div>
    </div>
  )
}
