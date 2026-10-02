'use client'

import { ArrowRight, BookOpen, Info, Plus, RefreshCw, Sparkles } from 'lucide-react'
import Link from 'next/link'

import { AppCard } from '@/modules/apps/components/app-card'
import { AppsEmptyState } from '@/modules/apps/components/apps-empty-state'
import { describeAppsError, isAppsError } from '@/modules/apps/graphql'
import { useMyApps } from '@/modules/apps/hooks/use-apps'
import { isAppEnvironment } from '@/modules/apps/lib/split'
import type { CloudEnvironment } from '@/modules/cloud/types'
import { Alert, AlertDescription, AlertTitle } from '@/modules/shared/components/ui/alert'
import { Button } from '@/modules/shared/components/ui/button'

import { CloudEnvironments } from './environments/cloud-projects'

const isStandalone = (env: CloudEnvironment) => !isAppEnvironment(env)

function AppCardSkeleton() {
  return (
    <div className="bg-card border-border rounded-xl border p-5 shadow-sm" aria-hidden>
      <div className="flex items-start gap-3">
        <div className="bg-muted h-10 w-10 animate-pulse rounded-xl" />
        <div className="flex-1 space-y-2">
          <div className="bg-muted h-4 w-1/2 animate-pulse rounded" />
          <div className="bg-muted h-3 w-2/3 animate-pulse rounded" />
        </div>
      </div>
      <div className="bg-muted mt-5 h-3 w-1/3 animate-pulse rounded" />
      <div className="border-border mt-5 border-t pt-3">
        <div className="bg-muted h-3 w-3/4 animate-pulse rounded" />
      </div>
    </div>
  )
}

function NewAppTile() {
  return (
    <Link
      href="/user/apps/new"
      className="text-muted-foreground border-border hover:border-primary/50 hover:text-foreground focus-visible:ring-ring flex min-h-[176px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      <span className="bg-muted flex h-10 w-10 items-center justify-center rounded-xl">
        <Plus className="h-5 w-5" aria-hidden />
      </span>
      New app
    </Link>
  )
}

function AppsSection() {
  const { data: apps, isPending, error, refetch, isRefetching } = useMyApps()

  if (isAppsError(error, 'APPS_UNAVAILABLE')) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Apps are on their way</AlertTitle>
        <AlertDescription>
          Git-connected apps are not enabled on this Vetra server yet. Your environments keep
          working as before.
        </AlertDescription>
      </Alert>
    )
  }

  if (error && !apps) {
    return (
      <Alert variant="destructive">
        <Info className="h-4 w-4" />
        <AlertTitle>Could not load your apps</AlertTitle>
        <AlertDescription className="flex flex-wrap items-center gap-3">
          {describeAppsError(error)}
          <Button
            size="sm"
            variant="outline"
            onClick={() => void refetch()}
            disabled={isRefetching}
          >
            <RefreshCw className={isRefetching ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (isPending) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <AppCardSkeleton />
        <AppCardSkeleton />
        <AppCardSkeleton />
      </div>
    )
  }

  if (!apps || apps.length === 0) return <AppsEmptyState />

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {apps.map((app) => (
        <AppCard key={app.id} app={app} />
      ))}
      <NewAppTile />
    </div>
  )
}

function StudioCard() {
  return (
    <Link
      href="/user/studio"
      className="group bg-card border-border hover:border-primary/40 focus-visible:ring-ring flex flex-col gap-4 rounded-xl border p-5 shadow-sm transition-colors focus-visible:ring-2 focus-visible:outline-none sm:flex-row sm:items-center"
    >
      <span className="bg-purple/15 text-purple flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
        <Sparkles className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">Vetra Studio</span>
        <span className="text-muted-foreground block text-sm">
          Design document models and products with an AI agent, then ship them as an app.
        </span>
      </span>
      <span className="text-primary inline-flex items-center gap-1 text-sm font-medium">
        Open Studio
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  )
}

/** `/user` — Apps first, then standalone environments, then Studio. */
export function AppsHome() {
  return (
    <main className="mx-auto mt-20 max-w-screen-xl space-y-12 px-6 py-8">
      <section className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1.5">
            <h1 className="text-3xl font-bold tracking-tight">Your apps</h1>
            <p className="text-muted-foreground max-w-2xl">
              Push to GitHub, Vetra deploys. Production follows your main branch and every pull
              request gets its own preview.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button asChild variant="ghost">
              <Link href="/docs/deploy">
                <BookOpen className="h-4 w-4" />
                Deploy guide
              </Link>
            </Button>
            <Button asChild>
              <Link href="/user/apps/new">
                <Plus className="h-4 w-4" />
                New app
              </Link>
            </Button>
          </div>
        </div>
        <AppsSection />
      </section>

      <section className="space-y-4" aria-labelledby="standalone-envs">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h2 id="standalone-envs" className="text-xl font-semibold">
              Standalone environments
            </h2>
            <p className="text-muted-foreground text-sm">
              Environments you manage by hand, not linked to an app.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/user/environments/new">
              <Plus className="h-4 w-4" />
              New environment
            </Link>
          </Button>
        </div>
        <CloudEnvironments
          filter={isStandalone}
          emptyCopy="No standalone environments. Everything you run is part of an app."
          compactEmpty
        />
      </section>

      <StudioCard />
    </main>
  )
}
