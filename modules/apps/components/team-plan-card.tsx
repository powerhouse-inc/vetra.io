'use client'

import { ArrowUpRight, Loader2, Users } from 'lucide-react'
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
import { Skeleton } from '@/modules/shared/components/ui/skeleton'

import { describeAppsError, isAppsError } from '../graphql'
import { useAppInstances, useAppPlans, useTeamPlan, useUpdateAppPlan } from '../hooks/use-apps'
import { followBranch } from '../lib/rollouts'
import type { App } from '../types'
import { STATUS_CLASS, isHttps } from './app-instances'
import { cn } from '@/shared/lib/utils'

const SELECT_CLASS =
  'border-input bg-background focus-visible:ring-ring h-9 rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none'

/** The branches a Team plan may follow: the production branch first, then the release branches. */
export function teamBranches(app: Pick<App, 'productionBranch' | 'releaseBranches'>): string[] {
  return [...new Set([app.productionBranch, ...(app.releaseBranches ?? [])])]
}

/**
 * The Team plan card on the Plans tab: a private instance for the organisation's members that
 * follows a release branch and runs every release before customers get it. Organisation Apps
 * only; turned on and off by owners and organisation admins.
 */
export function TeamPlanCard({
  app,
  canAdminister,
}: {
  app: Pick<App, 'id' | 'ownerOrgId' | 'productionBranch' | 'releaseBranches'>
  canAdminister: boolean
}) {
  const plans = useAppPlans(app.id)
  const instances = useAppInstances(app.id)
  const team = useTeamPlan(app.id)
  const update = useUpdateAppPlan(app.id)
  const branches = teamBranches(app)
  const [branch, setBranch] = useState(app.productionBranch)
  const [changing, setChanging] = useState(false)
  const [confirmOff, setConfirmOff] = useState(false)

  // A Vetra without plans, or without Team, has nothing to offer.
  if (isAppsError(plans.error, 'APPS_UNAVAILABLE')) return null
  const plan = plans.data?.find((p) => p.team === true && p.status === 'active')
  const instance = plan ? instances.data?.find((i) => i.planId === plan.id) : undefined
  const followed = plan ? followBranch(plan.policy) : null

  return (
    <section
      aria-label="Team plan"
      data-testid="team-plan-card"
      className="bg-card border-border space-y-3 rounded-xl border p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Users className="text-muted-foreground h-4 w-4" aria-hidden />
        <h3 className="font-semibold">Team</h3>
        {plan && (
          <span className="bg-success/15 text-success rounded-full px-1.5 py-px text-[10px] font-medium tracking-wide uppercase">
            on
          </span>
        )}
      </div>
      {plans.isPending ? (
        <Skeleton className="h-9 w-full" />
      ) : plans.error ? (
        <p role="alert" className="text-destructive text-sm">
          {describeAppsError(plans.error)}
        </p>
      ) : !app.ownerOrgId ? (
        <p className="text-muted-foreground text-sm">
          Team is for organisation apps: a private instance for your organisation&apos;s members.
          Move this app to an organisation to use it.
        </p>
      ) : !plan ? (
        <>
          <p className="text-muted-foreground text-sm">
            A private instance for your organisation&apos;s members. New releases from this branch
            update it automatically, and customers only get a release after it ran healthy here.
          </p>
          {canAdminister ? (
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Branch to follow"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className={SELECT_CLASS}
              >
                {branches.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
              <Button
                disabled={team.isPending}
                onClick={() =>
                  team.mutate(
                    { enable: true, followBranch: branch },
                    { onSuccess: () => toast.success('Team is on') },
                  )
                }
              >
                {team.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Turn on Team
              </Button>
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">
              An owner or organisation admin turns Team on.
            </p>
          )}
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
            {instance && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-px text-[10px] font-medium tracking-wide uppercase',
                  STATUS_CLASS[instance.status] ?? STATUS_CLASS.pending,
                )}
              >
                {instance.status}
              </span>
            )}
            {instance?.url &&
              (isHttps(instance.url) ? (
                <a
                  href={instance.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary inline-flex items-center gap-0.5 hover:underline"
                >
                  {instance.url.replace(/^https:\/\//, '')}
                  <ArrowUpRight className="h-3 w-3" aria-hidden />
                </a>
              ) : (
                <span className="text-muted-foreground">{instance.url}</span>
              ))}
            <span className="text-muted-foreground">
              Follows <span className="text-foreground font-mono">{followed ?? 'a branch'}</span>
            </span>
            {plan.targetVersion && (
              <span className="text-muted-foreground">
                Runs <span className="text-foreground font-mono">{plan.targetVersion}</span>
              </span>
            )}
          </div>
          {canAdminister && (
            <div className="flex flex-wrap items-center gap-2">
              {changing ? (
                <>
                  <select
                    aria-label="Branch to follow"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className={SELECT_CLASS}
                  >
                    {branches.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    disabled={update.isPending || branch === followed}
                    onClick={() =>
                      update.mutate(
                        { planId: plan.id, policy: `follow:${branch}` },
                        {
                          onSuccess: () => {
                            toast.success(`Team follows ${branch}`)
                            setChanging(false)
                          },
                        },
                      )
                    }
                  >
                    Save branch
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setChanging(false)}>
                    Cancel
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setBranch(followed ?? app.productionBranch)
                    setChanging(true)
                  }}
                >
                  Change branch
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setConfirmOff(true)}>
                Turn off
              </Button>
            </div>
          )}
          {update.error && (
            <p role="alert" className="text-destructive text-sm">
              {describeAppsError(update.error)}
            </p>
          )}
        </>
      )}
      {team.error && !plan && (
        <p role="alert" className="text-destructive text-sm">
          {describeAppsError(team.error)}
        </p>
      )}
      <AlertDialog
        open={confirmOff}
        onOpenChange={(o) => {
          if (!o) team.reset()
          setConfirmOff(o)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Turn off Team?</AlertDialogTitle>
            <AlertDialogDescription>
              The Team instance stops; customer rollouts are no longer checked against it. Its data
              is kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {team.error && (
            <p role="alert" className="text-destructive text-sm">
              {describeAppsError(team.error)}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={team.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={team.isPending}
              onClick={(e) => {
                e.preventDefault()
                team.mutate(
                  { enable: false },
                  {
                    onSuccess: () => {
                      toast.success('Team is off')
                      setConfirmOff(false)
                    },
                  },
                )
              }}
            >
              Turn off Team
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
