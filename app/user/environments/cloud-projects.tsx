'use client'

import { ExternalLink, Package, Server, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'

import { DRIVE_ID } from '@/modules/cloud/client'
import { loadEnvironmentController } from '@/modules/cloud/controller'
import { useCanSign } from '@/modules/cloud/hooks/use-can-sign'
import { useEnvironments, useViewer, type ViewScope } from '@/modules/cloud/hooks/use-environment'
import { useOptimisticMutation } from '@/modules/cloud/query/use-optimistic-mutation'
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
import { Button } from '@/modules/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/modules/shared/components/ui/card'

import type { CloudEnvironment } from './types'

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Draft', color: 'bg-muted-foreground' },
  CHANGES_PENDING: { label: 'Pending', color: 'bg-info' },
  CHANGES_APPROVED: { label: 'Approved', color: 'bg-info' },
  CHANGES_PUSHED: { label: 'Deploying', color: 'bg-warning' },
  DEPLOYING: { label: 'Deploying', color: 'bg-warning' },
  DEPLOYMENt_FAILED: { label: 'Failed', color: 'bg-destructive' },
  READY: { label: 'Ready', color: 'bg-success' },
  TERMINATING: { label: 'Terminating', color: 'bg-destructive' },
  DESTROYED: { label: 'Destroyed', color: 'bg-muted-foreground' },
  ARCHIVED: { label: 'Archived', color: 'bg-muted-foreground' },
  STOPPED: { label: 'Stopped', color: 'bg-muted-foreground' },
}

function StatusDot({ status }: { status: string }) {
  const config = STATUS_LABELS[status] ?? { label: status, color: 'bg-muted-foreground' }

  return (
    <span className="flex items-center gap-1.5 text-xs font-medium">
      <span className={`inline-block h-2 w-2 rounded-full ${config.color}`} />
      {config.label}
    </span>
  )
}

function CloudEnvironmentCard({ env }: { env: CloudEnvironment }) {
  const { signer, canSign } = useCanSign()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const displayName = env.state.label || env.name || 'Unnamed'
  const packageCount = env.state.packages.length

  // Visit link to the live env (CONNECT URL). Mirror the field accessors
  // used by app/user/environments/[project]/page.tsx so listing + detail stay in sync.
  const connectService = env.state.services.find((s) => s.type === 'CONNECT' && s.enabled)
  const subdomain = env.state.genericSubdomain ?? null
  const baseDomain = env.state.genericBaseDomain ?? 'vetra.io'
  const visitUrl =
    env.state.status === 'READY' && subdomain && connectService
      ? `https://${connectService.prefix}.${subdomain}.${baseDomain}`
      : null

  // Optimistic delete: the card vanishes from every cached env list (and the
  // studio products grid) the instant the user confirms; on failure the
  // snapshot is restored and a toast surfaces the error.
  const deleteEnv = useOptimisticMutation<void, void>({
    mutationFn: async () => {
      if (!signer) throw new Error('You must be logged in with Renown to delete an environment')
      const ctrl = await loadEnvironmentController({
        documentId: env.id,
        parentIdentifier: DRIVE_ID,
        signer,
      })
      await ctrl.delete()
    },
    affectedKeys: () => [['environments'], ['studio-products']],
    optimisticUpdate: (qc) => {
      qc.setQueriesData<{ id: string }[]>({ queryKey: ['environments'] }, (old) =>
        Array.isArray(old) ? old.filter((e) => e?.id !== env.id) : old,
      )
      qc.setQueriesData<{ envId: string }[]>({ queryKey: ['studio-products'] }, (old) =>
        Array.isArray(old) ? old.filter((p) => p?.envId !== env.id) : old,
      )
    },
    onSuccess: () => toast.success('Environment deleted successfully'),
    onError: (error) => {
      console.error('Failed to delete environment:', error)
      toast.error(error.message || 'Failed to delete environment')
    },
  })
  const isDeleting = deleteEnv.isPending

  const handleDelete = () => {
    setShowDeleteDialog(false)
    deleteEnv.mutate()
  }

  const enabledServices = env.state.services.filter((s) => s.enabled)

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Server className="h-4 w-4" />
          {displayName}
        </CardTitle>
        <StatusDot status={env.state.status} />
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
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
          <Button variant="default" size="sm" asChild className="flex-1">
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
          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <Button
              variant="outline"
              size="icon"
              className="text-muted-foreground hover:text-destructive hover:border-destructive shrink-0"
              onClick={() => setShowDeleteDialog(true)}
              disabled={isDeleting || !canSign}
              title={canSign ? 'Delete environment' : 'Log in with Renown to delete'}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete environment?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete &quot;{displayName}&quot;. This action cannot be
                  undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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

export function CloudEnvironments() {
  const [scope, setScope] = useState<VisibleScope>('MINE')
  const { viewer } = useViewer()
  const environments = useEnvironments(scope, viewer?.address ?? null)
  const isAdmin = viewer?.isAdmin ?? false

  return (
    <div className="space-y-4">
      {/* Scope toggle is admin-only. Non-admins always see their own envs. */}
      {isAdmin && (
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

      {environments.length === 0 ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center space-y-4 py-12">
          <Server className="text-muted-foreground h-12 w-12" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">No environments yet</h3>
            <p className="text-muted-foreground text-sm">{EMPTY_COPY[scope]}</p>
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
