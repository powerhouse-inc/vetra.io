'use client'

import { useCanSign } from '@/modules/cloud/hooks/use-can-sign'
import {
  ShieldCheck,
  ShieldOff,
  Bot,
  Copy,
  Globe,
  Server,
  Zap,
  Pencil,
  Check,
  X,
  Loader2,
} from 'lucide-react'
import { useCallback, useMemo, useState, useRef, useEffect } from 'react'
import { toast } from 'sonner'

import { PackagesSection } from '@/modules/cloud/components/packages-section'
import { AgentsSection } from '@/modules/cloud/components/agents-section'
import { AddAgentModal } from '@/modules/cloud/components/add-agent-modal'
import { ServiceSizePopover } from '@/modules/cloud/components/service-size-popover'
import { useClintPackages } from '@/modules/cloud/hooks/use-clint-packages'
import { useClintRuntimeEndpoints } from '@/modules/cloud/hooks/use-clint-runtime-endpoints'
import { partitionPackagesByManifestType } from '@/modules/cloud/lib/module-package-filter'
import { toServiceImageTag } from '@/modules/cloud/registry/channels'
import { useOptimistic } from '@/modules/cloud/hooks/use-optimistic'
import type {
  CloudEnvironment,
  CloudEnvironmentServiceType,
  EnvironmentStatus,
} from '@/modules/cloud/types'
import { Badge } from '@/modules/shared/components/ui/badge'
import { Button } from '@/modules/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/modules/shared/components/ui/card'
import { Input } from '@/modules/shared/components/ui/input'
import { Switch } from '@/modules/shared/components/ui/switch'
import { cn } from '@/shared/lib/utils'

// ---------------------------------------------------------------------------
// Helper: StatusDot
// ---------------------------------------------------------------------------

function StatusDot({ status }: { status: string }) {
  const colorClass =
    status === 'READY' || status === 'ACTIVE'
      ? 'bg-success'
      : status === 'DEPLOYING'
        ? 'bg-warning'
        : status === 'PROVISIONING'
          ? 'bg-info'
          : status === 'SUSPENDED' || status === 'BILLING_ISSUE'
            ? 'bg-destructive'
            : 'bg-muted-foreground'

  return <span className={`inline-block h-2 w-2 rounded-full ${colorClass}`} />
}

// ---------------------------------------------------------------------------
// ServiceRow (toggle version with Switch)
// ---------------------------------------------------------------------------

const SERVICE_LABELS: Record<CloudEnvironmentServiceType, string> = {
  CONNECT: 'Powerhouse Connect',
  SWITCHBOARD: 'Powerhouse Switchboard',
  FUSION: 'Powerhouse Fusion',
  CLINT: 'Agent',
}

const SERVICE_ICONS: Record<
  CloudEnvironmentServiceType,
  React.ComponentType<{ className?: string }>
> = {
  CONNECT: Globe,
  SWITCHBOARD: Server,
  FUSION: Zap,
  CLINT: Bot,
}

