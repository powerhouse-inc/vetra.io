'use client'

import {
  Bot,
  FileText,
  BarChart2,
  Activity,
  Settings2,
  RefreshCw,
  Info,
  RotateCw,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useRenown } from '@powerhousedao/reactor-browser'

import { AsyncButton } from '@/modules/cloud/components/async-button'
import { getAuthToken, restartEnvironmentService } from '@/modules/cloud/graphql'
import { useEnvironmentEvents } from '@/modules/cloud/hooks/use-environment-events'
import { useEnvironmentLogs } from '@/modules/cloud/hooks/use-environment-logs'
import { useEnvironmentMetrics } from '@/modules/cloud/hooks/use-environment-metrics'
import { deriveClintAgentStatus, findClintAgentPods } from '@/modules/cloud/lib/clint-agent-status'
import { getServiceQuota } from '@/modules/cloud/lib/resource-maps'
import { extractRestartTimestamps } from '@/modules/cloud/lib/restart-events'
import type {
  ClintRuntimeEndpointsForPrefix,
  CloudEnvironment,
  CloudEnvironmentService,
  CloudServiceClintConfig,
  KubeEvent,
  MetricRange,
  MetricSeries,
  Pod,
} from '@/modules/cloud/types'
import type { PackageManifest } from '@/modules/cloud/config/types'
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
import { Badge } from '@/modules/shared/components/ui/badge'
import { Button } from '@/modules/shared/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/modules/shared/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/modules/shared/components/ui/tabs'

import { AgentCard } from './agent-card'
import { EventTimeline } from './event-timeline'
import { LiveStatusPill } from './live-status-pill'
import { LogViewer } from './log-viewer'
import { MetricCard } from './metric-card'
import { TimeRangePicker } from './time-range-picker'

// Mirrors `service-detail-drawer.tsx` — the agent restart path bubbles
// the exact same error codes from the backend resolver, so the mapping
// is identical. Duplicated rather than shared because the two drawers
// already diverge on layout and we don't want to pull a tiny helper
// into a separate file until a third caller appears.
function mapRestartError(message: string): string {
  if (message.includes('DEPLOYMENT_NOT_FOUND')) {
    return 'Agent not deployed.'
  }
  if (message.includes('AMBIGUOUS_SERVICE')) {
    return 'Could not identify the agent.'
  }
  if (message.includes('RESTART_NOT_CONFIGURED')) {
    return "Restart isn't available for this environment."
  }
  if (message.includes('FORBIDDEN')) {
    return 'Only the environment owner can restart.'
  }
  return message
}

type Props = {
  open: boolean
  onClose: () => void
  service: CloudEnvironmentService
  env: CloudEnvironment
  subdomain: string | null
  tenantId: string | null
  isStopped: boolean
  canEdit: boolean
  manifest?: PackageManifest | null
  runtimeEndpoints?: ClintRuntimeEndpointsForPrefix | null
  pods?: readonly Pod[]
  activeTab: string
  onTabChange: (tab: string) => void
  onSaveConfig?: (config: CloudServiceClintConfig) => Promise<void>
  onDisable?: () => Promise<void>
}

/** Filter MetricSeries[] so only those whose pod label belongs to this agent remain. */
function filterSeriesByPods(series: MetricSeries[], podNames: Set<string>): MetricSeries[] {
  if (podNames.size === 0) return []
  return series.filter((s) => podNames.has(s.label))
}

/** Filter kube events to those mentioning a known pod or its replica-set/deploy. */
function filterEventsByPods(events: KubeEvent[], podNames: Set<string>): KubeEvent[] {
  if (podNames.size === 0) return []
  return events.filter((e) => {
    const obj = e.involvedObject
    for (const pod of podNames) {
      if (obj.includes(pod)) return true
      // ReplicaSet / Deployment events drop the random pod-suffix; match the
      // chart's stable prefix `<release>-clint-<prefix>` instead.
      const idx = pod.indexOf('-clint-')
      if (idx > 0 && obj.includes(pod.slice(0, idx + 7))) return true
    }
    return false
  })
}

