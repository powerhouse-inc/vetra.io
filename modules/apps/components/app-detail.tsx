'use client'

import { useRenownAuthAsync } from '@powerhousedao/reactor-browser'
import {
  ArrowLeft,
  ArrowUpRight,
  Fingerprint,
  GitBranch,
  Github,
  Loader2,
  RefreshCw,
  Trash2,
  Unplug,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef } from 'react'
import { toast } from 'sonner'

import { Button } from '@/modules/shared/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/modules/shared/components/ui/tabs'

import { describeAppsError, isAppsError } from '../graphql'
import {
  useApp,
  useAppDeployments,
  useConfirmAppIdentity,
  useGithubDeployAppInfo,
} from '../hooks/use-apps'
import {
  appHeadlineStatus,
  githubRepoUrl,
  isAppReadOnly,
  primaryUrl,
  refLabel,
} from '../lib/status'
import { formatTimestamp } from '../lib/time'
import { timeAgo } from '../lib/time'
import type { App } from '../types'
import { AppAvatar } from './app-avatar'
import { AppDeployments } from './app-deployments'
import { AppOverview } from './app-overview'
import { AppSettings } from './app-settings'
import { StatusPill } from './status'

const TABS = ['overview', 'deployments', 'settings'] as const
type Tab = (typeof TABS)[number]

