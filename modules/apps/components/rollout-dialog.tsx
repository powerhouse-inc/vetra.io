'use client'

import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/modules/shared/components/ui/button'
import { Checkbox } from '@/modules/shared/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/modules/shared/components/ui/dialog'
import { Input } from '@/modules/shared/components/ui/input'
import { Label } from '@/modules/shared/components/ui/label'
import { Skeleton } from '@/modules/shared/components/ui/skeleton'
import { formatTimestamp } from '@/modules/shared/lib/time'

import { describeAppsError } from '../graphql'
import { useAppPlans, useAppReleases, useCheckRollout, useStartRollout } from '../hooks/use-apps'
import { rollableReleases } from '../lib/rollouts'
import { RELEASES_MORE_LIMIT } from '../lib/releases'
import type { AppPlan, AppRollout } from '../types'

const SELECT_CLASS =
  'border-input bg-background focus-visible:ring-ring h-9 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none'

/** The plans a rollout can move: active, with a licensing term or the Team plan. */
const rollablePlans = (plans: AppPlan[] | undefined): AppPlan[] =>
  (plans ?? []).filter((p) => p.status === 'active')

function RolloutForm({
  appId,
  initialPlanId,
  initialVersion,
  onClose,
  onStarted,
}: {
  appId: string
  initialPlanId: string | null
  initialVersion: string | null
  onClose: () => void
  onStarted?: (rollout: AppRollout) => void
}) {
  const plans = useAppPlans(appId)
  const releases = useAppReleases(appId, 'release', RELEASES_MORE_LIMIT)
  const start = useStartRollout(appId)
  const versions = rollableReleases(releases.data)
  const [version, setVersion] = useState(initialVersion ?? '')
  const [picked, setPicked] = useState<string[]>(initialPlanId ? [initialPlanId] : [])
  const [notice, setNotice] = useState('')

  const list = rollablePlans(plans.data)
  const noticeHours = notice.trim() === '' ? null : Number(notice)
  const noticeValid = noticeHours === null || (Number.isInteger(noticeHours) && noticeHours >= 0)
  const check = useCheckRollout(
    appId,
    version,
    picked,
    noticeValid ? noticeHours : null,
    noticeValid,
  )

  const toggle = (id: string, on: boolean) =>
    setPicked((p) => (on ? [...p, id] : p.filter((x) => x !== id)))
  const nameOf = (id: string) => list.find((p) => p.id === id)?.name ?? 'Plan'

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (!check.data?.ok) return
        start.mutate(
          { version, planIds: picked, noticeHours: noticeValid ? noticeHours : null },
          {
            onSuccess: (rollout) => {
              toast.success(`Rolling out ${rollout.version}`)
              onStarted?.(rollout)
              onClose()
            },
          },
        )
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="rollout-version">Release</Label>
        {releases.isPending ? (
          <Skeleton className="h-9 w-full" />
        ) : versions.length === 0 ? (
          <p className="text-muted-foreground text-sm">This app has no release to roll out yet.</p>
        ) : (
          <select
            id="rollout-version"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            className={SELECT_CLASS}
          >
            <option value="">Pick a release</option>
            {versions.map((r) => (
              <option key={r.version} value={r.version}>
                {r.version}
                {r.migrates ? ' (migrates data)' : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">Plans</legend>
        {plans.isPending ? (
          <Skeleton className="h-9 w-full" />
        ) : list.length === 0 ? (
          <p className="text-muted-foreground text-sm">No active plans run instances.</p>
        ) : (
          list.map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={picked.includes(p.id)}
                onCheckedChange={(v) => toggle(p.id, v === true)}
                aria-label={p.name}
              />
              <span>{p.name}</span>
              <span className="text-muted-foreground font-mono text-xs">
                {p.targetVersion ?? 'no target'}
              </span>
            </label>
          ))
        )}
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="rollout-notice">Notice in hours</Label>
        <Input
          id="rollout-notice"
          inputMode="numeric"
          value={notice}
          onChange={(e) => setNotice(e.target.value)}
          placeholder="Each plan's own notice"
          aria-invalid={!noticeValid}
        />
        {!noticeValid && (
          <p role="alert" className="text-destructive text-xs">
            Enter a whole number of hours, or leave it empty.
          </p>
        )}
      </div>

      {version && picked.length > 0 && (
        <section aria-label="What would happen" className="space-y-2">
          <h3 className="text-sm font-medium">What would happen</h3>
          {check.isPending || check.isFetching ? (
            <Skeleton className="h-16 w-full" />
          ) : check.error ? (
            <p role="alert" className="text-destructive text-sm">
              {describeAppsError(check.error)}
            </p>
          ) : check.data ? (
            <>
              {check.data.problems.length > 0 && (
                <ul
                  role="alert"
                  className="border-destructive/40 bg-destructive/10 text-destructive list-disc space-y-1 rounded-md border px-6 py-2 text-sm"
                >
                  {check.data.problems.map((problem) => (
                    <li key={problem}>{problem}</li>
                  ))}
                </ul>
              )}
              {check.data.steps.length === 0 ? (
                <p className="text-muted-foreground text-sm">No instance would move.</p>
              ) : (
                <ol className="border-border divide-border divide-y rounded-md border text-sm">
                  {check.data.steps.map((s, i) => (
                    <li
                      key={s.instanceId}
                      data-testid={`check-step-${s.instanceId}`}
                      className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-3 py-2"
                    >
                      <span className="text-muted-foreground w-5 text-xs">{i + 1}.</span>
                      <span className="font-medium">{s.instanceName}</span>
                      <span className="text-muted-foreground text-xs">
                        {nameOf(s.planId)} · {s.instanceKind}
                      </span>
                      {s.status === 'skipped' ? (
                        <span className="text-muted-foreground text-xs">
                          skipped{s.note ? `: ${s.note}` : ''}
                        </span>
                      ) : (
                        <>
                          <span className="font-mono text-xs">
                            {s.fromVersion ? `${s.fromVersion} → ${version}` : `→ ${version}`}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            due {formatTimestamp(s.dueAt)}
                          </span>
                          {s.note && (
                            <span className="text-muted-foreground text-xs">{s.note}</span>
                          )}
                        </>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </>
          ) : null}
        </section>
      )}

      {start.error && (
        <p role="alert" className="text-destructive text-sm">
          {describeAppsError(start.error)}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={!check.data?.ok || check.isFetching || start.isPending}>
          {start.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Start rollout
        </Button>
      </DialogFooter>
    </form>
  )
}

/**
 * Roll out: pick a release and plans, see what `checkRollout` says (the instances in order, when
 * each is due, every problem), and start it only when the check passes.
 */
export function RolloutDialog({
  appId,
  open,
  onOpenChange,
  initialPlanId = null,
  initialVersion = null,
  onStarted,
}: {
  appId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The plan whose button was clicked: ticked to begin with. */
  initialPlanId?: string | null
  initialVersion?: string | null
  onStarted?: (rollout: AppRollout) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Roll out a release</DialogTitle>
          <DialogDescription>
            Instances move one at a time, shared ones first. Holders are told ahead of time; each
            plan&apos;s update window applies after the notice.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <RolloutForm
            appId={appId}
            initialPlanId={initialPlanId}
            initialVersion={initialVersion}
            onClose={() => onOpenChange(false)}
            onStarted={onStarted}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
