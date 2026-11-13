'use client'

import { ArrowUpRight, Container, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import Link from 'next/link'

import { EmptyState, TabError, TabSkeleton } from '@/modules/publisher/components/primitives'
import { PageHeader } from '@/modules/shared/components/page-header'
import { Button } from '@/modules/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

import { formatTimestamp } from '@/modules/shared/lib/time'

import { describeAppsError, isAppsError } from '../graphql'
import { useAppIdentityOf } from '../hooks/use-app-names'
import { useMyInstances, useUpdateInstanceNow } from '../hooks/use-apps'
import { NOTICE_CLASS, NOTICE_TONE, sortedNotices } from '../lib/holder'
import { ACCESS_LABEL } from '../lib/plans'
import type { HolderInstance } from '../types'
import { isHttps, STATUS_CLASS } from './app-instances'
import { HolderInstancePanel } from './holder-instance-panel'
import { AppLogo } from './profile/app-logo'
import { MarkdownLite } from './profile/markdown-lite'

/** A coming update: when, what is new, and "Update now" while the plan lets the holder. */
function UpdateBanner({ instance }: { instance: HolderInstance }) {
  const update = instance.update
  const now = useUpdateInstanceNow()
  if (!update) return null
  return (
    <div
      data-testid={`update-${instance.instanceId}`}
      className="border-info/40 bg-info/10 basis-full space-y-2 rounded-md border px-4 py-3 text-sm"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="font-medium">
          {update.dueAt
            ? `Version ${update.version} on ${formatTimestamp(update.dueAt)}`
            : `Version ${update.version} is coming`}
        </span>
        {update.paused && <span className="text-warning text-xs">paused by the publisher</span>}
        {!update.dueAt && !update.paused && (
          <span className="text-muted-foreground text-xs">
            Not yet scheduled: the update window of your plan is not open.
          </span>
        )}
        {update.canUpdateNow && (
          <Button
            size="sm"
            className="ml-auto"
            disabled={now.isPending}
            onClick={() =>
              now.mutate(instance.instanceId, {
                onSuccess: () => toast.success(`Updating to ${update.version}`),
              })
            }
          >
            {now.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Update now
          </Button>
        )}
      </div>
      {update.notes && <MarkdownLite text={update.notes} className="text-sm" />}
      {now.error && (
        <p role="alert" className="text-destructive text-sm">
          {describeAppsError(now.error)}
        </p>
      )}
    </div>
  )
}

/** End-of-licence notices, most urgent first, in the server's words. */
function Notices({ instance }: { instance: HolderInstance }) {
  const notices = sortedNotices(instance.notices)
  if (notices.length === 0) return null
  return (
    <ul className="basis-full space-y-2">
      {notices.map((n) => (
        <li
          key={n.kind}
          role="status"
          data-testid={`notice-${n.kind}`}
          className={cn('rounded-md border px-4 py-2 text-sm', NOTICE_CLASS[NOTICE_TONE[n.kind]])}
        >
          {n.message}
          {n.at && <span className="ml-2 text-xs opacity-80">{formatTimestamp(n.at)}</span>}
        </li>
      ))}
    </ul>
  )
}

function MyInstanceCard({
  instance,
  appName,
  appDid,
  logo,
}: {
  instance: HolderInstance
  appName: string
  appDid: string | null
  logo: string | null
}) {
  const { url, status, reason } = instance
  const [manage, setManage] = useState(false)
  return (
    <li
      data-testid={`my-instance-${instance.instanceId}`}
      className="bg-card border-border flex flex-col gap-4 rounded-xl border p-5 shadow-sm sm:flex-row sm:flex-wrap sm:items-center"
    >
      <AppLogo name={appName} seed={instance.appId} src={logo} appDid={appDid} size="md" />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold break-words">{appName}</h2>
          <span
            className={cn(
              'shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium tracking-wide uppercase',
              STATUS_CLASS[status] ?? STATUS_CLASS.pending,
            )}
          >
            {status}
          </span>
        </div>
        <p className="text-muted-foreground text-sm">
          {instance.planName} · {ACCESS_LABEL[instance.access] ?? instance.access} instance
          {instance.runningVersion && (
            <span className="font-mono"> · {instance.runningVersion}</span>
          )}
        </p>
        {reason && (
          <p className="text-muted-foreground text-xs">
            {status === 'stopped' ? (
              <>
                <span className="font-medium">stopped:</span> {reason}
              </>
            ) : (
              reason
            )}
          </p>
        )}
      </div>
      {url &&
        (isHttps(url) ? (
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <a href={url} target="_blank" rel="noopener noreferrer">
              Open
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </a>
          </Button>
        ) : (
          <span className="text-muted-foreground text-sm">{url}</span>
        ))}
      {instance.access === 'own' && (
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0"
          aria-expanded={manage}
          onClick={() => setManage((x) => !x)}
        >
          {manage ? 'Close' : 'Manage'}
        </Button>
      )}
      <Notices instance={instance} />
      <UpdateBanner instance={instance} />
      {manage && instance.access === 'own' && <HolderInstancePanel instance={instance} />}
    </li>
  )
}

/** `/user/instances`: the instances Vetra runs for the plans I hold. */
export function MyInstances() {
  const instances = useMyInstances()
  const identityOf = useAppIdentityOf()
  const list = instances.data ?? []

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="~/instances"
        title="My instances"
        description="Apps Vetra runs for you, through the plans you hold."
      />
      {instances.isPending ? (
        <TabSkeleton rows={2} label="Loading your instances" />
      ) : isAppsError(instances.error, 'APPS_UNAVAILABLE') ? (
        <EmptyState icon={Container} title="Not available yet">
          This Vetra does not run instances for plans yet.
        </EmptyState>
      ) : instances.error ? (
        <TabError
          error={new Error(describeAppsError(instances.error))}
          onRetry={() => void instances.refetch()}
          retrying={instances.isRefetching}
        />
      ) : list.length === 0 ? (
        <EmptyState
          icon={Container}
          title="No instances yet"
          action={
            <Button asChild variant="outline">
              <Link href="/user/subscriptions">See your subscriptions</Link>
            </Button>
          }
        >
          When a plan you hold comes with its own or a shared instance, it shows up here with a link
          to open it.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {list.map((i) => {
            const identity = identityOf(i.appId)
            return (
              <MyInstanceCard
                key={i.instanceId}
                instance={i}
                appName={identity.name ?? i.appName}
                appDid={identity.appDid}
                logo={identity.logo}
              />
            )
          })}
        </ul>
      )}
    </div>
  )
}
