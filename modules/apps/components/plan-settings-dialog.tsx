'use client'

import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/modules/shared/components/ui/button'
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
import { cn } from '@/shared/lib/utils'

import { describeAppsError } from '../graphql'
import { useUpdateAppPlan } from '../hooks/use-apps'
import {
  WEEKDAYS,
  browserTimeZone,
  followBranch,
  timeZones,
  warmCostEstimate,
} from '../lib/rollouts'
import type { AppPlan, PlanUpdateWindow } from '../types'

const SELECT_CLASS =
  'border-input bg-background focus-visible:ring-ring h-9 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none'

const MAX_WARM = 10

type PolicyKind = 'manual' | 'patches' | 'minor' | 'follow'

const policyKind = (policy: string): PolicyKind =>
  followBranch(policy) !== null
    ? 'follow'
    : policy === 'patches' || policy === 'minor'
      ? policy
      : 'manual'

const POLICY_HINT: Record<PolicyKind, string> = {
  manual: 'Nothing rolls out by itself; start each rollout yourself.',
  patches: 'New patch releases roll out by themselves (stable releases only).',
  minor: 'New minor and patch releases roll out by themselves (stable releases only).',
  follow: 'Every release on a branch rolls out by itself.',
}

function SettingsForm({
  appId,
  plan,
  releaseBranches,
  onClose,
}: {
  appId: string
  plan: AppPlan
  releaseBranches: string[]
  onClose: () => void
}) {
  const update = useUpdateAppPlan(appId)
  const [kind, setKind] = useState<PolicyKind>(policyKind(plan.policy))
  const [branch, setBranch] = useState(followBranch(plan.policy) ?? releaseBranches[0] ?? '')
  const [notice, setNotice] = useState(String(plan.noticeHours))
  const [windowOn, setWindowOn] = useState(!!plan.updateWindow)
  const [days, setDays] = useState<number[]>(plan.updateWindow?.days ?? [1, 2, 3, 4, 5])
  const [start, setStart] = useState(plan.updateWindow?.start ?? '02:00')
  const [end, setEnd] = useState(plan.updateWindow?.end ?? '04:00')
  const [zone, setZone] = useState(plan.updateWindow?.timeZone ?? browserTimeZone())
  const [ai, setAi] = useState(plan.aiBudgetUsd != null ? String(plan.aiBudgetUsd) : '')
  const [warm, setWarm] = useState(plan.warmPoolSize ?? 0)

  const isOwn = plan.access === 'own'
  const noticeN = Number(notice)
  const noticeOk = notice.trim() !== '' && Number.isInteger(noticeN) && noticeN >= 0
  const aiN = ai.trim() === '' ? null : Number(ai)
  const aiOk = aiN === null || (Number.isFinite(aiN) && aiN > 0 && aiN <= 1000)
  const timeOk = /^\d\d:\d\d$/.test(start) && /^\d\d:\d\d$/.test(end)
  const windowOk = !windowOn || (days.length > 0 && timeOk)
  const policy = kind === 'follow' ? `follow:${branch}` : kind
  const policyOk = kind !== 'follow' || branch.trim() !== ''
  const valid = noticeOk && aiOk && windowOk && policyOk
  const branches =
    branch && !releaseBranches.includes(branch) ? [branch, ...releaseBranches] : releaseBranches
  const zones = timeZones()
  const cost = isOwn ? warmCostEstimate(plan, warm) : null

  const submit = () => {
    const w: PlanUpdateWindow | null = windowOn
      ? { days: [...days].sort(), start, end, timeZone: zone }
      : null
    update.mutate(
      {
        planId: plan.id,
        policy,
        noticeHours: noticeN,
        ...(w ? { updateWindow: w } : plan.updateWindow ? { clearUpdateWindow: true } : {}),
        ...(aiN !== null || plan.aiBudgetUsd != null ? { aiBudgetUsd: aiN } : {}),
        ...(isOwn && plan.warmPoolSize !== undefined ? { warmPoolSize: warm } : {}),
      },
      {
        onSuccess: () => {
          toast.success(`${plan.name} saved`)
          onClose()
        },
      },
    )
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) submit()
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="plan-policy">New releases</Label>
        <select
          id="plan-policy"
          value={kind}
          onChange={(e) => setKind(e.target.value as PolicyKind)}
          className={SELECT_CLASS}
        >
          <option value="manual">Manual</option>
          <option value="patches">Patches roll out by themselves</option>
          <option value="minor">Minor releases roll out by themselves</option>
          <option value="follow">Follow a release branch</option>
        </select>
        <p className="text-muted-foreground text-xs">{POLICY_HINT[kind]}</p>
        {kind === 'follow' && (
          <select
            aria-label="Release branch"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            className={SELECT_CLASS}
          >
            {branches.length === 0 && <option value="">No release branches</option>}
            {branches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="plan-notice">Notice in hours</Label>
        <Input
          id="plan-notice"
          inputMode="numeric"
          value={notice}
          onChange={(e) => setNotice(e.target.value)}
          aria-invalid={!noticeOk}
        />
        <p className="text-muted-foreground text-xs">How long holders are told before an update.</p>
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">Update window</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={windowOn}
            onChange={(e) => setWindowOn(e.target.checked)}
          />
          Only update inside a window
        </label>
        {windowOn && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Weekdays">
              {WEEKDAYS.map((d) => (
                <button
                  key={d.n}
                  type="button"
                  aria-pressed={days.includes(d.n)}
                  onClick={() =>
                    setDays((cur) =>
                      cur.includes(d.n) ? cur.filter((x) => x !== d.n) : [...cur, d.n],
                    )
                  }
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs',
                    days.includes(d.n)
                      ? 'bg-accent text-foreground border-transparent'
                      : 'text-muted-foreground',
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="plan-window-start">Start</Label>
                <Input
                  id="plan-window-start"
                  type="time"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="plan-window-end">End</Label>
                <Input
                  id="plan-window-end"
                  type="time"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="plan-window-zone">Time zone</Label>
              <select
                id="plan-window-zone"
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                className={SELECT_CLASS}
              >
                {(zones.includes(zone) ? zones : [zone, ...zones]).map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
              <p className="text-muted-foreground text-xs">
                An end at or before the start runs past midnight; equal times mean the whole day.
              </p>
            </div>
          </div>
        )}
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="plan-ai">AI budget per instance (USD / month)</Label>
        <Input
          id="plan-ai"
          inputMode="decimal"
          value={ai}
          onChange={(e) => setAi(e.target.value)}
          placeholder="No AI key"
          aria-invalid={!aiOk}
        />
        <p className="text-muted-foreground text-xs">
          Every instance gets its own AI key capped at this budget. Leave empty for none (up to
          1000).
        </p>
      </div>

      {isOwn && (
        <div className="space-y-2">
          <Label htmlFor="plan-warm">Warm instances</Label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Fewer warm instances"
              disabled={warm <= 0}
              onClick={() => setWarm((w) => Math.max(0, w - 1))}
            >
              -
            </Button>
            <Input
              id="plan-warm"
              className="w-16 text-center"
              inputMode="numeric"
              value={warm}
              onChange={(e) => {
                const n = Number(e.target.value)
                if (Number.isInteger(n)) setWarm(Math.min(MAX_WARM, Math.max(0, n)))
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="More warm instances"
              disabled={warm >= MAX_WARM}
              onClick={() => setWarm((w) => Math.min(MAX_WARM, w + 1))}
            >
              +
            </Button>
            <span className="text-muted-foreground text-sm">
              {cost !== null ? `≈ €${cost} / month while idle` : 'Estimate after saving'}
            </span>
          </div>
          <p className="text-muted-foreground text-xs">
            New holders get one of these at once instead of waiting for a new instance. They run on
            the plan&apos;s release and are replaced when it changes.
            {plan.warmPoolEffective !== undefined &&
              ` ${plan.warmReady ?? 0} of ${plan.warmPoolEffective} ready.`}
            {plan.warmPoolSize !== undefined &&
              plan.warmPoolEffective !== undefined &&
              plan.warmPoolEffective < plan.warmPoolSize &&
              ` Vetra keeps at most ${plan.warmPoolEffective}.`}
          </p>
        </div>
      )}

      {update.error && (
        <p role="alert" className="text-destructive text-sm">
          {describeAppsError(update.error)}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={!valid || update.isPending}>
          {update.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Save
        </Button>
      </DialogFooter>
    </form>
  )
}

/** A plan's rollout policy, notice, update window, AI budget and (own plans) warm pool. */
export function PlanSettingsDialog({
  appId,
  plan,
  releaseBranches,
  open,
  onOpenChange,
}: {
  appId: string
  plan: AppPlan
  /** The App's release branches (and its production branch) a plan may follow. */
  releaseBranches: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{plan.name} settings</DialogTitle>
          <DialogDescription>
            When new releases roll out, how much notice holders get, and what each instance may use.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <SettingsForm
            appId={appId}
            plan={plan}
            releaseBranches={releaseBranches}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
