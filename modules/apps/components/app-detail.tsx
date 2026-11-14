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
  TriangleAlert,
  Unplug,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Fragment, useEffect, useMemo, useRef } from 'react'
import { toast } from 'sonner'

import { HoldersTab } from '@/modules/publisher/components/holders/holders-tab'
import { InviteCodesTab } from '@/modules/publisher/components/invite-codes/invite-codes-tab'
import { PlansTab } from '@/modules/publisher/components/plans/plans-tab'
import { TemplatesTab } from '@/modules/publisher/components/templates/templates-tab'
import { ArtifactsTab } from '@/modules/publisher/components/artifacts/artifacts-tab'
import { LicensingUnavailableBanner } from '@/modules/publisher/components/licensing-unavailable-banner'
import { TabSkeleton } from '@/modules/publisher/components/primitives'
import { describePublisherError, isPublisherError } from '@/modules/publisher/graphql'
import { PublisherSummaryRow } from '@/modules/publisher/components/publisher-summary'
import { useAppPublisher } from '@/modules/publisher/hooks/use-publisher'
import type { PublisherApp } from '@/modules/publisher/types'
import { OrgBadge } from '@/modules/orgs/components/org-badge'
import { DetailPageSkeleton } from '@/modules/shared/components/page-shell'
import { Button } from '@/modules/shared/components/ui/button'
import { Skeleton } from '@/modules/shared/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/modules/shared/components/ui/tabs'

import { describeAppsError, isAppsError } from '../graphql'
import {
  useApp,
  useAppAccess,
  useAppDeployments,
  useConfirmAppIdentity,
  useGithubDeployAppInfo,
  useAppRecord,
} from '../hooks/use-apps'
import {
  appHeadlineStatus,
  githubRepoUrl,
  hasProductionDeployment,
  identityState,
  primaryUrl,
  refLabel,
} from '../lib/status'
import { formatDate, formatTimestamp } from '@/modules/shared/lib/time'
import { timeAgo } from '@/modules/shared/lib/time'
import { LEGACY_ACCESS, resolveAccess } from '../lib/access'
import type { App, AppAccess } from '../types'
import { AppLogo } from './profile/app-logo'
import { AppAudit } from './app-audit'
import { AppDeployments } from './app-deployments'
import { AppEnvironment } from './app-environment'
import { AppOverview } from './app-overview'
import { AppPlans } from './app-plans'
import { TeamPlanCard } from './team-plan-card'
import { AppRollouts } from './app-rollouts'
import { AppReleases } from './app-releases'
import { TermInstances } from './term-instances'
import { termName } from '@/modules/publisher/lib/format'
import { useAppLogo, useAppName } from '../hooks/use-app-profile'
import { AppSettings, DeleteAppCard } from './app-settings'
import { AppProfileTab } from './profile/profile-tab'
import { GithubFlowLink } from './github-flow-link'
import { Banner } from './banner'
import { StatusPill } from '@/modules/shared/components/status'
import { useDocumentTitle } from '@/modules/shared/hooks/use-document-title'

/** Owner-only tabs, in display order. Tasks append to this as each tab lands. */
export const LICENSING_TABS = [
  'artifacts',
  'templates',
  'plans',
  'holders',
  'invite-codes',
] as const
const ALL_TABS = [
  'overview',
  'deployments',
  'profile',
  'releases',
  'rollouts',
  ...LICENSING_TABS,
  'environment',
  'audit',
  'settings',
] as const
export type AppTab = (typeof ALL_TABS)[number]

export const APP_TAB_LABEL: Record<AppTab, string> = {
  overview: 'Overview',
  deployments: 'Deployments',
  profile: 'Profile',
  releases: 'Releases',
  rollouts: 'Rollouts',
  artifacts: 'Artifacts',
  templates: 'Templates',
  plans: 'Plans',
  holders: 'Holders',
  'invite-codes': 'Invite codes',
  environment: 'Environment',
  audit: 'Audit log',
  settings: 'Settings',
}

const isLicensingTab = (t: AppTab): boolean => (LICENSING_TABS as readonly string[]).includes(t)

/**
 * Tabs of a licensing-only app: one that exists only as a licensing document (Vetra Studio),
 * with no repository, so no Overview, Deployments, Artifacts or Settings. Opens on the first
 * tab (Profile) unless the URL asks for another.
 */
export const LICENSING_ONLY_TABS = [
  'profile',
  'templates',
  'plans',
  'holders',
  'invite-codes',
] as const
type LicensingOnlyTab = (typeof LICENSING_ONLY_TABS)[number]
const LICENSING_ONLY_DEFAULT: LicensingOnlyTab = LICENSING_ONLY_TABS[0]

