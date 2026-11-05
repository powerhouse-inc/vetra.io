'use client'
import { ArrowRight, Package } from 'lucide-react'
import Link from 'next/link'
import { useActiveOrg } from '@/modules/orgs/hooks/use-orgs'
import { usePublisherAppArtifacts, usePublisherApps } from '@/modules/publisher/hooks/use-publisher'
import type { PublisherApp, PublisherAppArtifact } from '@/modules/publisher/types'
import { Button } from '@/modules/shared/components/ui/button'
import { Card, CardContent } from '@/modules/shared/components/ui/card'
import { TabErrorState } from './tab-error-state'

const latest = (a: PublisherAppArtifact) => a.versions[a.versions.length - 1]?.version ?? null

/** One app's published packages; renders nothing while it has none. */
function AppPackages({ app }: { app: PublisherApp }) {
  const { data } = usePublisherAppArtifacts(app.id)
  const packages = (data ?? []).filter((a) => a.kind === 'PACKAGE')
  if (packages.length === 0) return null
  return (
    <>
      {packages.map((pkg) => (
        <li key={pkg.name}>
          <Link
            href={`/user/apps/${encodeURIComponent(app.id)}?tab=artifacts`}
            className="hover:bg-muted/40 flex min-w-0 flex-col gap-1 px-5 py-4 transition-colors sm:flex-row sm:items-center sm:gap-4"
          >
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <Package className="text-muted-foreground size-4 shrink-0" aria-hidden />
              <span className="truncate font-mono text-sm">{pkg.name}</span>
            </span>
            <span className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              {latest(pkg) && <span className="font-mono">{latest(pkg)}</span>}
              {pkg.channels.map((c) => (
                <span key={c.channel} className="font-mono">
                  {c.channel.toLowerCase()}: {c.version}
                </span>
              ))}
              <span>by {app.name}</span>
            </span>
          </Link>
        </li>
      ))}
    </>
  )
}

/**
 * Packages the viewer's apps have published through the Vetra deploy workflow. Packages
 * published by hand with `ph publish` are not tied to an account yet and only show in the
 * public directory.
 */
export function PackagesTab() {
  const { orgId } = useActiveOrg()
  const apps = usePublisherApps(orgId)
  const live = (apps.data ?? []).filter((a) => a.status !== 'DELETED')

  if (apps.isError && !apps.data) {
    return <TabErrorState message="Couldn’t load your apps" onRetry={() => void apps.refetch()} />
  }

  return (
    <div className="space-y-4">
      {live.length > 0 && (
        // Each app renders its own rows once its artifacts load; with none, no empty frame.
        <Card className="[&:not(:has(li))]:hidden">
          <ul className="divide-border divide-y">
            {live.map((app) => (
              <AppPackages key={app.id} app={app} />
            ))}
          </ul>
        </Card>
      )}
      <Card>
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
          <p className="text-muted-foreground flex-1 text-sm">
            Packages appear here once an app’s deploy workflow publishes them. Everything on the
            registry, including packages published with{' '}
            <code className="bg-muted rounded px-1 py-0.5 text-xs">ph publish</code>, is in the
            directory.
          </p>
          <Button variant="outline" size="sm" asChild className="self-start sm:self-auto">
            <Link href="/packages">
              Browse all packages
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
