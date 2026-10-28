'use client'

import { EnvironmentLicenceBanner } from '@/modules/subscriptions/components/environment-licence'
import { ArrowLeft, ExternalLink, RefreshCw, Settings } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, use, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { AgentDetailDrawer } from '@/modules/cloud/components/agent-detail-drawer'
import { EnvActionBar } from '@/modules/cloud/components/env-action-bar'
import { useDebouncedValue } from '@/modules/cloud/hooks/use-debounced-value'
import { AddonsSection } from '@/modules/cloud/components/addons-section'
import { EnvSettingsDrawer } from '@/modules/cloud/components/env-settings-drawer'
import { ServiceDetailDrawer } from '@/modules/cloud/components/service-detail-drawer'
import { StatusBadge } from '@/modules/cloud/components/status-badge'
import { useClintPackages } from '@/modules/cloud/hooks/use-clint-packages'
import { useClintRuntimeEndpoints } from '@/modules/cloud/hooks/use-clint-runtime-endpoints'
import { useDetailDrawer } from '@/modules/cloud/hooks/use-detail-drawer'
import { useEnvironmentDetail } from '@/modules/cloud/hooks/use-environment-detail'
import { useCanEditEnvironment } from '@/modules/cloud/hooks/use-environment-org'
import { OrgBadge } from '@/modules/orgs/components/org-badge'
import { useEnvironmentStatus } from '@/modules/cloud/hooks/use-environment-status'
import { generateSubdomain } from '@/modules/cloud/subdomain'
import { getTenantId } from '@/modules/cloud/tenant-id'
import {
  customDomainServiceHost,
  envHeaderHost,
  isPinnedToCustomApex,
  isTypeAtApex,
  resolveGenericHost,
} from '@/modules/cloud/lib/env-host'
import { useTenantConfig } from '@/modules/cloud/hooks/use-tenant-config'
import { describeCloudError } from '@/modules/cloud/lib/cloud-error'
import {
  isVisitableService,
  serviceInstanceKey,
  serviceInstanceLabel,
} from '@/modules/cloud/lib/service-label'
import { useMyApps } from '@/modules/apps/hooks/use-apps'
import {
  DOCLING_PREFIX,
  PAPERLESS_PREFIX,
  SPECKLE_PREFIX,
  type AddonConfigStore,
  type AddonControl,
  type AddonId,
} from '@/modules/cloud/lib/addons'
import { useServiceAddon } from '@/modules/cloud/hooks/use-service-addon'
import { useWorkflowsAddon } from '@/modules/cloud/hooks/use-workflows-addon'
import { DetailPageSkeleton } from '@/modules/shared/components/page-shell'
import { RequireLogin } from '@/modules/shared/components/renown/require-login'
import { Button } from '@/modules/shared/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/modules/shared/components/ui/dropdown-menu'
import { HeroCard } from '@/modules/shared/components/ui/card'

import { InlineEditableTitle, OverviewTab } from './tabs/overview'
import { defaultPackageRegistry } from '@/modules/cloud/switchboard-url'

// ---------------------------------------------------------------------------
// EnvironmentDetail — single-column env page; no env-level tabs. Per-service
// and per-agent observability surfaces live in side drawers (see
// `useDetailDrawer` for URL state). This was previously a tab orchestrator.
// ---------------------------------------------------------------------------

/**
 * state.runtimeConfig is a JSON string (the doc-model field is a String
 * scalar). Parse it into the object shape the RuntimeConfigDrawer edits;
 * tolerate null / corrupt JSON by returning null. Malformed payloads must
 * never break the page — they degrade to "no overrides" with a console
 * warning explaining why (logged once per distinct payload, since this
 * runs on every render).
 */
// Bounded dedup set. Module-scope, keyed by the raw payload string, so it
// would grow unbounded across distinct payloads (this runs on every render).
// A warning-dedup set never needs to be large — cap it and evict the oldest.
const WARNED_MAX = 200
const warnedRuntimeConfigPayloads = new Set<string>()
function warnRuntimeConfigOnce(raw: string, message: string, detail?: unknown) {
  if (warnedRuntimeConfigPayloads.has(raw)) return
  warnedRuntimeConfigPayloads.add(raw)
  if (warnedRuntimeConfigPayloads.size > WARNED_MAX) {
    warnedRuntimeConfigPayloads.delete(warnedRuntimeConfigPayloads.values().next().value as string)
  }
  console.warn(`[runtime-config] ${message}`, detail ?? '')
}

