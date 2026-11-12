'use client'

import { ArrowUpRight } from 'lucide-react'

import { PersonName } from '@/modules/shared/components/person-name'
import { Skeleton } from '@/modules/shared/components/ui/skeleton'
import { formatTimestamp, timeAgo } from '@/modules/shared/lib/time'
import { cn } from '@/shared/lib/utils'

import { describeAppsError } from '../graphql'
import { useAppInstances, useAppPlans } from '../hooks/use-apps'
import { settingsPending, splitSettingsReason } from '../lib/settings'
import { shortSha } from '../lib/status'
import type { AppInstance, AppInstanceStatus, AppPlan } from '../types'

export const STATUS_CLASS: Record<AppInstanceStatus, string> = {
  pending: 'bg-muted text-muted-foreground',
  updating: 'bg-info/15 text-info',
  ready: 'bg-success/15 text-success',
  degraded: 'bg-warning/15 text-warning',
  failed: 'bg-destructive/15 text-destructive',
  stopped: 'bg-muted text-muted-foreground',
}

const HEALTH_DOT: Record<string, string> = {
  healthy: 'bg-success',
  unhealthy: 'bg-destructive',
  unknown: 'bg-muted-foreground',
}

/** Compact health line; renders nothing when the backend sent no health data. */
function HealthLine({ instance }: { instance: AppInstance }) {
  const { health, healthCheck, healthReason, healthCheckedAt, observedDigest } = instance
  const mismatch =
    !!observedDigest && !!instance.targetDigest && observedDigest !== instance.targetDigest
  const reverted = instance.status === 'failed' && health === 'healthy'
  if (!health && !mismatch) return null
  return (
    <div className="text-muted-foreground flex basis-full flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
      {health && (
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className={cn('h-1.5 w-1.5 rounded-full', HEALTH_DOT[health] ?? HEALTH_DOT.unknown)}
          />
          <span>{health}</span>
          {healthCheck && <span className="font-mono">{healthCheck}</span>}
          {health !== 'healthy' && healthReason && <span>{healthReason}</span>}
        </span>
      )}
      {healthCheckedAt && (
        <span title={formatTimestamp(healthCheckedAt)}>checked {timeAgo(healthCheckedAt)}</span>
      )}
      {mismatch && (
        <span className="font-mono">
          running {shortSha(observedDigest.replace(/^sha256:/, ''))}
          {instance.observedDigestSource ? ` (${instance.observedDigestSource})` : ''}
        </span>
      )}
      {reverted && <span>reverted to the last healthy build</span>}
    </div>
  )
}

/** Only https URLs become links; anything else is shown as plain text. */
export function isHttps(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}

const isPlanInstance = (i: AppInstance) => i.kind === 'shared' || i.kind === 'own'

/** What an instance serves: its branch, or (shared/own) its plan and, for own, the holder. */
function InstanceLabel({ instance, plan }: { instance: AppInstance; plan: AppPlan | undefined }) {
  if (!isPlanInstance(instance)) {
    return (
      <span className="font-mono text-sm break-all sm:w-48">
        {instance.branch ?? instance.name}
      </span>
    )
  }
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-sm sm:w-48">
      <span className="font-medium">{plan?.name ?? 'Plan'}</span>
      <span className="bg-muted text-muted-foreground rounded px-1 text-[10px] font-medium uppercase">
        {instance.kind}
      </span>
      {instance.kind === 'own' && instance.holder && (
        <PersonName value={instance.holder} avatar className="text-muted-foreground text-xs" />
      )}
    </span>
  )
}

function InstanceRow({ instance, plan }: { instance: AppInstance; plan?: AppPlan }) {
  const { url, reason, runningVersion, targetVersion } = instance
  const differs = !!targetVersion && runningVersion !== targetVersion
  const { afterSettingsChange, cause } = splitSettingsReason(reason)
  // Failed on a new revision: the reason says so; "pending" would only repeat it.
  const pending = settingsPending(instance) && !afterSettingsChange
  return (
    <li
      data-testid={`instance-${instance.id}`}
      className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3"
    >
      <InstanceLabel instance={instance} plan={plan} />
      {url &&
        (isHttps(url) ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary inline-flex items-center gap-0.5 text-sm hover:underline"
          >
            {url.replace(/^https:\/\//, '')}
            <ArrowUpRight className="h-3 w-3 shrink-0" aria-hidden />
          </a>
        ) : (
          <span className="text-muted-foreground text-sm">{url}</span>
        ))}
      <span
        className={cn(
          'shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium tracking-wide uppercase',
          STATUS_CLASS[instance.status] ?? STATUS_CLASS.pending,
        )}
      >
        {instance.status}
      </span>
      {instance.status === 'stopped' && cause && !afterSettingsChange ? (
        <span className="text-muted-foreground text-xs">
          <span className="font-medium">stopped:</span> {cause}
        </span>
      ) : null}
      {afterSettingsChange && (
        <span className="text-destructive text-xs">
          <span className="font-medium">After a settings change:</span>
          {cause ? ` ${cause}` : ''}
        </span>
      )}
      {!afterSettingsChange && cause && instance.status !== 'stopped' && (
        <span className="text-muted-foreground text-xs">{cause}</span>
      )}
      {pending && (
        <span
          className="bg-warning/15 text-warning shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium"
          title="This instance has not yet run the app's latest environment settings."
        >
          settings pending
        </span>
      )}
      {differs && (
        <span className="text-muted-foreground font-mono text-xs">
          {runningVersion ? `${runningVersion} → ${targetVersion}` : `→ ${targetVersion}`}
        </span>
      )}
      <span
        className="text-muted-foreground ml-auto text-xs"
        title={formatTimestamp(instance.updatedAt)}
      >
        {timeAgo(instance.updatedAt)}
      </span>
      <HealthLine instance={instance} />
    </li>
  )
}

/**
 * The app's instances: one per release branch (when `branchInstances`), and the shared and own
 * instances of its plans. Polled while any is rolling out. Without branch instances the panel
 * shows only when a plan has instances.
 */
export function AppInstances({
  appId,
  branchInstances = true,
}: {
  appId: string
  branchInstances?: boolean
}) {
  const instances = useAppInstances(appId)
  const plans = useAppPlans(appId)
  const list = instances.data ?? []
  const planOf = (i: AppInstance) => plans.data?.find((p) => p.id === i.planId)
  if (!branchInstances && !list.some(isPlanInstance)) return null
  return (
    <section className="space-y-2" aria-label="Instances">
      <h3 className="text-sm font-semibold">Instances</h3>
      {instances.isPending ? (
        <Skeleton className="h-12 w-full rounded-xl" />
      ) : instances.error ? (
        <p role="alert" className="text-destructive text-sm">
          {describeAppsError(instances.error)}
        </p>
      ) : list.length === 0 ? (
        <p className="text-muted-foreground bg-card border-border rounded-xl border px-4 py-3 text-sm">
          No instances yet — they appear when a release branch has a build, or a plan has holders.
        </p>
      ) : (
        <ul className="bg-card border-border divide-border divide-y overflow-hidden rounded-xl border shadow-sm">
          {list.map((i) => (
            <InstanceRow key={i.id} instance={i} plan={planOf(i)} />
          ))}
        </ul>
      )}
    </section>
  )
}
