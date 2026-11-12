'use client'

import { ArrowUpRight, Container } from 'lucide-react'
import Link from 'next/link'

import { EmptyState, TabError, TabSkeleton } from '@/modules/publisher/components/primitives'
import { PageHeader } from '@/modules/shared/components/page-header'
import { Button } from '@/modules/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

import { describeAppsError, isAppsError } from '../graphql'
import { useAppIdentityOf } from '../hooks/use-app-names'
import { useMyInstances } from '../hooks/use-apps'
import { ACCESS_LABEL } from '../lib/plans'
import type { HolderInstance } from '../types'
import { isHttps, STATUS_CLASS } from './app-instances'
import { AppLogo } from './profile/app-logo'

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
  return (
    <li
      data-testid={`my-instance-${instance.instanceId}`}
      className="bg-card border-border flex flex-col gap-4 rounded-xl border p-5 shadow-sm sm:flex-row sm:items-center"
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