export function AgentDetailDrawer({
  open,
  onClose,
  service,
  env,
  subdomain,
  tenantId,
  isStopped,
  canEdit,
  manifest,
  runtimeEndpoints,
  pods,
  activeTab,
  onTabChange,
  onSaveConfig,
  onDisable,
}: Props) {
  const [range, setRange] = useState<MetricRange>('ONE_HOUR')
  const [restartOpen, setRestartOpen] = useState(false)
  const renown = useRenown()

  const agentPods = useMemo(
    () => findClintAgentPods(pods ?? [], service.prefix),
    [pods, service.prefix],
  )
  const podNameSet = useMemo(() => new Set(agentPods.map((p) => p.name)), [agentPods])
  const liveStatus = useMemo(
    () => deriveClintAgentStatus(agentPods, runtimeEndpoints ?? null),
    [agentPods, runtimeEndpoints],
  )

  // `manifest.features.agent` is `boolean | AgentInfo` per the package
  // schema. Read it once into a typed local before pulling fields off it.
  const agentFeature = manifest?.features?.agent
  const agentInfo = agentFeature && typeof agentFeature === 'object' ? agentFeature : null
  // Fallback chain: manifest agent.name → package@version → service prefix.
  // The prefix is always available (chart label sets it on the pod) and is
  // a useful identifier even when config + manifest haven't been populated.
  const cardLabel =
    agentInfo?.name ??
    (service.config
      ? `${service.config.package.name}@${service.config.package.version ?? 'latest'}`
      : service.prefix)

  // Logs — env-wide query for now; until the backend `agent:` arg ships,
  // we filter client-side by matching the agent's prefix or pod-name
  // anywhere in the log line. This is a best-effort substring match;
  // false positives are possible if the prefix collides with another
  // service's log text. The disclaimer below the viewer states this.
  const {
    logs: rawLogs,
    isLoading: logsLoading,
    refresh: refreshLogs,
  } = useEnvironmentLogs(subdomain, tenantId, null, range, false)
  const logs = useMemo(() => {
    if (rawLogs.length === 0) return rawLogs
    const needles = [service.prefix, ...agentPods.map((p) => p.name)].filter(
      (s): s is string => !!s && s.length > 0,
    )
    if (needles.length === 0) return rawLogs
    return rawLogs.filter((entry) => needles.some((n) => entry.line.includes(n)))
  }, [rawLogs, service.prefix, agentPods])

  // Metrics — fetched env-wide and filtered client-side by pod name.
  const { metrics, isLoading: metricsLoading } = useEnvironmentMetrics(
    subdomain,
    tenantId,
    range,
    env.id,
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

  // Events — fetched env-wide and filtered client-side by involvedObject.
  const {
    events,
    isLoading: eventsLoading,
    refresh: refreshEvents,
  } = useEnvironmentEvents(subdomain, tenantId, 100, env.id)
  const filteredEvents = useMemo(() => filterEventsByPods(events, podNameSet), [events, podNameSet])
  const restartTimestamps = useMemo(
    () => extractRestartTimestamps(filteredEvents),
    [filteredEvents],
  )

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="top-16 flex h-[calc(100vh-4rem)] w-full flex-col gap-0 p-0 sm:max-w-2xl lg:max-w-3xl"
      >
        <SheetHeader className="border-b px-6 py-4">
          <div className="flex items-start gap-3 pr-8">
            <div className="bg-muted flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg">
              {agentInfo?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={agentInfo.image}
                  alt={agentInfo.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Bot className="text-muted-foreground h-5 w-5" />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <SheetTitle className="flex items-center gap-2">
                <span className="truncate">{cardLabel}</span>
                <LiveStatusPill
                  tone={liveStatus.tone}
                  label={liveStatus.label}
                  reason={liveStatus.reason}
                />
              </SheetTitle>
              <SheetDescription className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs">
                  {service.prefix}
                </Badge>
                {agentPods[0] && (
                  <span className="text-muted-foreground/70 font-mono text-[11px]">
                    {agentPods[0].name}
                  </span>
                )}
              </SheetDescription>
            </div>
            {canEdit && tenantId && service.prefix && (
              <AlertDialog open={restartOpen} onOpenChange={setRestartOpen}>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isStopped}
                    title={isStopped ? 'Restart available once the agent is running.' : undefined}
                    className="shrink-0 gap-1.5"
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                    Restart
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Restart agent</AlertDialogTitle>
                    <AlertDialogDescription>
                      Restart <span className="font-mono">{service.prefix}</span>?
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
                            'CLINT',
                            service.prefix ?? null,
                            token,
                          )
                          toast.success(`${service.prefix} restarting…`)
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
            <TabsTrigger value="config" className="gap-1.5">
              <Settings2 className="h-3.5 w-3.5" /> Config
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <TabsContent value="logs" className="mt-0 space-y-3">
              {isStopped ? (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  Start the environment to see logs
                </p>
              ) : (
                <>
                  <div className="bg-muted/40 text-muted-foreground flex items-start gap-2 rounded-md border p-3 text-xs">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      Showing log lines matching this agent (prefix{' '}
                      <span className="font-mono">{service.prefix}</span>
                      {agentPods[0] && (
                        <>
                          {' '}
                          / pod <span className="font-mono">{agentPods[0].name}</span>
                        </>
                      )}
                      ). Substring match client-side until the backend ships an{' '}
                      <span className="font-mono">agent:</span> filter.
                    </span>
                  </div>
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
                      description="CPU cores consumed by this agent's pod(s)"
                      series={filteredMetrics?.cpu ?? []}
                      kind="cpu"
                      quota={getServiceQuota(service, 'cpu')}
                      restarts={restartTimestamps}
                      isLoading={metricsLoading}
                    />
                    <MetricCard
                      title="Memory"
                      description="Working set memory by this agent's pod(s)"
                      series={filteredMetrics?.memory ?? []}
                      kind="memory"
                      quota={getServiceQuota(service, 'memory')}
                      restarts={restartTimestamps}
                      isLoading={metricsLoading}
                    />
                    <MetricCard
                      title="Request Rate"
                      description="HTTP requests/sec from this agent's pod(s)"
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
                  No recent kube events for this agent.
                </p>
              )}
            </TabsContent>

            <TabsContent value="config" className="mt-0">
              {/* Reuse the existing AgentCard. It carries an inline-expand
                  panel that already has the resource size, service command,
                  env vars, and remove-agent flow we want here. We render
                  it without the chrome looking awkward by giving it a
                  borderless wrapper. The inline status row at the top is a
                  small redundancy with the drawer header — we'll cut it in
                  a follow-up that extracts a dedicated AgentConfigForm. */}
              <AgentCard
                service={service}
                env={env}
                canEdit={canEdit}
                manifest={manifest}
                runtimeEndpoints={runtimeEndpoints}
                pods={pods}
                defaultExpanded
                onSave={onSaveConfig}
                onDisable={onDisable}
              />
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
