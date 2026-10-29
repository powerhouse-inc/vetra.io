'use client'

import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle,
  ChevronDown,
  Copy,
  Globe,
  Info,
  Loader2,
  RefreshCw,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { useRenown } from '@powerhousedao/reactor-browser'

import { AsyncButton } from '@/modules/cloud/components/async-button'
import { AutoUpdateCard } from '@/modules/cloud/components/auto-update-card'
import { DeleteEnvironmentDialog } from '@/modules/cloud/components/delete-environment-dialog'
import { EnvOrgHandOver } from '@/modules/cloud/components/env-org-handover'
import { CustomDomainSection } from '@/modules/cloud/components/custom-domain-section'
import { ConfigHistorySection } from '@/modules/cloud/components/config-history-section'
import { EventTimeline } from '@/modules/cloud/components/event-timeline'
import { DRIVE_ID } from '@/modules/cloud/client'
import { loadEnvironmentController } from '@/modules/cloud/controller'
import { ensureCanOperateEnvironment } from '@/modules/cloud/org-sync'
import { getAuthToken, resetEnvironment } from '@/modules/cloud/graphql'
import { useCanSign } from '@/modules/cloud/hooks/use-can-sign'
import { CloudUserError, describeCloudError } from '@/modules/cloud/lib/cloud-error'
import type { HistoryOperation, RestoreActions } from '@/modules/cloud/lib/config-history'
import { apexCandidateServices, apexServiceForCustomDomain } from '@/modules/cloud/lib/env-host'
import { useEnvironmentEvents } from '@/modules/cloud/hooks/use-environment-events'
import type {
  AutoUpdateChannel,
  CloudEnvironment,
  EnvironmentStatus,
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
import { Input } from '@/modules/shared/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/modules/shared/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/modules/shared/components/ui/tabs'
import { parseSettingsTab, type SettingsTab } from '@/modules/cloud/hooks/use-settings-param'
import { cn } from '@/shared/lib/utils'
import { formatTimestamp, timeAgo } from '@/modules/shared/lib/time'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  environment: CloudEnvironment
  tenantId: string | null
  subdomain: string | null
  /**
   * Snapshot from `useEnvironmentStatus` — passed in so the drawer doesn't
   * re-subscribe to status, and the Activity tab's pills stay coherent with
   * the floating action bar.
   */
  status: EnvironmentStatus | null
  statusLoading: boolean
  onSetCustomDomain: (
    enabled: boolean,
    domain?: string | null,
    apexService?: TenantService | null,
  ) => Promise<void>
  /** When unset, the Updates tab renders an empty state. */
  onSetAutoUpdateChannel?: (channel: AutoUpdateChannel | null) => Promise<void>
  onUpdateToLatest?: () => Promise<string[]>
  onRollbackRelease?: () => Promise<string[]>
  /** When unset, the Danger Zone hides the Terminate row. */
  onTerminate?: () => Promise<void>
  /**
   * Whether the viewer may change this env (signer, plus operator on an org
   * env — Ruling R6). Edit controls are disabled otherwise. Defaults to true.
   */
  canEdit?: boolean
  /** Organisation owning the env (null = personal), for the hand-over offer. */
  ownerOrgId?: string | null
  /** Tab shown; the page keeps it in the URL (`?settings=<tab>`). */
  tab: SettingsTab
  onTabChange: (tab: SettingsTab) => void
  /** Called after a successful hand-over, to refresh the loaded document. */
  onHandedOver?: () => void
  /**
   * Operation history + the detail-hook methods a restore calls. When unset,
   * the Activity tab has no configuration history.
   */
  configHistory?: {
    operations: readonly HistoryOperation[] | null
    actions: RestoreActions
  }
}

const TERMINAL_STATUSES = new Set(['DRAFT', 'TERMINATING', 'DESTROYED', 'ARCHIVED'])

/**
 * Side drawer behind the env hero's gear icon. Holds the rarely-touched
 * admin surfaces — domain config, auto-update, optional add-on services,
 * recent activity, and the destructive Terminate / Delete actions — so the
 * main page stays focused on services and packages.
 */
