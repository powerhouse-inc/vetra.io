'use client'

import { ArrowLeft, ChevronRight, Loader2, Rocket } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import {
  EmptyState,
  TabError,
  TabHeader,
  TabSkeleton,
} from '@/modules/publisher/components/primitives'
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
import { PersonName } from '@/modules/shared/components/person-name'
import { Button } from '@/modules/shared/components/ui/button'
import { Checkbox } from '@/modules/shared/components/ui/checkbox'
import { formatTimestamp, timeAgo } from '@/modules/shared/lib/time'
import { cn } from '@/shared/lib/utils'

import { describeAppsError } from '../graphql'
import {
  useAppInstances,
  useAppPlans,
  useAppReleases,
  useAppRollouts,
  useControlRollout,
  useControlRolloutStep,
} from '../hooks/use-apps'
import { RELEASES_MORE_LIMIT } from '../lib/releases'
import {
  ROLLOUT_STATUS_CLASS,
  ROLLOUT_STATUS_LABEL,
  STEP_STATUS_CLASS,
  STEP_STATUS_LABEL,
  isRolloutLive,
  isVetraActor,
  rollbackLosesData,
  rolloutControls,
  stepActions,
} from '../lib/rollouts'
import type { AppRollout, AppRolloutStep } from '../types'
import { MarkdownLite } from './profile/markdown-lite'
import { RolloutDialog } from './rollout-dialog'

/** Someone who started or rolled back a rollout: a person by Renown name, or Vetra. */
function Actor({ who }: { who: string }) {
  return isVetraActor(who) ? <span>Vetra (policy)</span> : <PersonName value={who} avatar />
}

function StatusBadge({ rollout }: { rollout: AppRollout }) {
  return (
    <span
      className={cn(
        'shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium tracking-wide uppercase',
        ROLLOUT_STATUS_CLASS[rollout.status] ?? ROLLOUT_STATUS_CLASS.cancelled,
      )}
    >
      {ROLLOUT_STATUS_LABEL[rollout.status] ?? rollout.status}
    </span>
  )
}

function ActionError({ error }: { error: unknown }) {
  if (!error) return null
  return (
    <p role="alert" className="text-destructive text-sm">
      {describeAppsError(error)}
    </p>
  )
}