function Banner({
  tone,
  icon: Icon,
  title,
  children,
  actions,
}: {
  tone: 'warning' | 'danger' | 'neutral'
  icon: typeof Fingerprint
  title: string
  children: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <div
      role="status"
      className={
        tone === 'warning'
          ? 'border-warning/40 bg-warning/10 flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center'
          : tone === 'danger'
            ? 'border-destructive/40 bg-destructive/10 flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center'
            : 'border-border bg-muted/50 flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center'
      }
    >
      <Icon
        className={
          tone === 'warning'
            ? 'text-warning h-5 w-5 shrink-0'
            : tone === 'danger'
              ? 'text-destructive h-5 w-5 shrink-0'
              : 'text-muted-foreground h-5 w-5 shrink-0'
        }
        aria-hidden
      />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-muted-foreground text-sm">{children}</p>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

function Header({ app }: { app: App }) {
  const url = primaryUrl(app.productionUrls)
  const latest = app.latestDeployment
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <AppAvatar name={app.name} seed={app.id} size="lg" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="truncate text-3xl font-bold tracking-tight">{app.name}</h1>
          <StatusPill meta={appHeadlineStatus(app)} />
        </div>
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <a
            href={githubRepoUrl(app.repository.fullName)}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground inline-flex items-center gap-1.5"
          >
            <Github className="h-4 w-4" aria-hidden />
            {app.repository.fullName}
          </a>
          <span className="inline-flex items-center gap-1.5">
            <GitBranch className="h-4 w-4" aria-hidden />
            <span className="font-mono">{app.productionBranch}</span>
          </span>
          {latest && (
            <span>
              Last deploy {timeAgo(latest.createdAt)} from {refLabel(latest.gitRef)}
            </span>
          )}
        </div>
      </div>
      {url && !isAppReadOnly(app) && (
        <Button asChild size="lg" className="shrink-0">
          <a href={url} target="_blank" rel="noopener noreferrer">
            Visit
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </Button>
      )}
    </div>
  )
}

/** `/user/apps/[id]` — header, status banners and Overview / Deployments / Settings tabs. */
export function AppDetail({ appId }: { appId: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const { state: authState } = useRenownAuthAsync()

  const appQuery = useApp(appId)
  const deploymentsQuery = useAppDeployments(appId)
  const githubInfo = useGithubDeployAppInfo()
  const confirm = useConfirmAppIdentity()
  const app = appQuery.data

  const tabParam = params.get('tab')
  const readOnly = app ? isAppReadOnly(app) : false
  // A deleted app is read-only: no Settings tab, no actions.
  const visibleTabs: readonly Tab[] = readOnly ? TABS.filter((t) => t !== 'settings') : TABS
  const tab: Tab = visibleTabs.includes(tabParam as Tab) ? (tabParam as Tab) : 'overview'

  const deployments = useMemo(
    () =>
      [...(deploymentsQuery.data ?? [])].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [deploymentsQuery.data],
  )

  const runConfirm = () => {
    confirm.mutate(appId, {
      onSuccess: (updated) => {
        if (updated.status === 'PENDING_IDENTITY') {
          toast.info('Authorization not found yet. Finish it on Renown, then check again.')
        } else {
          toast.success('Deploy identity authorized. Push to deploy.')
        }
      },
      onError: (err) => toast.error(describeAppsError(err)),
    })
  }

  // Back from renown.id with ?identity=1 → confirm the delegation once, then
  // drop the flag so a reload doesn't re-run it.
  const confirmedOnce = useRef(false)
  useEffect(() => {
    if (params.get('identity') !== '1' || authState !== 'authenticated' || confirmedOnce.current)
      return
    confirmedOnce.current = true
    runConfirm()
    const next = new URLSearchParams(params.toString())
    next.delete('identity')
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot on return from Renown
  }, [params, authState])

  const setTab = (value: string) => {
    const next = new URLSearchParams(params.toString())
    if (value === 'overview') next.delete('tab')
    else next.set('tab', value)
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const authorize = () => {
    if (app) window.location.assign(app.renownAuthorizeUrl)
  }

  if (appQuery.isPending) {
    return (
      <div className="text-muted-foreground flex min-h-[50vh] items-center justify-center gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Loading app…
      </div>
    )
  }

  if (!app) {
    const notFound = !appQuery.error || isAppsError(appQuery.error, 'NOT_FOUND')
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-lg font-semibold">{notFound ? 'App not found' : 'Could not load app'}</p>
        <p className="text-muted-foreground max-w-sm text-sm">
          {notFound
            ? 'It may have been deleted, or it belongs to another account.'
            : describeAppsError(appQuery.error)}
        </p>
        <Button asChild variant="outline">
          <Link href="/user">Back to apps</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="space-y-6">
        <Link
          href="/user"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Apps
        </Link>
        <Header app={app} />

        {app.status === 'PENDING_IDENTITY' && (
          <Banner
            tone="warning"
            icon={Fingerprint}
            title="Authorize the deploy identity"
            actions={
              <>
                <Button size="sm" onClick={authorize}>
                  Authorize on Renown
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => runConfirm()}
                  disabled={confirm.isPending}
                >
                  {confirm.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Check again
                </Button>
              </>
            }
          >
            GitHub Actions cannot deploy until you approve this app&apos;s Renown identity once.
          </Banner>
        )}

        {readOnly && (
          <Banner tone="neutral" icon={Trash2} title="This app was deleted">
            Deleted {formatTimestamp(app.updatedAt)}. You can see it because you are an admin; its
            history is read-only.
          </Banner>
        )}

        {app.status === 'DISCONNECTED' && (
          <Banner
            tone="danger"
            icon={Unplug}
            title="GitHub disconnected"
            actions={
              githubInfo.data?.installUrl ? (
                <Button size="sm" variant="outline" asChild>
                  <a href={githubInfo.data.installUrl}>
                    <Github className="h-3.5 w-3.5" />
                    Reconnect
                  </a>
                </Button>
              ) : undefined
            }
          >
            Vetra Deploy lost access to {app.repository.fullName}. Deploys are paused and previews
            were removed. Reinstall the GitHub App to resume.
          </Banner>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="gap-8">
        <TabsList className="border-border h-auto w-full justify-start gap-6 rounded-none border-b bg-transparent p-0">
          {visibleTabs.map((t) => (
            <TabsTrigger
              key={t}
              value={t}
              className="data-[state=active]:border-b-foreground text-muted-foreground data-[state=active]:text-foreground dark:data-[state=active]:border-b-foreground -mb-px h-10 flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-0 capitalize shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:bg-transparent"
            >
              {t}
              {t === 'deployments' && deployments.length > 0 && (
                <span className="bg-muted text-muted-foreground rounded-full px-1.5 text-[10px] font-semibold">
                  {deployments.length}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview">
          <AppOverview
            app={app}
            deployments={deployments}
            deploymentsLoaded={!deploymentsQuery.isPending}
            onAuthorize={authorize}
          />
        </TabsContent>
        <TabsContent value="deployments">
          <AppDeployments
            app={app}
            deployments={deployments}
            isPending={deploymentsQuery.isPending}
            error={deploymentsQuery.error}
          />
        </TabsContent>
        {!readOnly && (
          <TabsContent value="settings">
            <AppSettings app={app} onAuthorize={authorize} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
