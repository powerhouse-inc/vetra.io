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
import { CustomDomainSection } from '@/modules/cloud/components/custom-domain-section'
import { EventTimeline } from '@/modules/cloud/components/event-timeline'
import { DRIVE_ID } from '@/modules/cloud/client'
import { loadEnvironmentController } from '@/modules/cloud/controller'
import { getAuthToken, resetEnvironment } from '@/modules/cloud/graphql'
import { useAsyncAction } from '@/modules/cloud/hooks/use-async-action'
import { useCanSign } from '@/modules/cloud/hooks/use-can-sign'
import { useEnvironmentEvents } from '@/modules/cloud/hooks/use-environment-events'
import type {
  AutoUpdateChannel,
  CloudEnvironment,
  EnvironmentStatus,
  TenantService,
} from '@/modules/cloud/types'
import {
  AlertDialog,
  AlertDialogAction,
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
import { cn } from '@/shared/lib/utils'

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
}

const TERMINAL_STATUSES = new Set(['DRAFT', 'TERMINATING', 'DESTROYED', 'ARCHIVED'])

/**
 * Side drawer behind the env hero's gear icon. Holds the rarely-touched
 * admin surfaces — domain config, auto-update, recent activity, and the
 * destructive Terminate / Delete actions — so the main page stays focused
 * on services and packages.
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
}: Props) {
  const state = environment.state
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

        <Tabs defaultValue="domain" className="flex flex-1 flex-col overflow-hidden">
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
              <CustomDomainSection
                customDomain={state.customDomain}
                apexService={
                  state.apexService === 'CONNECT' || state.apexService === 'SWITCHBOARD'
                    ? state.apexService
                    : null
                }
                enabledServices={
                  state.services
                    .filter((s) => s.enabled && (s.type === 'CONNECT' || s.type === 'SWITCHBOARD'))
                    .map((s) => s.type) as TenantService[]
                }
                onSetCustomDomain={onSetCustomDomain}
              />
            </TabsContent>

            <TabsContent value="updates" className="mt-0">
              {onSetAutoUpdateChannel && onUpdateToLatest && onRollbackRelease ? (
                <AutoUpdateCard
                  environment={environment}
                  onChangeChannel={onSetAutoUpdateChannel}
                  onUpdateNow={onUpdateToLatest}
                  onRollback={onRollbackRelease}
                />
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
            </TabsContent>

            <TabsContent value="metadata" className="mt-0 space-y-4">
              <dl className="grid grid-cols-[7rem_1fr] gap-x-4 gap-y-3 text-sm">
                <MetadataField label="Document ID" value={environment.id} mono copyable />
                <MetadataField label="Type" value={environment.documentType} />
                <MetadataField label="Revision" value={String(environment.revision)} />
                <MetadataField
                  label="Created"
                  value={
                    environment.createdAtUtcIso
                      ? new Date(environment.createdAtUtcIso).toLocaleString()
                      : '—'
                  }
                />
                <MetadataField
                  label="Modified"
                  value={
                    environment.lastModifiedAtUtcIso
                      ? new Date(environment.lastModifiedAtUtcIso).toLocaleString()
                      : '—'
                  }
                />
              </dl>
              <DangerZone
                displayName={state.label || environment.name}
                environment={environment}
                tenantId={tenantId}
                canTerminate={!!onTerminate && !TERMINAL_STATUSES.has(envStatus)}
                onTerminate={onTerminate}
                onClose={() => onOpenChange(false)}
              />
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
        ArgoCD {argoSyncStatus ? argoSyncStatus.toLowerCase() : 'unknown'}
        {argoHealthStatus && argoHealthStatus !== 'Healthy' && (
          <span className="text-muted-foreground">· {argoHealthStatus}</span>
        )}
      </span>
      <span
        className={cn(
          'inline-flex items-center gap-1.5',
          driftOk ? 'text-success' : 'text-warning',
        )}
      >
        {driftOk ? <CheckCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
        {driftOk ? 'No drift' : 'Drift detected'}
      </span>
      {argoLastSyncedAt && (
        <span className="text-muted-foreground ml-auto">
          last sync {new Date(argoLastSyncedAt).toLocaleTimeString()}
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

function mapResetError(message: string): string {
  if (message.includes('RESET_NOT_CONFIGURED')) {
    return "Reset isn't available for this environment."
  }
  if (message.includes('TRUNCATE_FAILED')) {
    return 'Could not clear the database. Try again or contact support.'
  }
  if (message.includes('FORBIDDEN')) {
    return 'Only the environment owner can reset.'
  }
  if (message.includes('ENV_NOT_FOUND')) {
    return 'Environment not found.'
  }
  return message
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
  const router = useRouter()
  const { signer } = useCanSign()
  const renown = useRenown()

  const { run: runDelete, isPending: isDeleting } = useAsyncAction(async () => {
    if (!signer) {
      throw new Error('You must be logged in with Renown to delete an environment')
    }
    const ctrl = await loadEnvironmentController({
      documentId: environment.id,
      parentIdentifier: DRIVE_ID,
      signer,
    })
    await ctrl.delete()
    toast.success('Environment deleted')
    onClose()
    router.push('/cloud')
  })

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
                dump history are preserved.
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
                    from a recent dump if one exists.
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
                        const raw = err instanceof Error ? err.message : String(err)
                        toast.error(mapResetError(raw))
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
              <AsyncButton
                variant="destructive"
                size="sm"
                pendingLabel="Terminating…"
                onClickAsync={async () => {
                  await onTerminate?.()
                  onClose()
                }}
              >
                Terminate
              </AsyncButton>
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <p className="font-medium">Delete</p>
              <p className="text-muted-foreground text-xs">
                Permanently remove this environment. Cannot be undone.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={isDeleting}>
                  {isDeleting ? 'Deleting…' : 'Delete'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete environment</AlertDialogTitle>
                  <AlertDialogDescription>
                    Delete &ldquo;{displayName}&rdquo;? This action cannot be undone and all data
                    will be permanently lost.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    // Don't auto-close: keep the confirm dialog open while
                    // the delete is in flight so a failure leaves the user on
                    // the confirm screen instead of an empty cloud page.
                    onClick={(e) => {
                      e.preventDefault()
                      void runDelete().catch((err) => {
                        console.error('Failed to delete environment:', err)
                        toast.error(
                          err instanceof Error ? err.message : 'Failed to delete environment',
                        )
                      })
                    }}
                    disabled={isDeleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isDeleting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                    {isDeleting ? 'Deleting…' : 'Delete'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}
    </div>
  )
}