/** What the rollback would do, per instance; asks to accept data loss for a migrating release. */
function RollBackDialog({
  appId,
  rollout,
  losesData,
  open,
  onOpenChange,
}: {
  appId: string
  rollout: AppRollout
  losesData: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const control = useControlRollout(appId)
  const [accepted, setAccepted] = useState(false)
  const moved = rollout.steps.filter((s) =>
    ['succeeded', 'failed', 'applying', 'backing_up', 'restoring'].includes(s.status),
  )
  const close = (o: boolean) => {
    if (!o) {
      control.reset()
      setAccepted(false)
    }
    onOpenChange(o)
  }
  return (
    <AlertDialog open={open} onOpenChange={close}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Roll back {rollout.version}?</AlertDialogTitle>
          <AlertDialogDescription>
            The plans go back to their previous release and these instances follow, one at a time.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {moved.length === 0 ? (
          <p className="text-muted-foreground text-sm">No instance has moved yet.</p>
        ) : (
          <ul className="border-border divide-border divide-y rounded-md border text-sm">
            {moved.map((s) => (
              <li key={s.id} className="flex flex-wrap justify-between gap-2 px-3 py-2">
                <span>{s.instanceName}</span>
                <span className="text-muted-foreground text-xs">
                  {losesData
                    ? s.backupId
                      ? 'restores its backup from before the update'
                      : 'image only (no backup)'
                    : 'image only'}
                </span>
              </li>
            ))}
          </ul>
        )}
        {losesData && (
          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={accepted}
              onCheckedChange={(v) => setAccepted(v === true)}
              className="mt-0.5"
            />
            <span>
              Data written since each backup is lost. I understand this release migrates data and
              accept the data loss.
            </span>
          </label>
        )}
        <ActionError error={control.error} />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={control.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={control.isPending || (losesData && !accepted)}
            onClick={(e) => {
              e.preventDefault()
              control.mutate(
                { action: 'rollBackRollout', rolloutId: rollout.id, acceptDataLoss: accepted },
                {
                  onSuccess: () => {
                    toast.success(`Rolling ${rollout.version} back`)
                    close(false)
                  },
                },
              )
            }}
          >
            {control.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Roll back
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function StepRow({
  step,
  holder,
  live,
  onAct,
  busy,
}: {
  step: AppRolloutStep
  holder: string | null
  live: boolean
  onAct: (action: 'retryRolloutStep' | 'skipRolloutStep') => void
  busy: boolean
}) {
  const actions = stepActions(step, live)
  return (
    <li
      data-testid={`step-${step.id}`}
      className="flex flex-wrap items-center gap-x-5 gap-y-1 px-4 py-3 text-sm"
    >
      <span className="text-muted-foreground w-5 text-xs">{step.position + 1}.</span>
      <span className="flex min-w-0 flex-wrap items-center gap-x-2">
        <span className="font-medium">{step.instanceName}</span>
        {holder && <PersonName value={holder} avatar className="text-muted-foreground text-xs" />}
      </span>
      <span className="font-mono text-xs">
        {step.fromVersion ? `${step.fromVersion} → ${step.toVersion}` : `→ ${step.toVersion}`}
      </span>
      <span
        className={cn(
          'shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium tracking-wide uppercase',
          STEP_STATUS_CLASS[step.status] ?? STEP_STATUS_CLASS.pending,
        )}
      >
        {STEP_STATUS_LABEL[step.status] ?? step.status}
      </span>
      {step.status === 'pending' && (
        <span
          className="text-muted-foreground text-xs"
          title="Not before; the plan's window applies"
        >
          due {formatTimestamp(step.dueAt)}
        </span>
      )}
      {step.finishedAt && (
        <span className="text-muted-foreground text-xs" title={formatTimestamp(step.finishedAt)}>
          {timeAgo(step.finishedAt)}
        </span>
      )}
      {step.backupId && (
        <span className="text-muted-foreground text-xs" title={step.backupId}>
          backed up first
        </span>
      )}
      {step.note && <span className="text-muted-foreground text-xs">{step.note}</span>}
      {step.error && <span className="text-destructive text-xs">{step.error}</span>}
      {(actions.retry || actions.skip) && (
        <span className="ml-auto flex gap-2">
          {actions.retry && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => onAct('retryRolloutStep')}
            >
              Retry
            </Button>
          )}
          {actions.skip && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => onAct('skipRolloutStep')}
            >
              Skip
            </Button>
          )}
        </span>
      )}
    </li>
  )
}

/** One rollout: who started it, the steps as a timeline, and the controls. */
export function RolloutView({
  appId,
  rollout,
  canRelease,
  onBack,
}: {
  appId: string
  rollout: AppRollout
  canRelease: boolean
  onBack: () => void
}) {
  const instances = useAppInstances(appId)
  const releases = useAppReleases(appId, 'release', RELEASES_MORE_LIMIT)
  const control = useControlRollout(appId)
  const stepControl = useControlRolloutStep(appId)
  const [rollBack, setRollBack] = useState(false)
  const controls = rolloutControls(rollout)
  const live = isRolloutLive(rollout)
  const holderOf = (instanceId: string) =>
    instances.data?.find((i) => i.id === instanceId)?.holder ?? null
  const run = (action: 'pauseRollout' | 'resumeRollout' | 'cancelRollout') =>
    control.mutate({ action, rolloutId: rollout.id })

  return (
    <div className="space-y-5" data-testid={`rollout-${rollout.id}`}>
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" aria-hidden />
        All rollouts
      </Button>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-mono text-xl font-semibold">
          {rollout.direction === 'back' ? 'Back to ' : ''}
          {rollout.version}
        </h2>
        <StatusBadge rollout={rollout} />
      </div>
      <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-sm">
        <span>Started by</span>
        <Actor who={rollout.startedBy} />
        <span title={formatTimestamp(rollout.startedAt)}>{timeAgo(rollout.startedAt)}</span>
        {rollout.rolledBackBy && (
          <>
            <span>· rolled back by</span>
            <Actor who={rollout.rolledBackBy} />
          </>
        )}
      </p>
      {rollout.status === 'paused' && (
        <div
          role="alert"
          className="border-warning/40 bg-warning/10 text-warning rounded-md border px-4 py-2 text-sm"
        >
          Paused{rollout.pausedReason ? `: ${rollout.pausedReason}` : '.'}
          {controls.resumeBlocked && ' A step failed: retry or skip it before resuming.'}
        </div>
      )}
      {rollout.notes && (
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            What holders were told
          </p>
          <MarkdownLite text={rollout.notes} className="text-sm" />
        </div>
      )}
      {canRelease &&
        (controls.pause || controls.resume || controls.cancel || controls.rollBack) && (
          <div className="flex flex-wrap gap-2">
            {controls.pause && (
              <Button
                variant="outline"
                disabled={control.isPending}
                onClick={() => run('pauseRollout')}
              >
                Pause
              </Button>
            )}
            {controls.resume && (
              <Button
                variant="outline"
                disabled={control.isPending || controls.resumeBlocked}
                onClick={() => run('resumeRollout')}
              >
                Resume
              </Button>
            )}
            {controls.cancel && (
              <Button
                variant="outline"
                disabled={control.isPending}
                onClick={() => run('cancelRollout')}
              >
                Cancel rollout
              </Button>
            )}
            {controls.rollBack && (
              <Button variant="outline" onClick={() => setRollBack(true)}>
                Roll back
              </Button>
            )}
          </div>
        )}
      <ActionError error={control.error ?? stepControl.error} />
      {rollout.steps.length === 0 ? (
        <p className="text-muted-foreground text-sm">No instance moves in this rollout.</p>
      ) : (
        <ol className="bg-card border-border divide-border divide-y overflow-hidden rounded-xl border shadow-sm">
          {[...rollout.steps]
            .sort((a, b) => a.position - b.position)
            .map((s) => (
              <StepRow
                key={s.id}
                step={s}
                holder={holderOf(s.instanceId)}
                live={live && canRelease}
                busy={stepControl.isPending}
                onAct={(action) => stepControl.mutate({ action, stepId: s.id })}
              />
            ))}
        </ol>
      )}
      <RollBackDialog
        key={rollout.id + String(rollBack)}
        appId={appId}
        rollout={rollout}
        losesData={rollbackLosesData(rollout, releases.data)}
        open={rollBack}
        onOpenChange={setRollBack}
      />
    </div>
  )
}

/** Rollouts tab: the App's rollouts, newest first, with "Roll out" and a view per rollout. */
export function AppRollouts({ appId, canRelease = true }: { appId: string; canRelease?: boolean }) {
  const rollouts = useAppRollouts(appId)
  const plans = useAppPlans(appId)
  const [selected, setSelected] = useState<string | null>(null)
  const [dialog, setDialog] = useState(false)
  const list = rollouts.data ?? []
  const current = selected ? list.find((r) => r.id === selected) : undefined
  const planName = (id: string) => plans.data?.find((p) => p.id === id)?.name ?? 'Plan'

  if (current) {
    return (
      <RolloutView
        appId={appId}
        rollout={current}
        canRelease={canRelease}
        onBack={() => setSelected(null)}
      />
    )
  }
  return (
    <div className="space-y-6">
      <TabHeader
        title="Rollouts"
        description="Moves of plans to a release, one instance at a time. Pause, cancel or roll one back while it runs."
        action={canRelease ? <Button onClick={() => setDialog(true)}>Roll out</Button> : undefined}
      />
      {rollouts.isPending ? (
        <TabSkeleton label="Loading rollouts" />
      ) : rollouts.error ? (
        <TabError
          error={new Error(describeAppsError(rollouts.error))}
          onRetry={() => void rollouts.refetch()}
          retrying={rollouts.isRefetching}
        />
      ) : list.length === 0 ? (
        <EmptyState icon={Rocket} title="No rollouts yet">
          Start one with Roll out to move a plan&apos;s instances to a release.
        </EmptyState>
      ) : (
        <ul className="bg-card border-border divide-border divide-y overflow-hidden rounded-xl border shadow-sm">
          {list.map((r) => (
            <li key={r.id} data-testid={`rollout-row-${r.id}`}>
              <button
                type="button"
                onClick={() => setSelected(r.id)}
                className="hover:bg-accent/40 flex w-full flex-wrap items-center gap-x-5 gap-y-1 px-4 py-3 text-left text-sm"
              >
                <span className="font-mono font-medium">
                  {r.direction === 'back' ? 'Back to ' : ''}
                  {r.version}
                </span>
                <StatusBadge rollout={r} />
                <span className="text-muted-foreground text-xs">
                  {r.plans.map((p) => planName(p.planId)).join(', ')}
                </span>
                <span className="text-muted-foreground text-xs">
                  {r.steps.filter((s) => s.status === 'succeeded').length}/{r.steps.length} done
                </span>
                <span className="text-muted-foreground ml-auto text-xs">
                  <Actor who={r.startedBy} /> · {timeAgo(r.startedAt)}
                </span>
                <ChevronRight className="text-muted-foreground h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      {canRelease && (
        <RolloutDialog
          appId={appId}
          open={dialog}
          onOpenChange={setDialog}
          onStarted={(r) => setSelected(r.id)}
        />
      )}
    </div>
  )
}