function parseRuntimeConfig(
  raw: string | null | undefined,
): { connect?: Record<string, unknown>; packageRegistryUrl?: string } | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      warnRuntimeConfigOnce(
        raw,
        'state.runtimeConfig is not a JSON object — ignoring stored overrides',
        parsed,
      )
      return null
    }
    // Validate the sub-shapes the drawer consumes; drop (and warn about)
    // anything malformed rather than letting it reach the form and crash.
    const result: { connect?: Record<string, unknown>; packageRegistryUrl?: string } = {}
    const { connect, packageRegistryUrl } = parsed
    if (connect !== undefined && connect !== null) {
      if (typeof connect === 'object' && !Array.isArray(connect)) {
        result.connect = connect as Record<string, unknown>
      } else {
        warnRuntimeConfigOnce(
          raw,
          'state.runtimeConfig.connect is not an object — ignoring stored connect overrides',
          connect,
        )
      }
    }
    if (typeof packageRegistryUrl === 'string') {
      result.packageRegistryUrl = packageRegistryUrl
    }
    return result
  } catch (err) {
    warnRuntimeConfigOnce(
      raw,
      'failed to parse state.runtimeConfig — ignoring stored overrides',
      err,
    )
    return null
  }
}

/** A load error that means the document does not exist (or is not visible). */
function isNotFoundError(error: Error): boolean {
  return /ENV_NOT_FOUND|not found|does not exist|no document/i.test(error.message)
}

