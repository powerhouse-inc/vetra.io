'use client'

import {
  Activity,
  BarChart2,
  Database,
  FileJson2,
  FileText,
  Globe,
  Lock,
  RefreshCw,
  RotateCw,
  Server,
  Zap,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useRenown, useRenownAuth } from '@powerhousedao/reactor-browser'

import { AsyncButton } from '@/modules/cloud/components/async-button'
import { getAuthToken, restartEnvironmentService } from '@/modules/cloud/graphql'
import { useEnvironmentEvents } from '@/modules/cloud/hooks/use-environment-events'
import { useEnvironmentLogs } from '@/modules/cloud/hooks/use-environment-logs'
import { useEnvironmentMetrics } from '@/modules/cloud/hooks/use-environment-metrics'
import { getServiceQuota } from '@/modules/cloud/lib/resource-maps'
import { extractRestartTimestamps } from '@/modules/cloud/lib/restart-events'
import type {
  BackupCadence,
  BackupSchedule,
  CloudEnvironmentService,
  KubeEvent,
  MetricRange,
  MetricSeries,
  Pod,
  TenantService,
} from '@/modules/cloud/types'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/modules/shared/components/ui/alert-dialog'
import { Button } from '@/modules/shared/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/modules/shared/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/modules/shared/components/ui/tabs'

import { DatabaseTabBody } from './database-tab-body'
import { EventTimeline } from './event-timeline'
import { LogViewer } from './log-viewer'
import { MetricCard } from './metric-card'
import { RuntimeConfigDrawer } from './runtime-config-drawer'
import { AuthTab } from './switchboard-auth/auth-tab'
import { TimeRangePicker } from './time-range-picker'

type ServiceKind = 'connect' | 'switchboard' | 'fusion'

const SERVICE_LABEL: Record<ServiceKind, string> = {
  connect: 'Connect',
  switchboard: 'Switchboard',
  fusion: 'Fusion',
}

const SERVICE_ICON: Record<ServiceKind, React.ComponentType<{ className?: string }>> = {
  connect: Globe,
  switchboard: Server,
  fusion: Zap,
}

function toTenantService(kind: ServiceKind): TenantService | null {
  if (kind === 'connect') return 'CONNECT'
  if (kind === 'switchboard') return 'SWITCHBOARD'
  return null
}

function filterSeriesByPods(series: MetricSeries[], podNames: Set<string>): MetricSeries[] {
  if (podNames.size === 0) return series
  return series.filter((s) => podNames.has(s.label))
}

function filterEventsByPods(events: KubeEvent[], podNames: Set<string>): KubeEvent[] {
  if (podNames.size === 0) return events
  return events.filter((e) => {
    for (const pod of podNames) {
      if (e.involvedObject.includes(pod)) return true
    }
    return false
  })
}

type Props = {
  open: boolean
  onClose: () => void
  kind: ServiceKind
  service: CloudEnvironmentService | undefined
  subdomain: string | null
  tenantId: string | null
  documentId: string
  isStopped: boolean
  /**
   * Whether the viewer can mutate env resources. Only used by the Database
   * tab (switchboard-only) to gate the "Create dump" button. Other tabs are
   * read-only.
   */
  canEdit: boolean
  pods?: readonly Pod[]
  activeTab: string
  onTabChange: (tab: string) => void
  /**
   * Schedule + write-handler for the Database tab's BackupSchedulePanel.
   * Threaded through the drawer so the tab doesn't need to call
   * `useEnvironmentDetail` twice. Only consumed when `kind === 'switchboard'`.
   */
  backupSchedule?: BackupSchedule | null
  onSaveBackupSchedule?: (opts: {
    enabled: boolean
    cadence: BackupCadence
    retention: number
  }) => Promise<void>
  backupScheduleSupported?: boolean
  /**
   * Connect runtime config + write handler for the Runtime Config drawer,
   * threaded from the page's useEnvironmentDetail (same pattern as
   * backupSchedule). Only consumed when `kind === 'connect'`.
   */
  runtimeConfig?: { connect?: Record<string, unknown>; packageRegistryUrl?: string } | null
  onSaveRuntimeConfig?: (config: Record<string, unknown> | null) => Promise<void>
  runtimeConfigSupported?: boolean
}