function ServiceRow({
  serviceType,
  prefix,
  subdomain,
  customDomain,
  customDomainValid,
  isApexService,
  isEnabled: serverIsEnabled,
  serviceStatus,
  environmentStatus,
  currentVersion,
  selectedRessource,
  canResize,
  onToggle,
  onSetVersion,
  onResize,
  onOpenDetail,
}: {
  serviceType: CloudEnvironmentServiceType
  prefix: string
  subdomain: string | null
  customDomain?: string | null
  customDomainValid?: boolean
  /** Whether this service is pinned to the apex of the custom domain. */
  isApexService?: boolean
  isEnabled: boolean
  serviceStatus: string
  environmentStatus: string
  currentVersion: string | null
  selectedRessource: import('@/modules/cloud/types').CloudResourceSize | null
  canResize: boolean
  onToggle: (enabled: boolean) => Promise<void>
  onSetVersion?: (version: string) => Promise<void>
  onResize?: (size: import('@/modules/cloud/types').CloudResourceSize) => Promise<void>
  /** When set, the row shows a "Details" button that opens the per-service
   *  drawer (logs / metrics / activity). Only meaningful while the service is
   *  enabled — disabled services have nothing to observe. */
  onOpenDetail?: () => void
}) {
  const [showVersionPicker, setShowVersionPicker] = useState(false)
  const [tags, setTags] = useState<string[]>([])
  const [distTags, setDistTags] = useState<Record<string, string>>({})
  const [tagsLoading, setTagsLoading] = useState(false)
  const label = SERVICE_LABELS[serviceType]
  const Icon = SERVICE_ICONS[serviceType]
  const defaultUrl = subdomain
    ? `${prefix}.${subdomain}.vetra.io`
    : `${prefix}.<subdomain>.vetra.io`
  const customServiceUrl =
    customDomain && customDomainValid !== false
      ? isApexService
        ? customDomain
        : `${prefix}.${customDomain}`
      : null
  const serviceUrl = customServiceUrl ?? defaultUrl

  const { value: isEnabled, set: toggleEnabled } = useOptimistic(serverIsEnabled, onToggle)

  const commitVersion = useCallback(
    async (next: string | null) => {
      if (next === null || !onSetVersion) return
      await onSetVersion(next)
    },
    [onSetVersion],
  )
  const { value: displayedVersion, set: setVersionOptimistic } = useOptimistic(
    currentVersion,
    commitVersion,
  )

  const handleToggle = async (checked: boolean) => {
    try {
      await toggleEnabled(checked)
      toast.success(`${label} ${checked ? 'enabled' : 'disabled'}`)
    } catch (error) {
      console.error(`Failed to toggle ${label}:`, error)
      toast.error(error instanceof Error ? error.message : `Failed to toggle ${label}`)
    }
  }

  const loadTags = async () => {
    if (tags.length > 0) {
      setShowVersionPicker(!showVersionPicker)
      return
    }
    setShowVersionPicker(true)
    setTagsLoading(true)
    try {
      const res = await fetch(`/api/registry/tags?service=${encodeURIComponent(serviceType)}`)
      if (res.ok) {
        const data = (await res.json()) as {
          tags: string[]
          distTags: Record<string, string>
        }
        setDistTags(data.distTags ?? {})
        setTags(data.tags ?? [])
      }
    } finally {
      setTagsLoading(false)
    }
  }

  const handleSetVersion = async (version: string) => {
    if (!onSetVersion) return
    const versionWithPrefix = toServiceImageTag(version)
    setShowVersionPicker(false) // close immediately; the version flips via useOptimistic
    try {
      await setVersionOptimistic(versionWithPrefix)
      toast.success(`${label} version set to ${versionWithPrefix}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to set ${label} version`)
    }
  }

  return (
    <div
      className={cn(
        'rounded-lg border p-4 transition-colors',
        isEnabled
          ? 'border-success/30 bg-success/5 dark:border-success/20 dark:bg-success/5'
          : 'border-border/50 bg-muted/30 opacity-70',
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-md',
              isEnabled ? 'bg-success/15 dark:bg-success/20' : 'bg-muted',
            )}
          >
            <Icon
              className={cn(
                'h-5 w-5',
                isEnabled ? 'text-success dark:text-success' : 'text-muted-foreground',
              )}
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={cn('text-sm font-medium', !isEnabled && 'text-muted-foreground')}>
                {label}
              </span>
              {isEnabled && <StatusDot status={serviceStatus} />}
              {!isEnabled && (
                <Badge
                  size="xs"
                  variant="outline"
                  className="text-muted-foreground border-border/50 px-1.5 py-0"
                >
                  OFF
                </Badge>
              )}
            </div>
            {(() => {
              const suffix = serviceType === 'SWITCHBOARD' ? '/graphql' : ''
              const fullUrl = `https://${serviceUrl}${suffix}`
              const copy = async () => {
                try {
                  await navigator.clipboard.writeText(fullUrl)
                  toast.success('URL copied')
                } catch {
                  toast.error('Failed to copy URL')
                }
              }
              return (
                <div className="flex items-center gap-1">
                  {isEnabled && environmentStatus === 'READY' ? (
                    <a
                      href={fullUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80 truncate font-mono text-xs underline underline-offset-2"
                    >
                      {fullUrl}
                    </a>
                  ) : (
                    <span className="text-muted-foreground/60 font-mono text-xs">
                      {serviceUrl}
                      {suffix}
                    </span>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void copy()}
                    aria-label={`Copy ${label} URL`}
                    className="text-muted-foreground hover:text-foreground h-5 w-5 shrink-0 p-0"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              )
            })()}
          </div>
        </div>
        {/* Reserve the action-slot width unconditionally so toggling Enabled
            doesn't shift the row. Buttons that only make sense while enabled
            are still gated, but their place is held. */}
        <div className="flex min-w-44 items-center justify-end gap-2">
          {onOpenDetail && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenDetail}
              aria-label={`View ${label} details`}
              className={cn('hidden sm:inline-flex', !isEnabled && 'pointer-events-none invisible')}
              tabIndex={isEnabled ? undefined : -1}
            >
              Details
            </Button>
          )}
          {onResize && (
            <span className={cn(!isEnabled && 'pointer-events-none invisible')}>
              <ServiceSizePopover
                serviceType={serviceType}
                prefix={prefix}
                currentSize={selectedRessource}
                canEdit={canResize}
                onSave={onResize}
              />
            </span>
          )}
          <Switch
            checked={isEnabled}
            onCheckedChange={(checked) => void handleToggle(checked)}
            aria-label={`Toggle ${label}`}
            className={cn(
              isEnabled
                ? 'data-[state=checked]:bg-success'
                : 'data-[state=unchecked]:bg-zinc-400 dark:data-[state=unchecked]:bg-zinc-600',
            )}
          />
        </div>
      </div>

      {/* Version row. The image / npm package name aren't shown — they're
          a function of serviceType, not interesting per row. */}
      {isEnabled && (
        <div className="border-success/10 mt-3 space-y-2 border-t pt-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="text-muted-foreground">
              <span className="font-medium">Version:</span>{' '}
              <span className="font-mono">{displayedVersion ?? 'not set'}</span>
            </span>
          </div>
          {onSetVersion && (
            <div>
              <button
                onClick={() => void loadTags()}
                className="text-primary hover:text-primary/80 text-xs font-medium hover:underline"
              >
                {showVersionPicker ? 'Hide versions' : 'Change version'}
              </button>
              {showVersionPicker && (
                <div className="mt-2 space-y-2">
                  {/* Dist tags as quick picks */}
                  {Object.keys(distTags).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(distTags).map(([tag, version]) => (
                        <button
                          key={tag}
                          onClick={() => void handleSetVersion(version)}
                          className={cn(
                            'hover:border-primary hover:bg-primary/5 flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition-colors',
                            version === displayedVersion && 'border-primary bg-primary/5',
                          )}
                        >
                          <span className="font-semibold">{tag}</span>
                          <span className="text-muted-foreground font-mono">{version}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Full version list */}
                  <div className="bg-card max-h-48 overflow-y-auto rounded-md border">
                    {tagsLoading ? (
                      <div className="flex items-center justify-center p-4">
                        <Loader2 className="text-muted-foreground size-4 animate-spin" />
                      </div>
                    ) : tags.length === 0 ? (
                      <p className="text-muted-foreground p-4 text-center text-xs">
                        No versions available.
                      </p>
                    ) : (
                      tags.map((tag) => {
                        const tagLabel = Object.entries(distTags).find(([, v]) => v === tag)?.[0]
                        return (
                          <button
                            key={tag}
                            onClick={() => void handleSetVersion(tag)}
                            className={cn(
                              'hover:bg-accent flex w-full items-center justify-between px-3 py-1.5 text-left text-xs transition-colors',
                              tag === displayedVersion && 'bg-primary/5',
                            )}
                          >
                            <span className="font-mono">{tag}</span>
                            <div className="flex items-center gap-1">
                              {tagLabel && (
                                <Badge size="xs" variant="secondary">
                                  {tagLabel}
                                </Badge>
                              )}
                              {tag === displayedVersion && (
                                <Badge size="xs" variant="default">
                                  current
                                </Badge>
                              )}
                            </div>
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// InlineEditableTitle
// ---------------------------------------------------------------------------

export function InlineEditableTitle({
  value,
  onSave,
}: {
  value: string
  onSave: (name: string) => Promise<void>
}) {
  const { value: displayValue, set: commitValue } = useOptimistic(value, onSave)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleSave = async () => {
    const trimmed = editValue.trim()
    if (!trimmed || trimmed === displayValue) {
      setEditValue(displayValue)
      setIsEditing(false)
      return
    }
    setIsEditing(false) // close immediately; the title flips via useOptimistic
    try {
      await commitValue(trimmed)
      toast.success('Name updated')
    } catch (error) {
      console.error('Failed to update name:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update name')
    }
  }

  const handleCancel = () => {
    setEditValue(displayValue)
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') void handleSave()
    if (e.key === 'Escape') handleCancel()
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => void handleSave()}
          className="h-9 text-2xl font-bold"
        />
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => void handleSave()}>
          <Check className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <h2 className="text-2xl font-bold">{displayValue}</h2>
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-foreground h-8 w-8 p-0"
        onClick={() => {
          setEditValue(displayValue)
          setIsEditing(true)
        }}
      >
        <Pencil className="h-4 w-4" />
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// OverviewTab props + component
// ---------------------------------------------------------------------------

type OverviewTabProps = {
  subdomain: string | null
  tenantId: string | null
  environment: CloudEnvironment
  /**
   * Observability status for the environment. Passed in from the parent so
   * the Overview tab and the page-level StatusBadge share a single polling
   * subscription instead of firing the same query twice every 15s.
   */
  status: EnvironmentStatus | null
  /** Pods in the env namespace, shared from the same observability subscription as `status`. */
  pods?: readonly import('@/modules/cloud/types').Pod[]
  statusLoading: boolean
  enableService: (
    type: CloudEnvironmentServiceType,
    prefix: string,
    clintConfig?: import('@/modules/cloud/types').CloudServiceClintConfig,
  ) => Promise<void>
  disableService: (type: CloudEnvironmentServiceType, prefix?: string) => Promise<void>
  setServiceConfig?: (
    prefix: string,
    config: import('@/modules/cloud/types').CloudServiceClintConfig,
  ) => Promise<void>
  setServiceSize?: (
    prefix: string,
    size: import('@/modules/cloud/types').CloudResourceSize,
  ) => Promise<void>
  addPackage: (name: string, version?: string) => Promise<void>
  removePackage: (name: string) => Promise<void>
  setServiceVersion?: (type: CloudEnvironmentServiceType, version: string) => Promise<void>
  setPackageVersion?: (packageName: string, version: string) => Promise<void>
  initialAddPackage?: string | null
  initialAddVersion?: string | null
  /**
   * Open the per-service detail drawer (logs / metrics / activity). The
   * page owns drawer state via `useDetailDrawer`; OverviewTab just plumbs the
   * callback into ServiceRow.
   */
  onOpenServiceDetail?: (kind: 'connect' | 'switchboard' | 'fusion') => void
  /**
   * Open the per-agent detail drawer for the agent with the given prefix.
   * Same plumbing as `onOpenServiceDetail`.
   */
  onOpenAgentDetail?: (prefix: string) => void
}

export function OverviewTab({
  subdomain,
  tenantId,
  environment,
  status,
  pods,
  statusLoading,
  enableService,
  disableService,
  setServiceConfig,
  setServiceSize,
  addPackage,
  removePackage,
  setServiceVersion,
  setPackageVersion,
  initialAddPackage,
  initialAddVersion,
  onOpenServiceDetail,
  onOpenAgentDetail,
}: OverviewTabProps) {
  const { canSign } = useCanSign()
  const [addAgentOpen, setAddAgentOpen] = useState(false)

  const state = environment.state
  const { clintPackages } = useClintPackages({
    registry: state.defaultPackageRegistry ?? null,
    packages: state.packages,
  })
  const clintManifestsByName = useMemo(
    () => Object.fromEntries(clintPackages.map((p) => [p.package.name, p.manifest])),
    [clintPackages],
  )
  const { modules: modulePackages } = useMemo(
    () => partitionPackagesByManifestType(state.packages, clintManifestsByName),
    [state.packages, clintManifestsByName],
  )
  const { byPrefix: clintRuntimeEndpointsByPrefix } = useClintRuntimeEndpoints(
    subdomain,
    environment.id,
  )

  const defaultPrefixes: Record<CloudEnvironmentServiceType, string> = {
    CONNECT: 'connect',
    SWITCHBOARD: 'switchboard',
    FUSION: 'fusion',
    CLINT: 'agent',
  }

  const getServiceEnabled = (type: CloudEnvironmentServiceType) =>
    state.services.find((s) => s.type === type)

  const hasCustomDomain = state.customDomain?.enabled ?? false

  return (
    <div className="space-y-6">
      {/* a. Domain status — only when a custom domain is configured.
          ArgoCD sync + config drift previously lived here as two more cards;
          they're now folded into the Recent Activity panel header below. */}
      {hasCustomDomain && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Globe className="text-muted-foreground h-4 w-4" />
              <span className="text-sm font-medium">Domain</span>
            </div>
            <div className="mt-2 space-y-1">
              <p className="text-muted-foreground text-xs">
                Resolves:{' '}
                <span className="text-foreground font-medium">
                  {statusLoading
                    ? '...'
                    : status?.domainResolves === null
                      ? 'Checking...'
                      : status?.domainResolves
                        ? 'Yes'
                        : 'No'}
                </span>
              </p>
              <p className="text-muted-foreground flex items-center gap-1 text-xs">
                TLS:{' '}
                {status?.tlsCertValid ? (
                  <ShieldCheck className="h-3 w-3 text-[#04c161]" />
                ) : (
                  <ShieldOff className="h-3 w-3 text-[#ea4335]" />
                )}
                <span className="text-foreground font-medium">
                  {statusLoading
                    ? '...'
                    : status?.tlsCertValid === null
                      ? 'Checking...'
                      : status?.tlsCertValid
                        ? 'Valid'
                        : 'Invalid'}
                </span>
              </p>
              {status?.tlsCertExpiresAt && (
                <p className="text-muted-foreground text-xs">
                  Expires: {new Date(status.tlsCertExpiresAt).toLocaleDateString()}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* b. Services — runtime hosts. Each enabled service can be opened in
          a per-service drawer (Logs / Metrics / Activity). Below the rows
          we list the packages those services consume — reactor modules
          loaded into Switchboard, UI apps loaded into Connect. Packages
          aren't tied to a specific service in the doc model, so they live
          in one shared sub-list inside the Services card. */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Server className="h-4 w-4" />
              Services
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            {(['CONNECT', 'SWITCHBOARD', 'FUSION'] as const).map((type) => {
              const service = getServiceEnabled(type)
              return (
                <ServiceRow
                  key={type}
                  serviceType={type}
                  prefix={service?.prefix ?? defaultPrefixes[type]}
                  subdomain={subdomain}
                  customDomain={state.customDomain?.enabled ? state.customDomain.domain : null}
                  customDomainValid={
                    status?.domainResolves === true && status?.tlsCertValid === true
                  }
                  isApexService={(state.apexService ?? null) === type}
                  isEnabled={service?.enabled ?? false}
                  serviceStatus={service?.status ?? 'PROVISIONING'}
                  environmentStatus={state.status}
                  currentVersion={service?.version ?? null}
                  selectedRessource={service?.selectedRessource ?? null}
                  canResize={canSign}
                  onToggle={(enabled) =>
                    enabled
                      ? enableService(type, service?.prefix ?? defaultPrefixes[type])
                      : disableService(type)
                  }
                  onSetVersion={
                    setServiceVersion ? (version) => setServiceVersion(type, version) : undefined
                  }
                  onResize={
                    setServiceSize && service
                      ? (size) => setServiceSize(service.prefix, size)
                      : undefined
                  }
                  onOpenDetail={
                    onOpenServiceDetail && service?.enabled
                      ? () =>
                          onOpenServiceDetail(
                            type.toLowerCase() as 'connect' | 'switchboard' | 'fusion',
                          )
                      : undefined
                  }
                />
              )
            })}
          </div>

          {/* Installed Packages — shared sub-list under the services. Modules
              load into Switchboard's reactor; UI apps live in Connect.
              Each row expands inline to surface that package's declared
              env vars and secrets. */}
          <PackagesSection
            tenantId={tenantId}
            registryUrl={state.defaultPackageRegistry ?? 'https://registry.dev.vetra.io'}
            installedPackages={state.packages}
            modulePackages={modulePackages}
            onAddPackage={addPackage}
            onRemovePackage={removePackage}
            onSetPackageVersion={setPackageVersion}
            initialAddPackage={initialAddPackage}
            initialAddVersion={initialAddVersion}
          />
        </CardContent>
      </Card>

      {/* c.5 Agents (CLINT services) */}
      <Card>
        <CardContent className="pt-6">
          <AgentsSection
            services={state.services}
            env={environment ?? null}
            canEdit={canSign}
            onAddAgent={() => setAddAgentOpen(true)}
            manifests={clintManifestsByName}
            runtimeEndpointsByPrefix={clintRuntimeEndpointsByPrefix}
            pods={pods}
            onOpenDetail={onOpenAgentDetail}
            onSaveConfig={
              setServiceConfig
                ? async (prefix, config) => {
                    await setServiceConfig(prefix, config)
                    toast.success('Agent updated')
                  }
                : undefined
            }
            onDisable={async (prefix) => {
              const svc = state.services.find((s) => s.prefix === prefix)
              if (!svc) return
              await disableService(svc.type, prefix)
              toast.success('Agent removed')
            }}
          />
        </CardContent>
      </Card>
      {canSign && (
        <AddAgentModal
          open={addAgentOpen}
          onOpenChange={setAddAgentOpen}
          env={environment}
          registryUrl={state.defaultPackageRegistry ?? 'https://registry.dev.vetra.io'}
          tenantId={tenantId}
          installedPackages={state.packages}
          onSubmit={async ({ packageName, version, prefix, clintConfig }) => {
            await addPackage(packageName, version)
            await enableService('CLINT', prefix, clintConfig)
            toast.success('Agent installed')
          }}
        />
      )}
    </div>
  )
}
