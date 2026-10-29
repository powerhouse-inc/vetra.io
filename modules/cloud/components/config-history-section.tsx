'use client'

import { History } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { AsyncButton } from '@/modules/cloud/components/async-button'
import { describeCloudError } from '@/modules/cloud/lib/cloud-error'
import {
  applyRestorePlan,
  deployedVersions,
  restorePlan,
  snapshotFromState,
  type DeployedVersion,
  type HistoryOperation,
  type RestoreActions,
  type RestorePlan,
} from '@/modules/cloud/lib/config-history'
import type { CloudEnvironmentState } from '@/modules/cloud/types'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/modules/shared/components/ui/alert-dialog'
import { Button } from '@/modules/shared/components/ui/button'
import { formatTimestamp, timeAgo } from '@/modules/shared/lib/time'

const PAGE = 8
const SUMMARY_LINES = 3

type Props = {
  /** Global operations of the env document; null when not loaded (signed out). */
  operations: readonly HistoryOperation[] | null
  /** Live document state: the restore plan starts from it. */
  current: CloudEnvironmentState
  actions: RestoreActions
  canEdit: boolean
  viewerAddress?: string | null
}

function shortAddress(addr: string) {
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr
}

/**
 * Past approved configurations of an environment, each restorable. A restore
 * only dispatches the config changes: they land as pending and the user
 * approves them through the env action bar like any other change.
 */
export function ConfigHistorySection({
  operations,
  current,
  actions,
  canEdit,
  viewerAddress,
}: Props) {
  // Not memoised: the controller grows its operations array in place, and
  // the fold is linear and cheap.
  const versions = operations ? deployedVersions(operations) : []
  const currentConfig = snapshotFromState(current)
  const [shown, setShown] = useState(PAGE)
  const [target, setTarget] = useState<{ version: DeployedVersion; plan: RestorePlan } | null>(null)

  const viewer = viewerAddress?.toLowerCase() ?? null

  const restore = async () => {
    if (!target) return
    try {
      await applyRestorePlan(target.plan.steps, actions)
      toast.success('Configuration restored as pending changes. Approve them to deploy.')
      setTarget(null)
    } catch (err) {
      const done = (err as { done?: number }).done ?? 0
      const base = describeCloudError(err, "Couldn't restore this configuration. Try again.")
      toast.error(
        done > 0 ? `${base} ${done} of ${target.plan.steps.length} changes were made.` : base,
      )
    }
  }

  return (
    <section className="space-y-3" aria-labelledby="config-history-heading">
      <div className="space-y-0.5">
        <h3 id="config-history-heading" className="flex items-center gap-1.5 text-sm font-medium">
          <History className="h-3.5 w-3.5" /> Configuration history
        </h3>
        <p className="text-muted-foreground text-xs">
          Each approved configuration. Restoring one does not restore variables or secrets.
        </p>
      </div>

      {operations === null ? (
        <p className="text-muted-foreground text-xs">Log in to see past configurations.</p>
      ) : versions.length === 0 ? (
        <p className="text-muted-foreground text-xs">No approved configurations yet.</p>
      ) : (
        <ol className="divide-border border-border divide-y rounded-md border">
          {versions.slice(0, shown).map((v) => {
            const plan = restorePlan(currentConfig, v.config)
            const isCurrent = plan.steps.length === 0
            const extra = v.changes.length - SUMMARY_LINES
            return (
              <li key={v.index} className="space-y-1.5 px-3 py-2.5 text-sm">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span title={v.time ? formatTimestamp(v.time) : undefined}>
                    {v.time ? timeAgo(v.time) : `Revision ${v.index}`}
                  </span>
                  {v.signer && (
                    <span className="text-muted-foreground font-mono text-xs">
                      {v.signer === viewer ? 'you' : shortAddress(v.signer)}
                    </span>
                  )}
                  {isCurrent && (
                    <span className="border-border text-muted-foreground rounded border px-1.5 text-xs">
                      Current
                    </span>
                  )}
                  {canEdit && !isCurrent && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-auto h-7 text-xs"
                      onClick={() => setTarget({ version: v, plan })}
                    >
                      Restore this configuration
                    </Button>
                  )}
                </div>
                {v.changes.length > 0 ? (
                  <ul className="text-muted-foreground space-y-0.5 text-xs">
                    {v.changes.slice(0, SUMMARY_LINES).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                    {extra > 0 && <li>and {extra} more</li>}
                  </ul>
                ) : (
                  <p className="text-muted-foreground text-xs">No config changes</p>
                )}
              </li>
            )
          })}
        </ol>
      )}

      {versions.length > shown && (
        <Button variant="ghost" size="sm" onClick={() => setShown((s) => s + PAGE)}>
          Show older
        </Button>
      )}

      <AlertDialog open={!!target} onOpenChange={(open) => !open && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore this configuration?</AlertDialogTitle>
            <AlertDialogDescription>
              These changes become pending. Approve them to deploy. Variables and secrets are not
              restored.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {target && (
            <ul
              aria-label="Changes to make"
              className="bg-muted max-h-64 space-y-1 overflow-y-auto rounded-md px-3 py-2 font-mono text-xs"
            >
              {target.plan.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AsyncButton
              size="sm"
              pendingLabel="Restoring…"
              onClickAsync={async (e) => {
                e.preventDefault()
                await restore()
              }}
            >
              Restore
            </AsyncButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
