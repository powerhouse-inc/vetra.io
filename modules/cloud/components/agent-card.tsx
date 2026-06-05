'use client'

import { Bot, ChevronDown, MoreVertical, RefreshCw, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { PackageManifest } from '@/modules/cloud/config/types'
import { deriveClintAgentStatus, findClintAgentPods } from '@/modules/cloud/lib/clint-agent-status'
import type {
  ClintRuntimeEndpointsForPrefix,
  CloudEnvironment,
  CloudEnvironmentService,
  CloudResourceSize,
  CloudServiceClintConfig,
  CloudServiceEnv,
  Pod,
} from '@/modules/cloud/types'
import { composeClintEndpointUrl } from '@/modules/cloud/lib/clint-endpoint-url'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/modules/shared/components/ui/alert-dialog'
import { Badge } from '@/modules/shared/components/ui/badge'
import { Button } from '@/modules/shared/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/modules/shared/components/ui/dropdown-menu'
import { Label } from '@/modules/shared/components/ui/label'
import { Separator } from '@/modules/shared/components/ui/separator'
import { Textarea } from '@/modules/shared/components/ui/textarea'
import { cn } from '@/shared/lib/utils'
import { routeEnvVars } from '@/modules/cloud/config/route-env-vars'
import { useTenantConfig } from '@/modules/cloud/hooks/use-tenant-config'
import { EndpointRow } from './endpoint-row'
import { EnvVarsEditor } from './env-vars-editor'
import { LiveStatusPill } from './live-status-pill'
import { ResourceSizePicker } from './resource-size-picker'

const SIZE_LABELS: Record<CloudResourceSize, string> = {
  VETRA_AGENT_S: 'Small',
  VETRA_AGENT_M: 'Medium',
  VETRA_AGENT_L: 'Large',
  VETRA_AGENT_XL: 'X-Large',
  VETRA_AGENT_XXL: '2X-Large',
}

const SIZE_TO_TS: Record<string, CloudResourceSize> = {
  'vetra-agent-s': 'VETRA_AGENT_S',
  'vetra-agent-m': 'VETRA_AGENT_M',
  'vetra-agent-l': 'VETRA_AGENT_L',
  'vetra-agent-xl': 'VETRA_AGENT_XL',
  'vetra-agent-xxl': 'VETRA_AGENT_XXL',
}

type Props = {
  service: CloudEnvironmentService
  env: CloudEnvironment | null
  canEdit: boolean
  /**
   * The cluster tenant id (subdomain + envId suffix) used to route any
   * secret-typed custom env vars through `setTenantSecret` on save. Null
   * before initialization — when null, secrets cannot be persisted; the
   * save handler errors out if the user attempts to mark any new value
   * as secret.
   */
  tenantId: string | null
  manifest?: PackageManifest | null
  /**
   * Endpoints announced by the agent at runtime (sourced from the
   * observability subgraph). Read-only: we display them but the user
   * can't toggle them in v1. Empty/undefined when the agent has not
   * announced yet.
   */
  runtimeEndpoints?: ClintRuntimeEndpointsForPrefix | null
  /**
   * Pods in the env namespace. The card filters down to this agent's
   * pods (chart names them `<fullname>-clint-<prefix>-<hash>`) and
   * derives a live status from phase / ready / restartCount instead of
   * trusting the doc-model `service.status` (which has no path to flip
   * to ACTIVE). Empty array is fine — we render "Not running".
   */
  pods?: readonly Pod[]
  /**
   * When true the configure panel renders open on first paint (used inside
   * the per-agent detail drawer where the card IS the form). Defaults to
   * false on the env page so cards collapse to a status row.
   */
  defaultExpanded?: boolean
  /**
   * If provided, the card renders a "Details" button instead of an inline
   * "Configure" expand. Click handlers route to the per-agent drawer
   * (logs/metrics/activity/config). The inline expand panel is hidden when
   * `onOpenDetail` is set, since the drawer's Config tab is the authoritative
   * edit surface.
   */
  onOpenDetail?: () => void
  onSave?: (config: CloudServiceClintConfig) => Promise<void>
  onDisable?: () => Promise<void>
}

export function AgentCard({
  service,
  env,
  canEdit,
  tenantId,
  manifest,
  runtimeEndpoints,
  pods,
  defaultExpanded = false,
  onOpenDetail,
  onSave,
  onDisable,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const cfg = service.config

  const agentFeature = manifest?.features?.agent
  const agentInfo = agentFeature || null
  // Fallback chain: manifest agent.name → package@version → service prefix.
  // The prefix is always available (chart label sets it on the pod) and is
  // a useful identifier even when config + manifest haven't been populated.
  const cardLabel =
    agentInfo?.name ??
    (cfg ? `${cfg.package.name}@${cfg.package.version ?? 'latest'}` : service.prefix)
  const sizeLabel = cfg?.selectedRessource ? SIZE_LABELS[cfg.selectedRessource] : null

  const agentPods = useMemo(
    () => findClintAgentPods(pods ?? [], service.prefix),
    [pods, service.prefix],
  )
  const liveStatus = useMemo(
    () => deriveClintAgentStatus(agentPods, runtimeEndpoints ?? null),
    [agentPods, runtimeEndpoints],
  )
  const latestPod = agentPods[0]
  const restartCount = latestPod?.restartCount ?? 0
  const endpointCount = runtimeEndpoints?.endpoints.length ?? 0

  // Local form state (only meaningful when expanded + has cfg + manifest).
  const [serviceCommand, setServiceCommand] = useState<string>(cfg?.serviceCommand ?? '')
  const [selectedRessource, setSelectedRessource] = useState<CloudResourceSize | null>(
    cfg?.selectedRessource ?? null,
  )
  const [envVars, setEnvVars] = useState<CloudServiceEnv[]>(cfg?.env ?? [])
  const [saving, setSaving] = useState(false)
  const [disabling, setDisabling] = useState(false)
  const [confirmDisableOpen, setConfirmDisableOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Only the setSecret action is read here; the {envVars, secrets}
  // payload isn't displayed anywhere in this card.
  const { setSecret } = useTenantConfig(tenantId)

  // When the service's persisted config changes (e.g. after a save), resync
  // the form so a re-expand reflects current truth.
  useEffect(() => {
    setServiceCommand(cfg?.serviceCommand ?? '')
    setSelectedRessource(cfg?.selectedRessource ?? null)
    setEnvVars(cfg?.env ?? [])
  }, [cfg])

  const supportedSizes = useMemo<CloudResourceSize[]>(
    () => (manifest?.supportedResources ?? []).map((s) => SIZE_TO_TS[s]).filter(Boolean),
    [manifest],
  )

  const dirty = useMemo(() => {
    if (!cfg) return false
    if ((serviceCommand || null) !== (cfg.serviceCommand || null)) return true
    if (selectedRessource !== cfg.selectedRessource) return true
    if (envVars.length !== cfg.env.length) return true
    // null and '' both mean "no value" — comparing the raw fields directly
    // would flag a freshly-loaded secret row (`value: null` from the
    // document) as dirty the moment React's controlled input coerces it to
    // ''. Normalize both sides.
    const norm = (v: string | null | undefined) => v ?? ''
    for (let i = 0; i < envVars.length; i++) {
      if (envVars[i].name !== cfg.env[i]?.name) return true
      if (norm(envVars[i].value) !== norm(cfg.env[i]?.value)) return true
      if ((envVars[i].isSecret === true) !== (cfg.env[i]?.isSecret === true)) return true
    }
    return false
  }, [cfg, serviceCommand, selectedRessource, envVars])

  const handleSave = async () => {
    if (!cfg || !onSave || !dirty) return
    setError(null)
    setSaving(true)
    try {
      // Mirror of AddAgentModal: split secret-typed entries off the
      // document path and persist them encrypted via setTenantSecret.
      // See modules/cloud/config/route-env-vars.ts for the invariants.
      const { secretsToPersist, envForDocument } = routeEnvVars(envVars)
      if (secretsToPersist.length > 0) {
        if (!tenantId) {
          throw new Error('Cannot store secret env vars: tenant is not yet provisioned.')
        }
        for (const s of secretsToPersist) {
          await setSecret(s.name, s.value)
        }
      }
      await onSave({
        package: cfg.package,
        env: envForDocument,
        serviceCommand: serviceCommand.trim() || null,
        selectedRessource,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleDisable = async () => {
    if (!onDisable) return
    setDisabling(true)
    try {
      await onDisable()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable')
      setDisabling(false)
    }
  }

  const handleCancel = () => {
    setServiceCommand(cfg?.serviceCommand ?? '')
    setSelectedRessource(cfg?.selectedRessource ?? null)
    setEnvVars(cfg?.env ?? [])
    setError(null)
    setExpanded(false)
  }

  return (
    <div className="bg-background/40 hover:bg-background/60 overflow-hidden rounded-lg transition-colors">
      <div className="flex items-center gap-4 p-4">
        {/* Agent avatar */}
        <div className="bg-muted flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg">
          {agentInfo?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={agentInfo.image}
              alt={agentInfo.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <Bot className="text-muted-foreground h-6 w-6" />
          )}
        </div>

        {/* Identity + status + summary */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold">{cardLabel}</span>
            <LiveStatusPill
              tone={liveStatus.tone}
              label={liveStatus.label}
              reason={liveStatus.reason}
            />
            <Badge variant="outline" className="font-mono text-xs">
              {service.prefix}
            </Badge>
            {sizeLabel && (
              <Badge variant="outline" className="text-xs">
                {sizeLabel}
              </Badge>
            )}
          </div>
          <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            {agentInfo?.description && !expanded && (
              <span className="line-clamp-1">{agentInfo.description}</span>
            )}
            {endpointCount > 0 && (
              <span>
                {endpointCount} endpoint{endpointCount === 1 ? '' : 's'}
              </span>
            )}
            {restartCount > 0 && (
              <span className="text-warning inline-flex items-center gap-1">
                <RefreshCw className="h-3 w-3" /> {restartCount} restart
                {restartCount === 1 ? '' : 's'}
              </span>
            )}
          </div>
        </div>

        {(canEdit || onOpenDetail) && (
          <div className="flex items-center gap-1">
            {onOpenDetail ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenDetail}
                aria-label="View agent details"
              >
                Details
              </Button>
            ) : (
              canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setExpanded((e) => !e)}
                  aria-expanded={expanded}
                  aria-label="Configure"
                >
                  <ChevronDown
                    className={cn(
                      'mr-1.5 h-3.5 w-3.5 transition-transform',
                      expanded && 'rotate-180',
                    )}
                  />
                  Configure
                </Button>
              )
            )}
            {canEdit && onDisable && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Agent actions">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={(e) => {
                      e.preventDefault()
                      setConfirmDisableOpen(true)
                    }}
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Remove agent
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
      </div>

      {expanded && canEdit && cfg && manifest && (
        <div className="border-foreground/10 space-y-6 border-t p-6">
          {agentInfo?.description && (
            <p className="text-muted-foreground text-sm leading-relaxed">{agentInfo.description}</p>
          )}

          {/* Endpoints — what users care about most when expanding. */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Endpoints</Label>
              <span className="text-muted-foreground text-xs">
                Reported by the agent at runtime
              </span>
            </div>
            {runtimeEndpoints && runtimeEndpoints.endpoints.length > 0 ? (
              <div className="space-y-2">
                {runtimeEndpoints.endpoints.map((ep) => (
                  <EndpointRow
                    key={ep.id}
                    endpoint={{
                      id: ep.id,
                      type: ep.type,
                      port: ep.port,
                      status: ep.status,
                    }}
                    url={composeClintEndpointUrl({
                      serviceUrl: service.url,
                      prefix: service.prefix,
                      genericSubdomain: env?.state.genericSubdomain ?? null,
                      genericBaseDomain: env?.state.genericBaseDomain ?? null,
                      endpoint: { id: ep.id },
                    })}
                    checked={ep.status === 'enabled'}
                    onCheckedChange={() => {
                      /* read-only in v1 — endpoints are runtime state */
                    }}
                    disabled
                  />
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground rounded-md border border-dashed p-3 text-xs">
                Waiting for the first announcement…
              </p>
            )}
          </div>

          <Separator />

          {supportedSizes.length > 0 && (
            <>
              <div>
                <Label>Resource size</Label>
                <div className="mt-2">
                  <ResourceSizePicker
                    supported={supportedSizes}
                    value={selectedRessource}
                    onChange={setSelectedRessource}
                    disabled={saving || disabling}
                  />
                </div>
              </div>
              <Separator />
            </>
          )}

          <div className="space-y-4">
            <div>
              <Label htmlFor={`cmd-${service.prefix}`}>Service command</Label>
              <Textarea
                id={`cmd-${service.prefix}`}
                value={serviceCommand}
                onChange={(e) => setServiceCommand(e.target.value)}
                className="mt-2 font-mono text-sm"
                rows={2}
                disabled={saving || disabling}
              />
              {manifest.serviceCommand && serviceCommand !== manifest.serviceCommand && (
                <button
                  type="button"
                  className="text-primary mt-1 text-xs underline-offset-2 hover:underline"
                  onClick={() => setServiceCommand(manifest.serviceCommand ?? '')}
                >
                  Reset to default
                </button>
              )}
            </div>

            <div>
              <Label>Environment variables</Label>
              <div className="mt-2">
                <EnvVarsEditor
                  value={envVars}
                  onChange={setEnvVars}
                  disabled={saving || disabling}
                />
              </div>
            </div>
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <div className="flex items-center justify-between gap-2 border-t pt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmDisableOpen(true)}
              disabled={!onDisable || saving || disabling}
              className="text-destructive hover:text-destructive gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {disabling ? 'Disabling…' : 'Remove agent'}
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                disabled={saving || disabling}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => void handleSave()}
                disabled={!dirty || !onSave || saving || disabling}
              >
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {expanded && canEdit && (!cfg || !manifest) && (
        <div className="border-foreground/10 space-y-3 border-t p-6">
          <p className="text-muted-foreground text-sm">
            {!cfg ? 'This service has no config to edit.' : 'Loading package manifest…'}
          </p>
          {onDisable && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmDisableOpen(true)}
              disabled={disabling}
              className="text-destructive hover:text-destructive gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {disabling ? 'Removing…' : 'Remove agent'}
            </Button>
          )}
        </div>
      )}

      <AlertDialog open={confirmDisableOpen} onOpenChange={setConfirmDisableOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this agent?</AlertDialogTitle>
            <AlertDialogDescription>
              This stops <span className="font-mono">{service.prefix}</span> and removes it from the
              environment. The agent&rsquo;s package data persists in the registry; you can add it
              back later. Pod state and any in-flight work are lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disabling}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void handleDisable().then(() => setConfirmDisableOpen(false))
              }}
              disabled={disabling}
              className="bg-destructive hover:bg-destructive/90 text-white"
            >
              {disabling ? 'Removing…' : 'Remove agent'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
