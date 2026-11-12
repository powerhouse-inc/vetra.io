'use client'

import { Loader2, Server } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/modules/shared/components/ui/dialog'
import { Label } from '@/modules/shared/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/modules/shared/components/ui/radio-group'
import { Skeleton } from '@/modules/shared/components/ui/skeleton'
import { cn } from '@/shared/lib/utils'

import { describeAppsError, isAppsError } from '../graphql'
import {
  useAppInstances,
  useAppPlans,
  useAppReleases,
  useCreateAppPlan,
  useRetireAppPlan,
  useSetAppPlanTarget,
  useUpdateAppPlan,
} from '../hooks/use-apps'
import {
  ACCESS_HINT,
  ACCESS_LABEL,
  instanceCountText,
  isPlanSize,
  planForKind,
  planInstances,
  releaseVersions,
  sizeLabel,
} from '../lib/plans'
import { RELEASES_MORE_LIMIT } from '../lib/releases'
import { APP_PLAN_SIZES, type AppPlan, type AppPlanAccess, type AppPlanSize } from '../types'

/** The licensing term a plan adopts: its plan ID (kind) and how many hold it. */
export type InstancesTerm = { kind: string; name: string; activeLicenses: number }

const SELECT_CLASS =
  'border-input bg-background focus-visible:ring-ring h-9 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none'

function InlineError({ error }: { error: unknown }) {
  if (!error) return null
  return (
    <p role="alert" className="text-destructive text-sm">
      {describeAppsError(error)}
    </p>
  )
}

function SizeSelect({
  value,
  onChange,
  id,
}: {
  value: AppPlanSize
  onChange: (v: AppPlanSize) => void
  id: string
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => isPlanSize(e.target.value) && onChange(e.target.value)}
      className={SELECT_CLASS}
    >
      {APP_PLAN_SIZES.map((s) => (
        <option key={s} value={s}>
          {sizeLabel(s)}
        </option>
      ))}
    </select>
  )
}

/** The App's releases (never builds) to target; loads while the dialog is open. */
function ReleaseSelect({
  appId,
  value,
  onChange,
  id,
  open,
}: {
  appId: string
  value: string
  onChange: (v: string) => void
  id: string
  open: boolean
}) {
  const releases = useAppReleases(appId, 'release', RELEASES_MORE_LIMIT, open)
  const versions = releaseVersions(releases.data)
  if (releases.isPending) return <Skeleton className="h-9 w-full" />
  if (releases.error) return <InlineError error={releases.error} />
  if (versions.length === 0)
    return (
      <p className="text-muted-foreground text-sm">
        This app has no releases yet. Instances start once the plan targets one.
      </p>
    )
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={SELECT_CLASS}
    >
      <option value="">Pick a release</option>
      {versions.map((v) => (
        <option key={v} value={v}>
          {v}
        </option>
      ))}
    </select>
  )
}