function EnvironmentDetail({ documentId }: { documentId: string }) {
  const searchParams = useSearchParams()

  const detail = useEnvironmentDetail(documentId)
  const { environment, isLoading } = detail
  // The env's organisation comes from the signed controller's document state,
  // or the read-only fetch before it loads (badge). Edit controls need
  // canOperate on an org env (Ruling R6), the signer alone on a personal one
  // (only once the controller has loaded); personal envs never sync.
  const canEdit = useCanEditEnvironment(documentId, detail.editGateOwnerOrgId)
  const ownerOrgId = environment?.state.ownerOrgId ?? null

  const state = environment?.state
  const subdomain = state?.genericSubdomain ?? null
  // App environments are hidden from the Cloud list, so "back" leads to the app.
  const appId = environment?.app?.appId ?? state?.app?.appId ?? null
  const { data: myApps } = useMyApps()
  const appName = appId ? myApps?.find((a) => a.id === appId)?.name : undefined
  const tenantId = subdomain && environment ? getTenantId(subdomain, environment.id) : null
  const TRULY_INACTIVE = new Set(['DRAFT', 'DESTROYED', 'ARCHIVED', 'STOPPED'])
  const isInactive = TRULY_INACTIVE.has(state?.status ?? 'DRAFT')

  const {
    status: rawEnvStatus,
    pods: envPods,
    isLoading: statusLoading,
  } = useEnvironmentStatus(subdomain, tenantId, documentId)
  // Smooth out subscription resyncs that briefly oscillate before settling.
  // 250ms is short enough that "really new" updates feel instant, long
  // enough to collapse stale push → correction flickers into one visible
  // transition.
  const envStatus = useDebouncedValue(rawEnvStatus, 250)

  // Drawer state (per-service / per-agent detail) is keyed in the URL via
  // `?drawer=service:<id>` or `?drawer=agent:<prefix>`. Hook owns parsing and
  // navigation; the page just reads `scope`/`tab` and provides handlers.
  const drawer = useDetailDrawer()

  // Auto-heal: set genericSubdomain if missing
  const subdomainHealedRef = useRef(false)
  useEffect(() => {
    if (!environment || !canEdit || subdomainHealedRef.current) return
    if (environment.state.genericSubdomain === null) {
      subdomainHealedRef.current = true
      detail.setGenericSubdomain(generateSubdomain(environment.id)).catch(() => undefined)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [environment, canEdit, detail.setGenericSubdomain])

  // Auto-heal: set defaultPackageRegistry if missing — to this deployment's
  // registry, never a hardcoded one (prod must not land on the dev registry).
  const registryHealedRef = useRef(false)
  useEffect(() => {
    if (!environment || !canEdit || registryHealedRef.current) return
    if (environment.state.defaultPackageRegistry === null) {
      registryHealedRef.current = true
      detail.setDefaultPackageRegistry(defaultPackageRegistry()).catch(() => undefined)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [environment, canEdit, detail.setDefaultPackageRegistry])

  // Approve / Deploy intent lock. Flipped synchronously on click so the
  // floating action bar can speculatively render "Deploying…" through any
  // subscription-vs-push race. Cleared once status leaves the pre-click
  // states; the bar's own 3s window covers the early window in case the
  // useEffect below clears too early.
  const [intentDeploying, setIntentDeploying] = useState(false)
  // `?settings=organisation` (the retry link after a failed hand-over at create
  // time) opens the settings drawer on the tab holding "Move to an organisation".
  const settingsParam = searchParams.get('settings')
  const [settingsOpen, setSettingsOpen] = useState(settingsParam === 'organisation')
  const statusStr = state?.status ?? 'DRAFT'
  useEffect(() => {
    if (intentDeploying && statusStr !== 'CHANGES_PENDING' && statusStr !== 'DRAFT') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIntentDeploying(false)
    }
  }, [statusStr, intentDeploying])
  const handleApprove = async () => {
    setIntentDeploying(true)
    try {
      await detail.approveChanges()
    } catch (err) {
      setIntentDeploying(false)
      toast.error(describeCloudError(err, "Couldn't deploy the changes. Try again."))
    }
  }

  const {
    envVars,
    secrets,
    setVar,
    setSecret,
    deleteVar,
    deleteSecret,
    isLoaded: tenantConfigLoaded,
    error: tenantConfigError,
  } = useTenantConfig(tenantId)
  const addonConfigStore = useMemo<AddonConfigStore | undefined>(
    () =>
      tenantConfigLoaded
        ? { envVars, secrets, setVar, setSecret, deleteVar, deleteSecret }
        : undefined,
    [tenantConfigLoaded, envVars, secrets, setVar, setSecret, deleteVar, deleteSecret],
  )
  const runtimeConfig = useMemo(
    () => parseRuntimeConfig(state?.runtimeConfig),
    [state?.runtimeConfig],
  )

  const { setRuntimeConfig, runtimeConfigSupported, enableService, disableService } = detail
  const baseDomain = state?.genericBaseDomain ?? 'vetra.io'
  const addons: Record<AddonId, AddonControl> = {
    docling: useServiceAddon({
      services: state?.services,
      type: 'DOCLING',
      prefix: DOCLING_PREFIX,
      enableService,
      disableService,
    }),
    paperless: useServiceAddon({
      services: state?.services,
      type: 'PAPERLESS',
      prefix: PAPERLESS_PREFIX,
      enableService,
      disableService,
    }),
    speckle: useServiceAddon({
      services: state?.services,
      type: 'SPECKLE',
      prefix: SPECKLE_PREFIX,
      enableService,
      disableService,
      // Never at the apex: the chart always serves Speckle on its own host.
      href: subdomain
        ? `https://${resolveGenericHost(subdomain, SPECKLE_PREFIX, false, baseDomain)}`
        : undefined,
      hrefLabel: 'Open Speckle',
    }),
    workflows: useWorkflowsAddon({
      tenantId,
      envVars,
      setVar,
      tenantConfigLoaded,
      tenantConfigError,
      runtimeConfig,
      setRuntimeConfig,
      runtimeConfigSupported,
    }),
  }

  const { clintPackages, isLoading: manifestsLoading } = useClintPackages({
    registry: state?.defaultPackageRegistry ?? null,
    packages: state?.packages ?? [],
  })
  const clintManifestsByName = useMemo(
    () => Object.fromEntries(clintPackages.map((p) => [p.package.name, p.manifest])),
    [clintPackages],
  )
  const { byPrefix: clintRuntimeEndpointsByPrefix } = useClintRuntimeEndpoints(
    subdomain,
    documentId,
  )

  // Resolve the active drawer scope into the concrete service/agent the
  // drawer needs. We do this here (not inside the drawers) so the drawers
  // can stay dumb renderers and the URL drives mount/unmount.
  const drawerService = useMemo(() => {
    if (!state || drawer.scope?.kind !== 'service') return null
    const enumKind = drawer.scope.id.toUpperCase() as 'CONNECT' | 'SWITCHBOARD' | 'FUSION'
    return state.services.find((s) => s.type === enumKind) ?? null
  }, [state, drawer.scope])

  const drawerAgent = useMemo(() => {
    if (!state || drawer.scope?.kind !== 'agent') return null
    return state.services.find((s) => s.type === 'CLINT' && s.prefix === drawer.scope!.id) ?? null
  }, [state, drawer.scope])

  if (isLoading) {
    return <DetailPageSkeleton label="Loading environment" />
  }

  if (!environment) {
    const notFound = !detail.error || isNotFoundError(detail.error)
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-lg font-semibold">
          {notFound ? 'Environment not found' : 'Couldn’t load this environment'}
        </p>
        <p className="text-muted-foreground max-w-sm text-sm">
          {notFound
            ? 'It may have been deleted, or it belongs to another account.'
            : describeCloudError(detail.error, 'Something went wrong while loading it. Try again.')}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {!notFound && (
            <Button variant="outline" onClick={detail.retry}>
              <RefreshCw className="h-4 w-4" />
              Try again
            </Button>
          )}
          <Button asChild variant={notFound ? 'outline' : 'ghost'}>
            <Link href="/user/environments">Back to Cloud</Link>
          </Button>
        </div>
      </div>
    )
  }

  const displayName = state?.label || environment?.name || 'Environment'

  // Build visit URLs from enabled services that answer on a host.
  const visitableServices = state?.services.filter((s) => s.enabled && isVisitableService(s)) ?? []
  const customDomain = state?.customDomain?.enabled ? (state.customDomain.domain ?? null) : null
  const customDomainVerified =
    envStatus?.domainResolves === true && envStatus?.tlsCertValid === true
  // Same rule as the Overview service cards: the custom host once DNS + TLS are
  // verified, or always when pinned to the custom apex (no generic host then).
  const visitHost = (svc: { type: string; prefix: string }) => {
    const services = state?.services ?? []
    const custom = customDomainServiceHost(services, state?.apexService, customDomain, svc.type)
    const pinned = isPinnedToCustomApex(services, state?.apexService, customDomain, svc.type)
    if (custom && (customDomainVerified || pinned)) return custom
    return resolveGenericHost(
      subdomain ?? '',
      svc.prefix,
      isTypeAtApex(services, state?.apexService, svc.type),
      baseDomain,
    )
  }

  return (
    <>
      {/* Header — the page's anchor card. The back link sits outside
          the card as a breadcrumb. */}
      <div className="space-y-4">
        <Link
          href={appId ? `/user/apps/${appId}` : '/user/environments'}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {appId ? `Back to ${appName ?? 'app'}` : 'Back to Cloud'}
        </Link>
        <EnvironmentLicenceBanner environmentId={documentId} />
        <HeroCard>
          <div className="flex flex-wrap items-center gap-3 p-6">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-3">
                <InlineEditableTitle
                  value={displayName}
                  onSave={detail.setLabel}
                  readOnly={!canEdit}
                />
                {state && (
                  <StatusBadge
                    environmentStatus={state.status}
                    argoHealthStatus={envStatus?.argoHealthStatus}
                    argoSyncStatus={envStatus?.argoSyncStatus}
                    isLoading={statusLoading && !envStatus}
                  />
                )}
                <OrgBadge orgId={ownerOrgId} />
              </div>
              {subdomain && (
                <p className="text-muted-foreground truncate font-mono text-xs">
                  {/* A real bare host only when one exists (custom apex pin or a
                      lone routable service); with several services there is no
                      bare host, so show the subdomain as a label, not an address. */}
                  {envHeaderHost({
                    subdomain,
                    baseDomain,
                    services: state?.services ?? [],
                    apexService: state?.apexService,
                    customDomain: customDomain,
                  }) ?? subdomain}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Deploy / Approve / Deploying… surfaces in <EnvActionBar/>
                  pinned to the bottom of the viewport, not here in the hero. */}

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSettingsOpen(true)}
                aria-label="Environment settings"
                className="text-muted-foreground hover:text-foreground"
              >
                <Settings className="h-4 w-4" />
              </Button>

              {/* Visit dropdown */}
              {subdomain && visitableServices.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="flex items-center gap-1.5">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Visit
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {visitableServices.map((svc) => {
                      // Switchboard's only useful entry-point is the GraphQL
                      // playground — the bare host returns a default page with
                      // no playground link. Append /graphql so "Visit" lands
                      // somewhere meaningful.
                      const path = svc.type === 'SWITCHBOARD' ? '/graphql' : ''
                      return (
                        <DropdownMenuItem key={serviceInstanceKey(svc)} asChild>
                          <a
                            href={`https://${visitHost(svc)}${path}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {serviceInstanceLabel(svc)}
                          </a>
                        </DropdownMenuItem>
                      )
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </HeroCard>
      </div>

      {/* Sections — single column, top to bottom. The previous env-level
          tabs (Logs / Metrics / Deployments / Configuration) folded into
          the per-service / per-agent drawers and the inline Configuration
          section below. */}
      {state && environment && (
        <div className="space-y-8">
          <OverviewTab
            subdomain={subdomain}
            tenantId={tenantId}
            environment={environment}
            status={envStatus}
            pods={envPods}
            statusLoading={statusLoading}
            enableService={detail.enableService}
            disableService={detail.disableService}
            setServiceConfig={detail.setServiceConfig}
            setServiceSize={detail.setServiceSize}
            addPackage={detail.addPackage}
            removePackage={detail.removePackage}
            setServiceVersion={detail.setServiceVersion}
            setFusionConfig={detail.setFusionConfig}
            setPackageVersion={detail.setPackageVersion}
            initialAddPackage={searchParams.get('addPackage')}
            initialAddVersion={searchParams.get('version')}
            onOpenServiceDetail={(kind) => drawer.open({ kind: 'service', id: kind }, 'logs')}
            onOpenAgentDetail={(prefix) => drawer.open({ kind: 'agent', id: prefix }, 'logs')}
            addons={
              <fieldset disabled={!canEdit} className="m-0 min-w-0 border-0 p-0">
                <AddonsSection
                  environmentStatus={state.status}
                  addons={addons}
                  configStore={addonConfigStore}
                />
              </fieldset>
            }
          />
        </div>
      )}

      {/* Drawers — mounted at page level so URL state controls visibility.
          We pass the resolved service/agent down so the drawer doesn't
          need to know about the doc model. */}
      {state && environment && drawer.scope?.kind === 'service' && (
        <ServiceDetailDrawer
          open
          onClose={drawer.close}
          kind={drawer.scope.id}
          service={drawerService ?? undefined}
          services={state.services}
          apexService={state.apexService ?? null}
          subdomain={subdomain}
          tenantId={tenantId}
          documentId={documentId}
          isStopped={isInactive}
          canEdit={canEdit && !isInactive}
          pods={envPods}
          activeTab={drawer.tab ?? 'logs'}
          onTabChange={drawer.setTab}
          backupSchedule={state.backupSchedule ?? null}
          onSaveBackupSchedule={detail.setBackupSchedule}
          backupScheduleEditable={detail.backupScheduleEditable}
          runtimeConfig={runtimeConfig}
          onSaveRuntimeConfig={detail.setRuntimeConfig}
          runtimeConfigSupported={detail.runtimeConfigSupported}
        />
      )}
      {state && environment && drawer.scope?.kind === 'agent' && drawerAgent && (
        <AgentDetailDrawer
          open
          onClose={drawer.close}
          service={drawerAgent}
          env={environment}
          subdomain={subdomain}
          tenantId={tenantId}
          isStopped={isInactive}
          canEdit={canEdit}
          manifest={
            drawerAgent.config
              ? (clintManifestsByName[drawerAgent.config.package.name] ?? null)
              : null
          }
          manifestLoading={manifestsLoading}
          runtimeEndpoints={clintRuntimeEndpointsByPrefix[drawerAgent.prefix] ?? null}
          pods={envPods}
          activeTab={drawer.tab ?? 'logs'}
          onTabChange={drawer.setTab}
          onSaveConfig={
            detail.setServiceConfig
              ? async (config) => {
                  await detail.setServiceConfig(drawerAgent.prefix, config)
                  toast.success('Agent updated')
                }
              : undefined
          }
          onDisable={async () => {
            await detail.disableService('CLINT', drawerAgent.prefix)
            toast.success('Agent removed')
            drawer.close()
          }}
        />
      )}

      {canEdit && (
        <EnvActionBar
          status={state?.status}
          intentDeploying={intentDeploying}
          driftDetected={!!envStatus?.configDriftDetected}
          onApprove={() => void handleApprove()}
        />
      )}

      {environment && (
        <EnvSettingsDrawer
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          environment={environment}
          tenantId={tenantId}
          subdomain={subdomain}
          status={envStatus}
          statusLoading={statusLoading}
          onSetCustomDomain={detail.setCustomDomain}
          onSetAutoUpdateChannel={detail.setAutoUpdateChannel}
          onUpdateToLatest={detail.updateToLatest}
          onRollbackRelease={detail.rollbackRelease}
          onTerminate={detail.terminate}
          canEdit={canEdit}
          ownerOrgId={ownerOrgId}
          defaultTab={settingsParam === 'organisation' ? 'metadata' : undefined}
          onHandedOver={() => void detail.refresh()}
        />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Page — wraps EnvironmentDetail in Suspense for useSearchParams
// ---------------------------------------------------------------------------

type PageProps = {
  params: Promise<{ project: string }>
}

export default function EnvironmentDetailPage({ params }: PageProps) {
  const { project } = use(params)
  return (
    <RequireLogin title="Log in to see this environment">
      <main className="mx-auto mt-20 max-w-screen-xl space-y-8 px-6 py-8">
        <Suspense fallback={<DetailPageSkeleton label="Loading environment" />}>
          <EnvironmentDetail documentId={project} />
        </Suspense>
      </main>
    </RequireLogin>
  )
}
