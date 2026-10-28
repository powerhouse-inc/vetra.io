'use client'

import { AlertTriangle, ExternalLink, Package, Server, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { DRIVE_ID } from '@/modules/cloud/client'
import { DeleteEnvironmentDialog } from '@/modules/cloud/components/delete-environment-dialog'
import { loadEnvironmentController } from '@/modules/cloud/controller'
import { ensureCanOperateEnvironment } from '@/modules/cloud/org-sync'
import { CloudUserError } from '@/modules/cloud/lib/cloud-error'
import { environmentStatusMeta } from '@/modules/cloud/lib/environment-status'
import { resolveGenericHost, isTypeAtApex } from '@/modules/cloud/lib/env-host'
import { useCanSign } from '@/modules/cloud/hooks/use-can-sign'
import { useEnvironments, useViewer, type ViewScope } from '@/modules/cloud/hooks/use-environment'
import { useOptimisticMutation } from '@/modules/cloud/query/use-optimistic-mutation'
import { useActiveOrg } from '@/modules/orgs/hooks/use-orgs'
import { StatusPill } from '@/modules/shared/components/status'
import { Button } from '@/modules/shared/components/ui/button'
import { Skeleton } from '@/modules/shared/components/ui/skeleton'
import { EnvironmentLicenceBadge } from '@/modules/subscriptions/components/environment-licence'
import { Card, CardContent, CardHeader, CardTitle } from '@/modules/shared/components/ui/card'

import type { CloudEnvironment } from './types'

export function CloudEnvironmentCard({ env }: { env: CloudEnvironment }) {
  const { signer, canSign: signerReady } = useCanSign()
  // Org envs: a plain MEMBER only views (R6); the delete itself is gated again
  // by the backend's canOperate answer (ensureCanOperateEnvironment).
  const { orgId, org } = useActiveOrg()
  const viewOnly = !!env.ownerOrgId && env.ownerOrgId === orgId && org?.role === 'MEMBER'
  const canSign = signerReady && !viewOnly
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const queryClient = useQueryClient()
  const displayName = env.state.label || env.name || 'Unnamed'
  const packageCount = env.state.packages.length

  // Visit link to the live env (CONNECT URL). Mirror the field accessors
  // used by app/user/environments/[project]/page.tsx so listing + detail stay in sync.
  const connectService = env.state.services.find((s) => s.type === 'CONNECT' && s.enabled)
  const subdomain = env.state.genericSubdomain ?? null
  const baseDomain = env.state.genericBaseDomain ?? 'vetra.io'
  const visitUrl =
    env.state.status === 'READY' && subdomain && connectService
      ? `https://${resolveGenericHost(
          subdomain,
          connectService.prefix,
          isTypeAtApex(env.state.services, env.state.apexService, 'CONNECT'),
          baseDomain,
        )}`
      : null

  // The confirm dialog stays open with a spinner while the delete runs (same
  // as the settings drawer); once it lands the card is dropped from every
  // cached env list (and the studio products grid) before the refetch.
  const deleteEnv = useOptimisticMutation<void, void>({
    mutationFn: async () => {
      if (!signer) throw new CloudUserError('Log in with Renown to delete this environment.')
      const ctrl = await loadEnvironmentController({
        documentId: env.id,
        parentIdentifier: DRIVE_ID,
        signer,
        ownerOrgId: env.ownerOrgId ?? null,
      })
      await ensureCanOperateEnvironment(env.id, ctrl, signer.user?.address)
      await ctrl.delete()
    },
    affectedKeys: () => [['environments'], ['studio-products']],
    onSuccess: () => {
      queryClient.setQueriesData<{ id: string }[]>({ queryKey: ['environments'] }, (old) =>
        Array.isArray(old) ? old.filter((e) => e?.id !== env.id) : old,
      )
      queryClient.setQueriesData<{ envId: string }[]>({ queryKey: ['studio-products'] }, (old) =>
        Array.isArray(old) ? old.filter((p) => p?.envId !== env.id) : old,
      )
    },
  })
  const isDeleting = deleteEnv.isPending

  const enabledServices = env.state.services.filter((s) => s.enabled)

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="flex-row items-center justify-between pb-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="h-4 w-4" />
            {displayName}
          </CardTitle>
          {subdomain && <span className="text-muted-foreground truncate text-sm">{subdomain}</span>}
        </div>
        {/* Same mapping as the detail page. The list query has no live ArgoCD
            health, so a READY env reads "Ready" here until it is opened. */}
        <StatusPill
          meta={environmentStatusMeta({
            status: env.state.status,
            argoHealthStatus: env.health?.argoHealthStatus,
            argoSyncStatus: env.health?.argoSyncStatus,
          })}
        />
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <EnvironmentLicenceBadge environmentId={env.id} />
        <div className="flex items-center gap-4 text-sm">
          <div className="text-muted-foreground flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5" />
            {packageCount} package{packageCount !== 1 ? 's' : ''}
          </div>
          {enabledServices.length > 0 && (
            <div className="text-muted-foreground text-xs">
              {enabledServices.map((s) => s.type).join(', ')}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild className="flex-1">
            <Link href={`/user/environments/${env.id}`}>Manage</Link>
          </Button>
          {visitUrl && (
            <Button variant="outline" size="sm" asChild className="shrink-0">
              <a
                href={visitUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Visit ${displayName}`}
              >
                <ExternalLink className="h-4 w-4" />
                Visit
              </a>
            </Button>
          )}
          <DeleteEnvironmentDialog
            open={showDeleteDialog}
            onOpenChange={setShowDeleteDialog}
            displayName={displayName}
            onConfirm={() => deleteEnv.mutateAsync()}
          >
            <Button
              variant="outline"
              size="icon"
              className="text-muted-foreground hover:text-destructive hover:border-destructive shrink-0"
              disabled={isDeleting || !canSign}
              aria-label={`Delete ${displayName}`}
              title={
                canSign
                  ? 'Delete environment'
                  : viewOnly
                    ? 'Members of the organisation can view, not delete'
                    : 'Log in with Renown to delete'
              }
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </DeleteEnvironmentDialog>
        </div>
      </CardContent>
    </Card>
  )
}

// `UNCLAIMED` exists in ViewScope for the hook's in-memory filtering but is
// no longer surfaced in the UI. Non-admins only see their own environments
// (no toggle); admins can flip between Mine / All.
type VisibleScope = Exclude<ViewScope, 'UNCLAIMED'>

const SCOPE_LABELS: Record<VisibleScope, string> = {
  MINE: 'Mine',
  ALL: 'All',
}

const EMPTY_COPY: Record<VisibleScope, string> = {
  MINE: 'Create your first environment to get started.',
  ALL: 'No environments exist in the system.',
}

const ADMIN_SCOPE_OPTIONS: VisibleScope[] = ['MINE', 'ALL']

export function CloudEnvironments({
  filter,
  emptyCopy,
  compactEmpty = false,
}: {
  /** Keep only matching envs (e.g. standalone ones on the Apps home). */
  filter?: (env: CloudEnvironment) => boolean
  /** Override the empty-state copy. */
  emptyCopy?: string
  /** Render the empty state as a slim dashed row (for secondary sections). */
  compactEmpty?: boolean
} = {}) {
  const [scope, setScope] = useState<VisibleScope>('MINE')
  const { viewer } = useViewer()
  const { orgId, org } = useActiveOrg()
  const {
    environments: allEnvironments,
    isPending,
    isError,
    refetch,
  } = useEnvironments(scope, viewer?.address ?? null, { orgId })
  const environments = filter ? allEnvironments.filter(filter) : allEnvironments
  const isAdmin = viewer?.isAdmin ?? false
  const empty = orgId
    ? `No environments in ${org?.name ?? 'this organisation'} yet.`
    : (emptyCopy ?? EMPTY_COPY[scope])

  return (
    <div className="space-y-4">
      {/* Scope toggle is admin-only. Non-admins always see their own envs;
          in an organisation context the list is that organisation's envs. */}
      {isAdmin && !orgId && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">View:</span>
          <div className="bg-muted inline-flex rounded-md p-0.5">
            {ADMIN_SCOPE_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setScope(option)}
                className={`rounded px-3 py-1 transition-colors ${
                  scope === option
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {SCOPE_LABELS[option]}
              </button>
            ))}
          </div>
        </div>
      )}

      {isPending ? (
        <div
          role="status"
          aria-label="Loading environments"
          className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
        >
          {Array.from({ length: compactEmpty ? 1 : 3 }, (_, i) => (
            <div key={i} className="bg-card border-border space-y-4 rounded-xl border p-6">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-8 w-full" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div
          role="alert"
          className={
            compactEmpty
              ? 'text-muted-foreground flex flex-wrap items-center gap-3 rounded-xl border border-dashed px-5 py-4 text-sm'
              : 'flex min-h-[300px] flex-col items-center justify-center space-y-4 py-12 text-center'
          }
        >
          <AlertTriangle
            className={compactEmpty ? 'h-4 w-4 shrink-0' : 'text-muted-foreground h-12 w-12'}
            aria-hidden
          />
          <div>
            {!compactEmpty && (
              <h3 className="text-lg font-semibold">Couldn&rsquo;t load environments</h3>
            )}
            <p className="text-muted-foreground text-sm">
              {compactEmpty
                ? 'Couldn’t load environments.'
                : 'Something went wrong while loading your environments.'}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={refetch}>
            Retry
          </Button>
        </div>
      ) : environments.length === 0 && compactEmpty ? (
        <div className="text-muted-foreground flex items-center gap-3 rounded-xl border border-dashed px-5 py-4 text-sm">
          <Server className="h-4 w-4 shrink-0" aria-hidden />
          {empty}
        </div>
      ) : environments.length === 0 ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center space-y-4 py-12">
          <Server className="text-muted-foreground h-12 w-12" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">No environments yet</h3>
            <p className="text-muted-foreground text-sm">{empty}</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {environments.map((env) => (
            <CloudEnvironmentCard key={env.id} env={env} />
          ))}
        </div>
      )}
    </div>
  )
}
