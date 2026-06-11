'use client'

import { ArrowLeft, ExternalLink, Settings } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, use, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { AgentDetailDrawer } from '@/modules/cloud/components/agent-detail-drawer'
import { EnvActionBar } from '@/modules/cloud/components/env-action-bar'
import { useDebouncedValue } from '@/modules/cloud/hooks/use-debounced-value'
import { EnvSettingsDrawer } from '@/modules/cloud/components/env-settings-drawer'
import { ServiceDetailDrawer } from '@/modules/cloud/components/service-detail-drawer'
import { StatusBadge } from '@/modules/cloud/components/status-badge'
import { useCanSign } from '@/modules/cloud/hooks/use-can-sign'
import { useClintPackages } from '@/modules/cloud/hooks/use-clint-packages'
import { useClintRuntimeEndpoints } from '@/modules/cloud/hooks/use-clint-runtime-endpoints'
import { useDetailDrawer } from '@/modules/cloud/hooks/use-detail-drawer'
import { useEnvironmentDetail } from '@/modules/cloud/hooks/use-environment-detail'
import { useEnvironmentStatus } from '@/modules/cloud/hooks/use-environment-status'
import { generateSubdomain } from '@/modules/cloud/subdomain'
import { getTenantId } from '@/modules/cloud/tenant-id'
import { Button } from '@/modules/shared/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/modules/shared/components/ui/dropdown-menu'
import { HeroCard } from '@/modules/shared/components/ui/card'

import { InlineEditableTitle, OverviewTab } from './tabs/overview'

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
const warnedRuntimeConfigPayloads = new Set<string>()
function warnRuntimeConfigOnce(raw: string, message: string, detail?: unknown) {
  if (warnedRuntimeConfigPayloads.has(raw)) return
  warnedRuntimeConfigPayloads.add(raw)
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

function EnvironmentDetail({ documentId }: { documentId: string }) {
  const searchParams = useSearchParams()

  const detail = useEnvironmentDetail(documentId)
  const { environment, isLoading } = detail

  const state = environment?.state
  const subdomain = state?.genericSubdomain ?? null
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
    if (!environment || subdomainHealedRef.current) return
    if (environment.state.genericSubdomain === null) {
      subdomainHealedRef.current = true
      void detail.setGenericSubdomain(generateSubdomain(environment.id))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [environment, detail.setGenericSubdomain])

  // Auto-heal: set defaultPackageRegistry if missing
  const registryHealedRef = useRef(false)
  useEffect(() => {
    if (!environment || registryHealedRef.current) return
    if (environment.state.defaultPackageRegistry === null) {
      registryHealedRef.current = true
      void detail.setDefaultPackageRegistry('https://registry.dev.vetra.io')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [environment, detail.setDefaultPackageRegistry])

  // Approve / Deploy intent lock. Flipped synchronously on click so the
  // floating action bar can speculatively render "Deploying…" through any
  // subscription-vs-push race. Cleared once status leaves the pre-click
  // states; the bar's own 3s window covers the early window in case the
  // useEffect below clears too early.
  const [intentDeploying, setIntentDeploying] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const statusStr = state?.status ?? 'DRAFT'
  useEffect(() => {
    if (intentDeploying && statusStr !== 'CHANGES_PENDING' && statusStr !== 'DRAFT') {
      setIntentDeploying(false)
    }
  }, [statusStr, intentDeploying])
  const handleApprove = async () => {
    setIntentDeploying(true)
    try {
      await detail.approveChanges()
    } catch (err) {
      setIntentDeploying(false)
      toast.error(err instanceof Error ? err.message : 'Failed to approve changes')
    }
  }

  const { canSign } = useCanSign()
  const { clintPackages } = useClintPackages({
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
    return <p className="text-muted-foreground">Loading environment...</p>
  }

  const displayName = state?.label || environment?.name || 'Environment'
  const baseDomain = state?.genericBaseDomain ?? 'vetra.io'

  // Build visit URLs from enabled services
  const enabledServices = state?.services.filter((s) => s.enabled) ?? []

  return (
    <>
      {/* Header — HeroCard with glass surface so it lifts off the
          ambient background and reads as the page's anchor. The "Back
          to Cloud" link sits outside the card as a breadcrumb. */}
      <div className="space-y-4">
        <Link
          href="/user/environments"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Cloud
        </Link>
        <HeroCard glass>
          <div className="flex flex-wrap items-center gap-3 p-6">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-3">
                <InlineEditableTitle value={displayName} onSave={detail.setLabel} />
                {state && (
                  <StatusBadge
                    environmentStatus={state.status}
                    argoHealthStatus={envStatus?.argoHealthStatus}
                    argoSyncStatus={envStatus?.argoSyncStatus}
                    isLoading={statusLoading && !envStatus}
                  />
                )}
              </div>
              {subdomain && (
                <p className="text-muted-foreground truncate font-mono text-xs">
                  {subdomain}.{baseDomain}
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
              {subdomain && enabledServices.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="flex items-center gap-1.5">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Visit
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {enabledServices.map((svc) => {
                      // Switchboard's only useful entry-point is the GraphQL
                      // playground — the bare host returns a default page with
                      // no playground link. Append /graphql so "Visit" lands
                      // somewhere meaningful.
                      const path = svc.type === 'SWITCHBOARD' ? '/graphql' : ''
                      return (
                        <DropdownMenuItem key={svc.type} asChild>
                          <a
                            href={`https://${svc.prefix}.${subdomain}.${baseDomain}${path}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {svc.type === 'CONNECT'
                              ? 'Connect'
                              : svc.type === 'SWITCHBOARD'
                                ? 'Switchboard'
                                : 'Fusion'}
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
            setPackageVersion={detail.setPackageVersion}
            initialAddPackage={searchParams.get('addPackage')}
            initialAddVersion={searchParams.get('version')}
            onOpenServiceDetail={(kind) => drawer.open({ kind: 'service', id: kind }, 'logs')}
            onOpenAgentDetail={(prefix) => drawer.open({ kind: 'agent', id: prefix }, 'logs')}
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
          subdomain={subdomain}
          tenantId={tenantId}
          documentId={documentId}
          isStopped={isInactive}
          canEdit={canSign && !isInactive}
          pods={envPods}
          activeTab={drawer.tab ?? 'logs'}
          onTabChange={drawer.setTab}
          backupSchedule={state.backupSchedule ?? null}
          onSaveBackupSchedule={detail.setBackupSchedule}
          backupScheduleSupported={detail.backupScheduleSupported}
          runtimeConfig={parseRuntimeConfig(state.runtimeConfig)}
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
          canEdit={canSign}
          manifest={
            drawerAgent.config
              ? (clintManifestsByName[drawerAgent.config.package.name] ?? null)
              : null
          }
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

      <EnvActionBar
        status={state?.status}
        intentDeploying={intentDeploying}
        driftDetected={!!envStatus?.configDriftDetected}
        onApprove={() => void handleApprove()}
      />

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
    <main className="mx-auto mt-20 max-w-screen-xl space-y-8 px-6 py-8">
      <Suspense fallback={<p className="text-muted-foreground">Loading...</p>}>
        <EnvironmentDetail documentId={project} />
      </Suspense>
    </main>
  )
}