/**
 * Which page to show when the apps API does not have the app: the licensing-only page when the
 * caller publishes it (it is in myApps), a wait while that is still being checked, and "not
 * found" only when both agree.
 */
export function missingAppView({
  notFound,
  publisherPending,
  isPublisher,
  publisherError = false,
}: {
  notFound: boolean
  publisherPending: boolean
  isPublisher: boolean
  /** The myApps check failed: we cannot tell whether they publish it, so never "not found". */
  publisherError?: boolean
}): 'licensing-only' | 'checking' | 'unchecked' | 'not-found' | 'error' {
  if (!notFound) return 'error'
  if (isPublisher) return 'licensing-only'
  if (publisherPending) return 'checking'
  return publisherError ? 'unchecked' : 'not-found'
}

const TAB_LIST_CLASS =
  'h-auto w-full justify-start gap-6 overflow-x-auto rounded-none bg-transparent p-0 shadow-[inset_0_-1px_0_var(--border)] [scrollbar-width:none]'
const TAB_TRIGGER_CLASS =
  'data-[state=active]:border-b-foreground text-muted-foreground data-[state=active]:text-foreground dark:data-[state=active]:border-b-foreground h-10 flex-none shrink-0 rounded-none border-0 border-b-2 border-transparent bg-transparent px-0 shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:bg-transparent'

