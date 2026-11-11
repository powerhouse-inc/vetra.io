'use client'

import { ArrowUpRight } from 'lucide-react'

import { Skeleton } from '@/modules/shared/components/ui/skeleton'
import { formatTimestamp, timeAgo } from '@/modules/shared/lib/time'
import { cn } from '@/shared/lib/utils'

import { describeAppsError } from '../graphql'
import { useAppInstances } from '../hooks/use-apps'
import type { AppInstance, AppInstanceStatus } from '../types'

const STATUS_CLASS: Record<AppInstanceStatus, string> = {
  pending: 'bg-muted text-muted-foreground',
  updating: 'bg-info/15 text-info',
  ready: 'bg-success/15 text-success',
  failed: 'bg-destructive/15 text-destructive',
  stopped: 'bg-muted text-muted-foreground',
}

/** Only https URLs become links; anything else is shown as plain text. */
function isHttps(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}

function InstanceRow({ instance }: { instance: AppInstance }) {
  const { url, reason, runningVersion, targetVersion } = instance
  const differs = !!targetVersion && runningVersion !== targetVersion
  return (
    <li
      data-testid={`instance-${instance.id}`}
      className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3"
    >
      <span className="font-mono text-sm break-all sm:w-48">
        {instance.branch ?? instance.name}
      </span>
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
      {reason && <span className="text-muted-foreground text-xs">{reason}</span>}
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
    </li>
  )
}

/** The app's branch instances, polled while any is rolling out. Shown when `instancesEnabled`. */
export function AppInstances({ appId }: { appId: string }) {
  const instances = useAppInstances(appId)
  const list = instances.data ?? []
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
          No instances yet — they appear when a release branch has a build.
        </p>
      ) : (
        <ul className="bg-card border-border divide-border divide-y overflow-hidden rounded-xl border shadow-sm">
          {list.map((i) => (
            <InstanceRow key={i.id} instance={i} />
          ))}
        </ul>
      )}
    </section>
  )
}