function mapRestartError(message: string): string {
  if (message.includes('DEPLOYMENT_NOT_FOUND')) {
    return 'Service not deployed.'
  }
  if (message.includes('AMBIGUOUS_SERVICE')) {
    return 'Could not identify the service.'
  }
  if (message.includes('RESTART_NOT_CONFIGURED')) {
    return "Restart isn't available for this environment."
  }
  if (message.includes('FORBIDDEN')) {
    return 'Only the environment owner can restart.'
  }
  return message
}

export function ServiceDetailDrawer({
  open,
  onClose,
  kind,
  service,
  subdomain,
  tenantId,
  documentId,
  isStopped,
  canEdit,
  pods,
  activeTab,
  onTabChange,
  backupSchedule,
  onSaveBackupSchedule,
  backupScheduleSupported,
  runtimeConfig,
  onSaveRuntimeConfig,
  runtimeConfigSupported,
}: Props) {
  // The Switchboard service is the chart's gating service for the CNPG
  // database cluster, so its drawer also surfaces DB backups. CONNECT and
  // FUSION never get a Database tab.
  const showDatabaseTab = kind === 'switchboard' && !!tenantId
  // Auth tab targets the tenant switchboard's reactor-api permissions
  // surface — only meaningful for the SWITCHBOARD service.
  const showAuthTab = kind === 'switchboard'
  // Resolve the switchboard URL with a chart-shape fallback. The doc-model
  // `service.url` is populated only after the SET_SERVICE_STATUS reconciler
  // runs against a live ingress; while we wait for that (or on envs where
  // the reconciler hasn't caught up), the chart's deterministic ingress
  // host `switchboard.<subdomain>.vetra.io` is the right URL to call. The
  // AuthTab still renders the "not yet running" placeholder when neither
  // is available (truly unprovisioned envs without a subdomain).
  const switchboardUrl =
    service?.url ?? (subdomain ? `https://switchboard.${subdomain}.vetra.io` : null)
  const clusterName = tenantId ? `${tenantId}-pg` : null
  const Icon = SERVICE_ICON[kind]
  const label = SERVICE_LABEL[kind]
  const tenantService = toTenantService(kind)
  const [range, setRange] = useState<MetricRange>('ONE_HOUR')
  const [restartOpen, setRestartOpen] = useState(false)
  const [runtimeConfigOpen, setRuntimeConfigOpen] = useState(false)
  // Runtime-config editor is a CONNECT-only affordance — that's the service
  // whose powerhouse.config.json this UI edits. Gated on the controller
  // exposing setRuntimeConfig (i.e. a logged-in viewer on a vetra-cloud-package
  // build that ships SET_RUNTIME_CONFIG); mirrors backupScheduleSupported.
  const showRuntimeConfig =
    kind === 'connect' && !!runtimeConfigSupported && !!onSaveRuntimeConfig
  const renown = useRenown()
  const auth = useRenownAuth()
  const viewerAddress = auth.status === 'authorized' ? (auth.address ?? null) : null

  const servicePods = useMemo(() => {
    if (!pods) return []
    if (kind === 'fusion') return [] // FUSION pod labelling TBD
    return pods.filter((p) => p.service === tenantService)
  }, [pods, kind, tenantService])
  const podNameSet = useMemo(() => new Set(servicePods.map((p) => p.name)), [servicePods])

  const {
    logs,
    isLoading: logsLoading,
    refresh: refreshLogs,
  } = useEnvironmentLogs(subdomain, tenantId, tenantService, range, false)

  const { metrics, isLoading: metricsLoading } = useEnvironmentMetrics(
    subdomain,
    tenantId,
    range,
    documentId,
  )
  const filteredMetrics = useMemo(() => {
    if (!metrics) return null
    return {
      cpu: filterSeriesByPods(metrics.cpu, podNameSet),
      memory: filterSeriesByPods(metrics.memory, podNameSet),
      requestRate: filterSeriesByPods(metrics.requestRate, podNameSet),
      latency: filterSeriesByPods(metrics.latency, podNameSet),
    }
  }, [metrics, podNameSet])

  const {
    events,
    isLoading: eventsLoading,
    refresh: refreshEvents,
  } = useEnvironmentEvents(subdomain, tenantId, 100, documentId)
  const filteredEvents = useMemo(() => filterEventsByPods(events, podNameSet), [events, podNameSet])
  const restartTimestamps = useMemo(
    () => extractRestartTimestamps(filteredEvents),
    [filteredEvents],
  )

  return (
    <>
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="top-16 flex h-[calc(100vh-4rem)] w-full flex-col gap-0 p-0 sm:max-w-2xl lg:max-w-3xl"
      >
        <SheetHeader className="border-b px-6 py-4">
          <div className="flex items-start justify-between gap-3 pr-8">
            <div className="flex flex-col gap-1.5">
              <SheetTitle className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                {label}
              </SheetTitle>
              <SheetDescription>
                {service?.version ? (
                  <span className="font-mono">{service.version}</span>
                ) : (
                  <span className="italic">version not set</span>
                )}
              </SheetDescription>
            </div>
            <div className="flex items-center gap-2">
              {showRuntimeConfig && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRuntimeConfigOpen(true)}
                  className="gap-1.5"
                  title="Edit the deployed Connect's powerhouse.config.json"
                >
                  <FileJson2 className="h-3.5 w-3.5" />
                  Runtime config
                </Button>
              )}
              {canEdit && service && tenantId && (
                <AlertDialog open={restartOpen} onOpenChange={setRestartOpen}>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isStopped}
                    title={isStopped ? 'Restart available once the service is running.' : undefined}
                    className="gap-1.5"
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                    Restart
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Restart service</AlertDialogTitle>
                    <AlertDialogDescription>
                      Restart {service.type === 'CLINT' ? service.prefix : service.type}?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AsyncButton
                      size="sm"
                      pendingLabel="Restarting…"
                      onClickAsync={async (e) => {
                        // Keep the dialog open if the mutation fails so the
                        // toast lands against the confirm screen rather than
                        // disappearing into the drawer body.
                        e.preventDefault()
                        try {
                          const token = await getAuthToken(renown)
                          await restartEnvironmentService(
                            tenantId,
                            service.type,
                            service.prefix ?? null,
                            token,
                          )
                          const friendly =
                            service.type === 'CLINT' ? service.prefix : service.type.toLowerCase()
                          toast.success(`${friendly} restarting…`)
                          setRestartOpen(false)
                        } catch (err) {
                          const raw = err instanceof Error ? err.message : String(err)
                          toast.error(mapRestartError(raw))
                        }
                      }}
                    >
                      Restart
                    </AsyncButton>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              )}
            </div>
          </div>
        </SheetHeader>

        <Tabs
          value={activeTab}
          onValueChange={onTabChange}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <TabsList className="mx-6 mt-4 self-start">
            <TabsTrigger value="logs" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Logs
            </TabsTrigger>
            <TabsTrigger value="metrics" className="gap-1.5">
              <BarChart2 className="h-3.5 w-3.5" /> Metrics
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-1.5">
              <Activity className="h-3.5 w-3.5" /> Activity
            </TabsTrigger>
            {showDatabaseTab && (
              <TabsTrigger value="database" className="gap-1.5">
                <Database className="h-3.5 w-3.5" /> Database
              </TabsTrigger>
            )}
            {showAuthTab && (
              <TabsTrigger value="auth" className="gap-1.5">
                <Lock className="h-3.5 w-3.5" /> Auth
              </TabsTrigger>
            )}
          </TabsList>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <TabsContent value="logs" className="mt-0 space-y-3">
              {isStopped ? (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  Start the environment to see logs
                </p>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <TimeRangePicker value={range} onChange={setRange} />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void refreshLogs()}
                      className="ml-auto gap-1.5"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Refresh
                    </Button>
                  </div>
                  <LogViewer logs={logs} isLoading={logsLoading} />
                </>
              )}
            </TabsContent>

            <TabsContent value="metrics" className="mt-0 space-y-4">
              {isStopped ? (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  Start the environment to see metrics
                </p>
              ) : (
                <>
                  <div className="flex items-center justify-end">
                    <TimeRangePicker value={range} onChange={setRange} />
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <MetricCard
                      title="CPU Usage"
                      description="CPU cores consumed by this service"
                      series={filteredMetrics?.cpu ?? []}
                      kind="cpu"
                      quota={service ? getServiceQuota(service, 'cpu') : null}
                      restarts={restartTimestamps}
                      isLoading={metricsLoading}
                    />
                    <MetricCard
                      title="Memory"
                      description="Working set memory by this service"
                      series={filteredMetrics?.memory ?? []}
                      kind="memory"
                      quota={service ? getServiceQuota(service, 'memory') : null}
                      restarts={restartTimestamps}
                      isLoading={metricsLoading}
                    />
                    <MetricCard
                      title="Request Rate"
                      description="HTTP requests/sec on this service"
                      series={filteredMetrics?.requestRate ?? []}
                      formatValue={(v) => `${v.toFixed(1)} req/s`}
                      isLoading={metricsLoading}
                    />
                    <MetricCard
                      title="Latency (p99)"
                      description="99th percentile HTTP response time"
                      series={filteredMetrics?.latency ?? []}
                      formatValue={(v) => `${(v * 1000).toFixed(0)}ms`}
                      isLoading={metricsLoading}
                    />
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="activity" className="mt-0 space-y-3">
              <div className="flex items-center justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void refreshEvents()}
                  className="gap-1.5"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Refresh
                </Button>
              </div>
              <EventTimeline events={filteredEvents} isLoading={eventsLoading} />
              {!eventsLoading && filteredEvents.length === 0 && (
                <p className="text-muted-foreground py-6 text-center text-sm">
                  No recent kube events for this service.
                </p>
              )}
            </TabsContent>

            {showDatabaseTab && (
              <TabsContent value="database" className="mt-0">
                <div className="text-muted-foreground mb-4 text-xs">
                  <span className="font-mono">{clusterName}</span> · postgres 16
                </div>
                <DatabaseTabBody
                  tenantId={tenantId}
                  canEdit={canEdit}
                  schedule={backupSchedule}
                  onSaveSchedule={onSaveBackupSchedule}
                  scheduleSupported={backupScheduleSupported}
                />
                <p className="text-muted-foreground mt-4 text-[11px]">
                  Detailed metrics, replication lag and connection counts live in the cluster-wide
                  Grafana dashboards.
                </p>
              </TabsContent>
            )}

            {showAuthTab && (
              <TabsContent value="auth" className="mt-0">
                <AuthTab
                  switchboardUrl={switchboardUrl}
                  viewerAddress={viewerAddress}
                  canEdit={canEdit}
                />
              </TabsContent>
            )}
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
    {showRuntimeConfig && onSaveRuntimeConfig && (
      <RuntimeConfigDrawer
        open={runtimeConfigOpen}
        onOpenChange={setRuntimeConfigOpen}
        runtimeConfig={runtimeConfig ?? null}
        onSave={onSaveRuntimeConfig}
        envLabel={subdomain}
        readOnly={!canEdit}
      />
    )}
    </>
  )
}