/** `/user/apps/[id]` for an app that exists only for licensing: its plans, holders and codes. */
function LicensingOnlyAppDetail({ app }: { app: PublisherApp }) {
  const name = useAppName(app.identityDid, app.name)
  const logo = useAppLogo(app.identityDid)
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  // A Studio-made app has an apps record and can be deleted; Vetra Studio has none.
  const { data: record } = useAppRecord(app.id)
  const tabs: (LicensingOnlyTab | 'settings')[] = record
    ? [...LICENSING_ONLY_TABS, 'settings']
    : [...LICENSING_ONLY_TABS]
  const tabParam = params.get('tab') ?? ''
  const tab = (tabs as readonly string[]).includes(tabParam)
    ? (tabParam as LicensingOnlyTab | 'settings')
    : LICENSING_ONLY_DEFAULT
  const setTab = (value: string) => {
    const next = new URLSearchParams(params.toString())
    if (value === LICENSING_ONLY_DEFAULT) next.delete('tab')
    else next.set('tab', value)
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
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
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <AppLogo name={name} seed={app.id} src={logo} appDid={app.identityDid} size="lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <h1 className="truncate text-3xl font-bold tracking-[-0.03em]">{name}</h1>
            <p className="text-muted-foreground text-sm">
              Managed here for licensing only: its plans, who holds them and its invite codes.
            </p>
          </div>
        </div>
      </div>

      {app.status !== 'ACTIVE' && <LicensingUnavailableBanner status={app.status} />}

      <PublisherSummaryRow appId={app.id} />

      <Tabs value={tab} onValueChange={setTab} className="gap-8">
        <TabsList className={TAB_LIST_CLASS}>
          {tabs.map((t) => (
            <TabsTrigger key={t} value={t} className={TAB_TRIGGER_CLASS}>
              {APP_TAB_LABEL[t]}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="profile">
          <AppProfileTab appId={app.id} appName={name} appDid={app.identityDid ?? null} />
        </TabsContent>
        <TabsContent value="templates">
          <TemplatesTab appId={app.id} />
        </TabsContent>
        <TabsContent value="plans">
          <PlansTab appId={app.id} />
        </TabsContent>
        <TabsContent value="holders">
          <HoldersTab appId={app.id} />
        </TabsContent>
        <TabsContent value="invite-codes">
          <InviteCodesTab appId={app.id} />
        </TabsContent>
        {record && (
          <TabsContent value="settings">
            <DeleteAppCard
              app={{ id: app.id, name: app.name, identityDid: app.identityDid ?? '' }}
              hasRepository={false}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

/**
 * Licensing tabs only for the app's publisher; Releases for anyone who can view an app with a
 * repository (a Studio product without GitHub has nothing vetra-publish could record).
 * `access` (appAccess) decides the rest: Profile and Settings for operators (Settings also for
 * whoever names release managers), Environment for operators and release managers. On a backend
 * with release managers (`releaseManagers`), anyone who views the app gets the Audit log, and
 * a release manager who does not publish its licensing gets a Plans tab of their own.
 */
export function visibleAppTabs({
  isPublisher,
  hasRepository = true,
  access = LEGACY_ACCESS,
  releaseManagers = false,
  licensingPending = false,
  hasDeployEnv = true,
}: {
  isPublisher: boolean
  hasRepository?: boolean
  access?: AppAccess
  /** The backend knows appAccess (audit log, release managers). */
  releaseManagers?: boolean
  /** The publisher check is still running: no Plans tab of its own yet. */
  licensingPending?: boolean
  /** The app has a production env (old deploy path); publish-only apps do not. */
  hasDeployEnv?: boolean
}): AppTab[] {
  const releasePlans =
    releaseManagers && !isPublisher && !licensingPending && hasRepository && access.release
  return [
    'overview',
    ...(hasDeployEnv ? (['deployments'] as const) : []),
    ...(access.operate ? (['profile'] as const) : []),
    ...(hasRepository ? (['releases'] as const) : []),
    ...(hasRepository && releaseManagers && access.release ? (['rollouts'] as const) : []),
    ...(isPublisher ? LICENSING_TABS : releasePlans ? (['plans'] as const) : []),
    ...(hasRepository && access.release ? (['environment'] as const) : []),
    ...(releaseManagers ? (['audit'] as const) : []),
    ...(access.operate || access.administer ? (['settings'] as const) : []),
  ]
}

function Header({ app, deployed }: { app: App; deployed: boolean }) {
  const name = useAppName(app.identityDid, app.name)
  const logo = useAppLogo(app.identityDid)
  const identity = identityState(app)
  // Before the first production deploy the URL serves the platform-default Connect.
  const url = deployed ? primaryUrl(app.productionUrls) : null
  const latest = app.latestDeployment
  const repository = app.repository?.fullName ?? null
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <AppLogo name={name} seed={app.id} src={logo} appDid={app.identityDid} size="lg" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="truncate text-3xl font-bold tracking-[-0.03em]">{name}</h1>
          <StatusPill meta={appHeadlineStatus(app)} />
          <OrgBadge orgId={app.ownerOrgId} />
        </div>
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {repository && (
            <a
              href={githubRepoUrl(repository)}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground inline-flex items-center gap-1.5"
            >
              <Github className="h-4 w-4" aria-hidden />
              {repository}
            </a>
          )}
          <span className="inline-flex items-center gap-1.5">
            <GitBranch className="h-4 w-4" aria-hidden />
            <span className="font-mono">{app.productionBranch}</span>
          </span>
          {latest && (
            <span>
              Last deploy {timeAgo(latest.createdAt)} from {refLabel(latest.gitRef)}
            </span>
          )}
          {(identity.kind === 'valid' || identity.kind === 'expiring') && (
            <span
              className={
                identity.kind === 'expiring'
                  ? 'text-warning inline-flex items-center gap-1.5'
                  : 'inline-flex items-center gap-1.5'
              }
              title={formatTimestamp(identity.expiresAt)}
            >
              <Fingerprint className="h-4 w-4" aria-hidden />
              Deploy identity valid until {formatDate(identity.expiresAt)}
            </span>
          )}
        </div>
      </div>
      {url && (
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
  const publisher = useAppPublisher(appId, app?.ownerOrgId ?? null)
  const accessQuery = useAppAccess(appId, !!app)
  const resolved = resolveAccess(accessQuery)
  const access = resolved.access ?? LEGACY_ACCESS
  const name = useAppName(
    app?.identityDid ?? publisher.app?.identityDid,
    app?.name ?? publisher.app?.name ?? '',
  )
  useDocumentTitle(name || null)

  const tabParam = params.get('tab')
  const identity = app ? identityState(app) : ({ kind: 'unknown' } as const)
  const repository = app?.repository?.fullName ?? null
  const visibleTabs = visibleAppTabs({
    isPublisher: publisher.isPublisher,
    hasRepository: repository !== null,
    access,
    releaseManagers: resolved.access !== null && resolved.supported,
    licensingPending: publisher.isPending,
    hasDeployEnv: app ? app.productionEnvironmentId !== null : true,
  })
  // While ownership or access is still being checked, a deep link to a tab not shown yet waits
  // on a skeleton instead of flashing Overview.
  const checkingLicensing = publisher.isPending
  const checking = checkingLicensing || resolved.access === null
  const requestedTab = (ALL_TABS as readonly string[]).includes(tabParam ?? '')
    ? (tabParam as AppTab)
    : null
  const awaitingTab =
    checking && requestedTab && !visibleTabs.includes(requestedTab) ? requestedTab : null
  const tab: AppTab =
    awaitingTab ?? (visibleTabs.includes(tabParam as AppTab) ? (tabParam as AppTab) : 'overview')
  const showLicensing = publisher.isPublisher
  // A failed ownership check hides the licensing tabs; say so, with a retry. "Not deployed here
  // yet" is only worth a banner when they came for a licensing tab.
  const licensingError =
    publisher.error &&
    (!isPublisherError(publisher.error, 'PUBLISHER_UNAVAILABLE') ||
      isLicensingTab(tabParam as AppTab))
      ? publisher.error
      : null

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

  // renownAuthorizeUrl returns to this page with ?identity=1 → confirmAppIdentity.
  const authorize = () => {
    if (app) window.location.assign(app.renownAuthorizeUrl)
  }

  const identityActions = (label: string, withCheck = true) => (
    <>
      <Button size="sm" onClick={authorize}>
        {label}
      </Button>
      {withCheck && (
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
      )}
    </>
  )

  if (appQuery.isPending) {
    return <DetailPageSkeleton label="Loading app" />
  }

  if (!app) {
    const notFound = !appQuery.error || isAppsError(appQuery.error, 'NOT_FOUND')
    const view = missingAppView({
      notFound,
      publisherPending: publisher.isPending,
      isPublisher: publisher.isPublisher,
      publisherError: !!publisher.error,
    })
    if (view === 'licensing-only' && publisher.app) {
      return <LicensingOnlyAppDetail app={publisher.app} />
    }
    if (view === 'unchecked') {
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
          <p className="text-lg font-semibold">We couldn’t check whether you publish this app</p>
          <p className="text-muted-foreground max-w-sm text-sm">
            {describePublisherError(publisher.error)}
          </p>
          <Button variant="outline" onClick={publisher.retry} disabled={publisher.retrying}>
            <RefreshCw className={publisher.retrying ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            Try again
          </Button>
        </div>
      )
    }
    if (view === 'checking') {
      return <DetailPageSkeleton label="Loading app" />
    }
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
        <Header app={app} deployed={hasProductionDeployment(app, deployments)} />

        {access.operate && identity.kind === 'pending' && (
          <Banner
            tone="warning"
            icon={Fingerprint}
            title="Authorize the deploy identity"
            actions={identityActions('Authorize on Renown')}
          >
            GitHub Actions cannot deploy until you approve this app&apos;s Renown identity once.
          </Banner>
        )}

        {access.operate && identity.kind === 'expired' && (
          <Banner
            tone="danger"
            icon={Fingerprint}
            title="Deploy identity expired — CI deploys are paused"
            actions={identityActions('Re-authorize')}
          >
            {identity.expiresAt ? `It expired on ${formatDate(identity.expiresAt)}. ` : ''}
            Re-authorize it on Renown (one signature) and pushes deploy again. Production keeps
            running meanwhile.
          </Banner>
        )}

        {access.operate && identity.kind === 'expiring' && (
          <Banner
            tone="warning"
            icon={Fingerprint}
            title={`Deploy identity expires in ${identity.daysLeft} day${identity.daysLeft === 1 ? '' : 's'}`}
            actions={identityActions('Re-authorize', false)}
          >
            Valid until {formatDate(identity.expiresAt)}. Re-authorize now so CI deploys don&apos;t
            pause.
          </Banner>
        )}

        {app.status === 'DISCONNECTED' && (
          <Banner
            tone="danger"
            icon={Unplug}
            title="GitHub disconnected"
            actions={
              access.operate && githubInfo.data?.installUrl ? (
                <Button size="sm" variant="outline" asChild>
                  <GithubFlowLink url={githubInfo.data.installUrl}>
                    <Github className="h-3.5 w-3.5" />
                    Reconnect
                  </GithubFlowLink>
                </Button>
              ) : undefined
            }
          >
            Vetra lost access to {repository ?? 'the repository'}. Deploys are paused and previews
            were removed. Reinstall the GitHub App to resume.
          </Banner>
        )}
      </div>

      {showLicensing &&
        isLicensingTab(tab) &&
        publisher.app &&
        publisher.app.status !== 'ACTIVE' && (
          <LicensingUnavailableBanner status={publisher.app.status} />
        )}

      {licensingError && (
        <Banner
          tone="warning"
          icon={TriangleAlert}
          title="Your plans and invite codes did not load"
          actions={
            <Button
              size="sm"
              variant="outline"
              onClick={publisher.retry}
              disabled={publisher.retrying}
            >
              <RefreshCw
                className={publisher.retrying ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'}
              />
              Try again
            </Button>
          }
        >
          {describePublisherError(licensingError)}
        </Banner>
      )}

      {showLicensing && <PublisherSummaryRow appId={appId} />}

      <Tabs value={tab} onValueChange={setTab} className="gap-8">
        {/* The baseline is an inset shadow, not a border: a scrolling list clips anything that
            hangs below it, which would cut off the active underline. */}
        <TabsList className={TAB_LIST_CLASS}>
          {visibleTabs.map((t) => (
            <Fragment key={t}>
              {/* Placeholders where the licensing tabs appear, while ownership is checked. */}
              {t === (repository ? 'environment' : 'settings') &&
                checkingLicensing &&
                LICENSING_TABS.map((l) => (
                  <Skeleton key={l} aria-hidden className="h-4 w-16 shrink-0 self-center" />
                ))}
              <TabsTrigger value={t} className={TAB_TRIGGER_CLASS}>
                {APP_TAB_LABEL[t]}
                {t === 'deployments' && deployments.length > 0 && (
                  <span className="bg-muted text-muted-foreground rounded-full px-1.5 text-[10px] font-semibold">
                    {deployments.length}
                  </span>
                )}
              </TabsTrigger>
            </Fragment>
          ))}
        </TabsList>

        {awaitingTab && <TabSkeleton label={`Loading ${APP_TAB_LABEL[awaitingTab]}`} />}

        <TabsContent value="overview">
          <AppOverview
            app={app}
            deployments={deployments}
            deploymentsLoaded={!deploymentsQuery.isPending}
            onAuthorize={authorize}
            onEditProfile={access.operate ? () => setTab('profile') : undefined}
            onOpenTab={setTab}
            canOperate={access.operate}
            canManageLicensing={showLicensing}
          />
        </TabsContent>
        <TabsContent value="deployments">
          <AppDeployments
            app={app}
            deployments={deployments}
            isPending={deploymentsQuery.isPending}
            error={deploymentsQuery.error}
            onRetry={() => void deploymentsQuery.refetch()}
            retrying={deploymentsQuery.isRefetching}
            canOperate={access.operate}
          />
        </TabsContent>
        <TabsContent value="profile">
          <AppProfileTab appId={appId} appName={name} appDid={app.identityDid} />
        </TabsContent>
        <TabsContent value="releases">
          <AppReleases
            appId={appId}
            repository={repository}
            instancesEnabled={app.instancesEnabled === true}
          />
        </TabsContent>
        {repository && visibleTabs.includes('rollouts') && (
          <TabsContent value="rollouts">
            <AppRollouts appId={appId} canRelease={access.release} />
          </TabsContent>
        )}
        {showLicensing && (
          <TabsContent value="artifacts">
            <ArtifactsTab appId={appId} />
          </TabsContent>
        )}
        {showLicensing && (
          <TabsContent value="templates">
            <TemplatesTab appId={appId} />
          </TabsContent>
        )}
        {showLicensing && (
          <TabsContent value="plans" className="space-y-6">
            {repository && <TeamPlanCard app={app} canAdminister={access.administer} />}
            <PlansTab
              appId={appId}
              termExtra={
                repository
                  ? (t) => (
                      <TermInstances
                        appId={appId}
                        term={{ kind: t.kind, name: termName(t), activeLicenses: t.activeLicenses }}
                        canRelease={access.release}
                      />
                    )
                  : undefined
              }
            />
          </TabsContent>
        )}
        {showLicensing && (
          <TabsContent value="holders">
            <HoldersTab appId={appId} />
          </TabsContent>
        )}
        {showLicensing && (
          <TabsContent value="invite-codes">
            <InviteCodesTab appId={appId} />
          </TabsContent>
        )}
        {!showLicensing && visibleTabs.includes('plans') && (
          <TabsContent value="plans">
            <AppPlans
              appId={appId}
              canRelease={access.release}
              app={repository ? app : undefined}
              canAdminister={access.administer}
            />
          </TabsContent>
        )}
        {repository && (
          <TabsContent value="environment">
            <AppEnvironment appId={appId} instancesEnabled={app.instancesEnabled === true} />
          </TabsContent>
        )}
        {visibleTabs.includes('audit') && (
          <TabsContent value="audit">
            <AppAudit appId={appId} />
          </TabsContent>
        )}
        {visibleTabs.includes('settings') && (
          <TabsContent value="settings">
            <AppSettings
              app={app}
              onAuthorize={authorize}
              canEdit={access.operate}
              canAdminister={access.administer && resolved.supported}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