export function RunInstancesDialog({
  appId,
  term,
  open,
  onOpenChange,
}: {
  appId: string
  term: InstancesTerm
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const create = useCreateAppPlan(appId)
  const [access, setAccess] = useState<AppPlanAccess>('shared')
  const [size, setSize] = useState<AppPlanSize>('VETRA_AGENT_S')
  const [target, setTarget] = useState('')

  const submit = () => {
    create.mutate(
      { kind: term.kind, name: term.name, access, size, targetVersion: target || null },
      {
        onSuccess: () => {
          toast.success(`${term.name} runs instances now`)
          onOpenChange(false)
        },
      },
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) create.reset()
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Run instances for {term.name}</DialogTitle>
          <DialogDescription>
            Vetra runs this app for everyone holding this plan. Choose it before anyone gets a
            licence: a plan that was ever handed out cannot start running instances.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <fieldset className="space-y-2" disabled={create.isPending}>
            <legend className="mb-2 text-sm font-medium">Access</legend>
            <RadioGroup
              value={access}
              onValueChange={(v) => setAccess(v as AppPlanAccess)}
              className="gap-2"
            >
              {(['shared', 'own'] as const).map((a) => (
                <label
                  key={a}
                  htmlFor={`plan-access-${a}`}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm"
                >
                  <RadioGroupItem id={`plan-access-${a}`} value={a} className="mt-0.5" />
                  <span className="space-y-0.5">
                    <span className="block font-medium">{ACCESS_LABEL[a]}</span>
                    <span className="text-muted-foreground block text-xs">{ACCESS_HINT[a]}</span>
                  </span>
                </label>
              ))}
            </RadioGroup>
          </fieldset>
          <div className="space-y-2">
            <Label htmlFor="plan-size">Size</Label>
            <SizeSelect id="plan-size" value={size} onChange={setSize} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="plan-target">Target release</Label>
            <ReleaseSelect
              appId={appId}
              id="plan-target"
              value={target}
              onChange={setTarget}
              open={open}
            />
          </div>
          <InlineError error={create.error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Run instances
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function PlanTargetDialog({
  appId,
  plan,
  open,
  onOpenChange,
}: {
  appId: string
  plan: AppPlan
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const setTargetMutation = useSetAppPlanTarget(appId)
  const [target, setTarget] = useState(plan.targetVersion ?? '')
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setTargetMutation.reset()
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change target release</DialogTitle>
          <DialogDescription>
            Every instance of {plan.name} moves to this release on the next pass, without notice.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!target) return
            setTargetMutation.mutate(
              { planId: plan.id, version: target },
              {
                onSuccess: () => {
                  toast.success(`${plan.name} targets ${target}`)
                  onOpenChange(false)
                },
              },
            )
          }}
        >
          <div className="space-y-2">
            <Label htmlFor={`plan-target-${plan.id}`}>Target release</Label>
            <ReleaseSelect
              appId={appId}
              id={`plan-target-${plan.id}`}
              value={target}
              onChange={setTarget}
              open={open}
            />
          </div>
          <InlineError error={setTargetMutation.error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!target || target === plan.targetVersion || setTargetMutation.isPending}
            >
              {setTargetMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Move instances
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function PlanSizeDialog({
  appId,
  plan,
  open,
  onOpenChange,
}: {
  appId: string
  plan: AppPlan
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const update = useUpdateAppPlan(appId)
  const [size, setSize] = useState<AppPlanSize>(plan.size)
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) update.reset()
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change size</DialogTitle>
          <DialogDescription>
            The instances of {plan.name} restart at the new size.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            update.mutate(
              { planId: plan.id, size },
              {
                onSuccess: () => {
                  toast.success(`${plan.name} runs at size ${sizeLabel(size)}`)
                  onOpenChange(false)
                },
              },
            )
          }}
        >
          <div className="space-y-2">
            <Label htmlFor={`plan-size-${plan.id}`}>Size</Label>
            <SizeSelect id={`plan-size-${plan.id}`} value={size} onChange={setSize} />
          </div>
          <InlineError error={update.error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={size === plan.size || update.isPending}>
              {update.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save size
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function RetirePlanDialog({
  appId,
  plan,
  open,
  onOpenChange,
}: {
  appId: string
  plan: AppPlan
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const retire = useRetireAppPlan(appId)
  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) retire.reset()
        onOpenChange(o)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Stop new instances for {plan.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            The plan is retired: nobody new gets an instance, and it cannot run instances again.
            Existing holders keep theirs. Retire the plan itself too, so no new licences are handed
            out.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <InlineError error={retire.error} />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={retire.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={retire.isPending}
            onClick={(e) => {
              e.preventDefault()
              retire.mutate(plan.id, {
                onSuccess: () => {
                  toast.success(`${plan.name} retired`)
                  onOpenChange(false)
                },
              })
            }}
          >
            Retire instances
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

type OpenDialog = 'run' | 'target' | 'size' | 'retire' | null

/**
 * The "Instances" area of a licensing term's card: run instances for it (adopt the term as a
 * plan), or the adopted plan's access, size, target release and instance count with its actions.
 * Renders nothing on a Vetra without plans.
 */
export function TermInstances({ appId, term }: { appId: string; term: InstancesTerm }) {
  const plans = useAppPlans(appId)
  const instances = useAppInstances(appId)
  const [dialog, setDialog] = useState<OpenDialog>(null)
  const close = (o: boolean) => !o && setDialog(null)

  if (isAppsError(plans.error, 'APPS_UNAVAILABLE')) return null

  const plan = planForKind(plans.data, term.kind)
  const count = plan ? planInstances(instances.data, plan.id).length : 0

  return (
    <section
      aria-label={`Instances of ${term.name}`}
      data-testid={`term-instances-${term.kind}`}
      className="bg-muted/40 border-border space-y-2 rounded-lg border px-4 py-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Server className="text-muted-foreground h-3.5 w-3.5" aria-hidden />
        <h4 className="text-sm font-medium">Instances</h4>
        {plan && (
          <span
            className={cn(
              'rounded-full px-1.5 py-px text-[10px] font-medium tracking-wide uppercase',
              plan.status === 'active'
                ? 'bg-success/15 text-success'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {plan.status}
          </span>
        )}
      </div>
      {plans.isPending ? (
        <Skeleton className="h-5 w-1/2" />
      ) : plans.error ? (
        <InlineError error={plans.error} />
      ) : !plan ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-muted-foreground flex-1 text-sm">
            {term.activeLicenses > 0
              ? 'This plan already has holders, so it cannot start running instances.'
              : 'Vetra can run this app for everyone with this plan.'}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDialog('run')}
            disabled={term.activeLicenses > 0}
          >
            Run instances
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <dl className="text-muted-foreground grid flex-1 grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs">Access</dt>
              <dd className="text-foreground" title={ACCESS_HINT[plan.access]}>
                {ACCESS_LABEL[plan.access] ?? plan.access}
              </dd>
            </div>
            <div>
              <dt className="text-xs">Size</dt>
              <dd className="text-foreground">{sizeLabel(plan.size)}</dd>
            </div>
            <div>
              <dt className="text-xs">Target release</dt>
              <dd className="text-foreground font-mono">{plan.targetVersion ?? 'None yet'}</dd>
            </div>
            <div>
              <dt className="text-xs">Running</dt>
              <dd className="text-foreground">
                {instances.isPending ? '…' : instanceCountText(count)}
              </dd>
            </div>
          </dl>
          {plan.status === 'active' && (
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setDialog('target')}>
                Change target
              </Button>
              <Button size="sm" variant="outline" onClick={() => setDialog('size')}>
                Change size
              </Button>
              <Button size="sm" variant="outline" onClick={() => setDialog('retire')}>
                Retire
              </Button>
            </div>
          )}
        </div>
      )}
      {!plan && (
        <RunInstancesDialog
          appId={appId}
          term={term}
          open={dialog === 'run'}
          onOpenChange={close}
        />
      )}
      {plan && (
        <>
          <PlanTargetDialog
            key={`target-${plan.targetVersion ?? ''}-${dialog === 'target'}`}
            appId={appId}
            plan={plan}
            open={dialog === 'target'}
            onOpenChange={close}
          />
          <PlanSizeDialog
            key={`size-${plan.size}-${dialog === 'size'}`}
            appId={appId}
            plan={plan}
            open={dialog === 'size'}
            onOpenChange={close}
          />
          <RetirePlanDialog
            appId={appId}
            plan={plan}
            open={dialog === 'retire'}
            onOpenChange={close}
          />
        </>
      )}
    </section>
  )
}