export function EnvSettingsDrawer({
  open,
  onOpenChange,
  environment,
  tenantId,
  subdomain,
  status,
  statusLoading,
  onSetCustomDomain,
  onSetAutoUpdateChannel,
  onUpdateToLatest,
  onRollbackRelease,
  onTerminate,
  canEdit = true,
  ownerOrgId = null,
  tab,
  onTabChange,
  onHandedOver,
  configHistory,
}: Props) {
  const state = environment.state
  const { signer } = useCanSign()
  const envStatus = state.status
  const genericDomain = subdomain ? `${subdomain}.vetra.io` : ''

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="top-16 flex h-[calc(100vh-4rem)] w-full flex-col gap-0 p-0 sm:max-w-2xl lg:max-w-3xl"
      >
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>Environment settings</SheetTitle>
          <SheetDescription>Domain, updates, activity and admin actions.</SheetDescription>
        </SheetHeader>

        <Tabs
          value={tab}
          onValueChange={(next) => {
            const parsed = parseSettingsTab(next)
            if (parsed) onTabChange(parsed)
          }}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <TabsList className="mx-6 mt-4 self-start">
            <TabsTrigger value="domain" className="gap-1.5">
              <Globe className="h-3.5 w-3.5" /> Domain
            </TabsTrigger>
            <TabsTrigger value="updates" className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> Updates
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-1.5">
              <Activity className="h-3.5 w-3.5" /> Activity
            </TabsTrigger>
            <TabsTrigger value="metadata" className="gap-1.5">
              <Info className="h-3.5 w-3.5" /> Metadata
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <TabsContent value="domain" className="mt-0 space-y-4">
              <div className="space-y-1">
                <label className="text-muted-foreground text-sm font-medium">Generic Domain</label>
                <Input value={genericDomain} readOnly className="bg-muted font-mono text-sm" />
              </div>
              <fieldset disabled={!canEdit} className="m-0 min-w-0 border-0 p-0">
                <CustomDomainSection
                  customDomain={state.customDomain}
                  apexService={apexServiceForCustomDomain(state.apexService)}
                  enabledServices={apexCandidateServices(state.services)}
                  onSetCustomDomain={onSetCustomDomain}
                />
              </fieldset>
            </TabsContent>

            <TabsContent value="updates" className="mt-0">
              {onSetAutoUpdateChannel && onUpdateToLatest && onRollbackRelease ? (
                <fieldset disabled={!canEdit} className="m-0 min-w-0 border-0 p-0">
                  <AutoUpdateCard
                    environment={environment}
                    onChangeChannel={onSetAutoUpdateChannel}
                    onUpdateNow={onUpdateToLatest}
                    onRollback={onRollbackRelease}
                  />
                </fieldset>
              ) : (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  Updates aren&rsquo;t available for this env right now.
                </p>
              )}
            </TabsContent>

            <TabsContent value="activity" className="mt-0">
              <ActivityTab
                subdomain={subdomain}
                tenantId={tenantId}
                environmentId={environment.id}
                status={status}
                statusLoading={statusLoading}
                isOpen={open}
              />
              {configHistory && (
                <div className="mt-6">
                  <ConfigHistorySection
                    operations={configHistory.operations}
                    current={state}
                    actions={configHistory.actions}
                    canEdit={canEdit}
                    viewerAddress={signer?.user?.address}
                  />
                </div>
              )}
            </TabsContent>

            <TabsContent value="metadata" className="mt-0 space-y-4">
              <dl className="grid grid-cols-[7rem_1fr] gap-x-4 gap-y-3 text-sm">
                <MetadataField label="Document ID" value={environment.id} mono copyable />
                <MetadataField label="Type" value={environment.documentType} />
                <MetadataField label="Revision" value={String(environment.revision)} />
                <MetadataField
                  label="Created"
                  value={formatTimestamp(environment.createdAtUtcIso) || '—'}
                />
                <MetadataField
                  label="Modified"
                  value={formatTimestamp(environment.lastModifiedAtUtcIso) || '—'}
                />
              </dl>
              {canEdit && (
                <EnvOrgHandOver
                  environmentId={environment.id}
                  displayName={state.label || environment.name}
                  owner={state.owner}
                  ownerOrgId={ownerOrgId ?? state.ownerOrgId ?? environment.ownerOrgId ?? null}
                  status={envStatus}
                  appLinked={!!(environment.app ?? state.app)}
                  viewerAddress={signer?.user?.address}
                  onHandedOver={onHandedOver}
                />
              )}
              {canEdit && (
                <DangerZone
                  displayName={state.label || environment.name}
                  environment={environment}
                  tenantId={tenantId}
                  canTerminate={!!onTerminate && !TERMINAL_STATUSES.has(envStatus)}
                  onTerminate={onTerminate}
                  onClose={() => onOpenChange(false)}
                />
              )}
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// Activity tab — lifted into its own component so `useEnvironmentEvents` only
// fires when the drawer is mounted (Sheet keeps children mounted while open).
// ---------------------------------------------------------------------------

function ActivityTab({
  subdomain,
  tenantId,
  environmentId,
  status,
  statusLoading,
  isOpen,
}: {
  subdomain: string | null
  tenantId: string | null
  environmentId: string
  status: EnvironmentStatus | null
  statusLoading: boolean
  isOpen: boolean
}) {
  // The hook is fine to call unconditionally; passing nullish args makes it a
  // no-op. We still gate the fetch on `isOpen` by passing `null` ids while
  // the drawer is closed so events refresh on the next open instead of
  // running in the background.
  const { events, isLoading: eventsLoading } = useEnvironmentEvents(
    isOpen ? subdomain : null,
    isOpen ? tenantId : null,
    5,
    isOpen ? environmentId : null,
  )
  return (
    <div className="space-y-4">
      <ActivityStatusStrip
        argoSyncStatus={status?.argoSyncStatus}
        argoHealthStatus={status?.argoHealthStatus}
        argoLastSyncedAt={status?.argoLastSyncedAt}
        configDriftDetected={status?.configDriftDetected}
        isLoading={statusLoading && !status}
      />
      <EventTimeline events={events} isLoading={eventsLoading} />
    </div>
  )
}

/** Plain-language deployment state for the sync status the backend reports. */
function syncLabel(status?: string | null): string {
  if (status === 'SYNCED') return 'Changes applied'
  if (status === 'OUT_OF_SYNC') return 'Changes are being applied'
  return 'Deployment state unknown'
}

/** Plain-language health for the health status the backend reports. */
function healthLabel(status: string): string {
  switch (status) {
    case 'Progressing':
      return 'starting up'
    case 'Degraded':
      return 'some services are unhealthy'
    case 'Suspended':
      return 'paused'
    case 'Missing':
      return 'not deployed yet'
    default:
      return 'health unknown'
  }
}

function ActivityStatusStrip({
  argoSyncStatus,
  argoHealthStatus,
  argoLastSyncedAt,
  configDriftDetected,
  isLoading,
}: {
  argoSyncStatus?: string | null
  argoHealthStatus?: string | null
  argoLastSyncedAt?: string | null
  configDriftDetected?: boolean | null
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading status…
      </div>
    )
  }
  const syncedOk = argoSyncStatus === 'SYNCED'
  const driftOk = !configDriftDetected
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <span
        className={cn(
          'inline-flex items-center gap-1.5',
          syncedOk ? 'text-success' : 'text-warning',
        )}
      >
        {syncedOk ? <CheckCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
        {syncLabel(argoSyncStatus)}
        {argoHealthStatus && argoHealthStatus !== 'Healthy' && (
          <span className="text-muted-foreground">· {healthLabel(argoHealthStatus)}</span>
        )}
      </span>
      <span
        className={cn(
          'inline-flex items-center gap-1.5',
          driftOk ? 'text-success' : 'text-warning',
        )}
      >
        {driftOk ? <CheckCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
        {driftOk ? 'Configuration up to date' : 'Configuration out of date'}
      </span>
      {argoLastSyncedAt && (
        <span className="text-muted-foreground ml-auto" title={formatTimestamp(argoLastSyncedAt)}>
          last applied {timeAgo(argoLastSyncedAt)}
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Metadata helpers — same shape as the old EnvMetadataDialog, lifted into
// this drawer.
// ---------------------------------------------------------------------------

function MetadataField({
  label,
  value,
  mono,
  copyable,
}: {
  label: string
  value: string
  mono?: boolean
  copyable?: boolean
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      toast.error('Failed to copy')
    }
  }

  return (
    <>
      <dt className="text-muted-foreground text-xs font-medium">{label}</dt>
      <dd
        className={
          mono
            ? 'flex items-center gap-1.5 font-mono text-xs break-all'
            : 'flex items-center gap-1.5 text-sm'
        }
      >
        <span className="min-w-0 flex-1 truncate">{value}</span>
        {copyable && (
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="text-muted-foreground hover:text-foreground shrink-0"
            aria-label={`Copy ${label}`}
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </button>
        )}
      </dd>
    </>
  )
}

function DangerZone({
  displayName,
  environment,
  tenantId,
  canTerminate,
  onTerminate,
  onClose,
}: {
  displayName: string
  environment: CloudEnvironment
  tenantId: string | null
  canTerminate: boolean
  onTerminate?: () => Promise<void>
  onClose: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [terminateOpen, setTerminateOpen] = useState(false)
  const [isTerminating, setIsTerminating] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const router = useRouter()
  const { signer } = useCanSign()
  const renown = useRenown()

  // App environments are hidden from the Cloud list, so after deleting one
  // go back to its app instead.
  const appId = environment.app?.appId ?? environment.state.app?.appId ?? null

  const deleteEnvironment = async () => {
    if (!signer) {
      throw new CloudUserError('Log in with Renown to delete this environment.')
    }
    const ctrl = await loadEnvironmentController({
      documentId: environment.id,
      parentIdentifier: DRIVE_ID,
      signer,
      ownerOrgId: environment.state.ownerOrgId ?? environment.ownerOrgId ?? null,
    })
    await ensureCanOperateEnvironment(environment.id, ctrl, signer.user?.address)
    await ctrl.delete()
    onClose()
    router.push(appId ? `/user/apps/${appId}` : '/user/environments')
  }

  const handleTerminate = async () => {
    if (!onTerminate) return
    setIsTerminating(true)
    try {
      await onTerminate()
      setTerminateOpen(false)
      onClose()
    } catch (err) {
      toast.error(describeCloudError(err, "Couldn't terminate the environment. Try again."))
    } finally {
      setIsTerminating(false)
    }
  }

  const handleReset = async () => {
    if (!tenantId) {
      throw new Error('Environment is not provisioned yet')
    }
    const token = await getAuthToken(renown)
    const result = await resetEnvironment(tenantId, token)
    const msg = `Environment reset — ${result.tablesCleared} table${
      result.tablesCleared === 1 ? '' : 's'
    } cleared, ${result.deploymentsRestarted} service${
      result.deploymentsRestarted === 1 ? '' : 's'
    } restarting…`
    toast.success(msg)
    if (result.message?.includes('RESTART_PARTIAL')) {
      toast.warning(result.message)
    }
    setResetOpen(false)
  }

  return (
    <div className="border-destructive/30 mt-2 rounded-md border">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="text-destructive hover:bg-destructive/5 flex w-full items-center justify-between px-3 py-2 text-sm font-medium transition-colors"
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-2">
          <Trash2 className="h-3.5 w-3.5" />
          Danger zone
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && (
        <div className="space-y-3 px-3 pb-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <p className="font-medium">Reset environment</p>
              <p className="text-muted-foreground text-xs">
                Wipe all database rows and restart every service. Packages, env vars, secrets, and
                backups are preserved.
              </p>
            </div>
            <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={!tenantId}>
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  Reset
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset &ldquo;{displayName}&rdquo;?</AlertDialogTitle>
                  <AlertDialogDescription>
                    All database rows will be deleted. This cannot be undone, but you can restore
                    from a recent backup if one exists.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AsyncButton
                    variant="destructive"
                    size="sm"
                    pendingLabel="Resetting…"
                    onClickAsync={async (e) => {
                      // Keep the dialog open if the mutation fails so the user
                      // sees the toast against the confirm screen rather than
                      // an empty drawer.
                      e.preventDefault()
                      try {
                        await handleReset()
                      } catch (err) {
                        toast.error(
                          describeCloudError(err, "Couldn't reset the environment. Try again.", {
                            FORBIDDEN: 'Only the environment owner can reset.',
                          }),
                        )
                      }
                    }}
                  >
                    Reset
                  </AsyncButton>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          {canTerminate && (
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <p className="font-medium">Terminate</p>
                <p className="text-muted-foreground text-xs">
                  Stop all services and begin teardown.
                </p>
              </div>
              <AlertDialog
                open={terminateOpen}
                onOpenChange={(next) => !isTerminating && setTerminateOpen(next)}
              >
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={isTerminating}>
                    {isTerminating ? 'Terminating…' : 'Terminate'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Terminate &ldquo;{displayName}&rdquo;?</AlertDialogTitle>
                    <AlertDialogDescription>
                      All services stop and the environment starts tearing down, so it goes offline
                      right away.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isTerminating}>Cancel</AlertDialogCancel>
                    <AsyncButton
                      variant="destructive"
                      size="sm"
                      pendingLabel="Terminating…"
                      onClickAsync={async (e) => {
                        e.preventDefault()
                        await handleTerminate()
                      }}
                    >
                      Terminate
                    </AsyncButton>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <p className="font-medium">Delete</p>
              <p className="text-muted-foreground text-xs">
                Permanently remove this environment. Cannot be undone.
              </p>
            </div>
            <DeleteEnvironmentDialog
              open={deleteOpen}
              onOpenChange={setDeleteOpen}
              displayName={displayName}
              onConfirm={deleteEnvironment}
            >
              <Button variant="destructive" size="sm">
                Delete
              </Button>
            </DeleteEnvironmentDialog>
          </div>
        </div>
      )}
    </div>
  )
}
