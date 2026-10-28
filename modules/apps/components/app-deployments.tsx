'use client'

import {
  ExternalLink,
  GitPullRequest,
  History,
  Loader2,
  Package,
  RotateCcw,
  Rocket,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

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
import { EmptyState, TabError, TabSkeleton } from '@/modules/publisher/components/primitives'
import { Button } from '@/modules/shared/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/modules/shared/components/ui/table'
import { cn } from '@/shared/lib/utils'

import { describeAppsError } from '../graphql'
import { useRollbackApp } from '../hooks/use-apps'
import {
  canRollback,
  deploymentRowStatus,
  githubCommitUrl,
  githubPullUrl,
  isAppReadOnly,
  refLabel,
  shortSha,
} from '../lib/status'
import { formatTimestamp, timeAgo } from '../lib/time'
import type { App, AppDeployment } from '../types'
import { StatusInline } from '@/modules/shared/components/status'

function KindLabel({ d, repo }: { d: AppDeployment; repo: string }) {
  if (d.kind === 'PREVIEW' && d.prNumber != null) {
    return (
      <span className="flex flex-col">
        <a
          href={githubPullUrl(repo, d.prNumber)}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-primary inline-flex items-center gap-1.5 font-medium"
        >
          <GitPullRequest className="text-info h-3.5 w-3.5" aria-hidden />
          Preview #{d.prNumber}
        </a>
        <span className="text-muted-foreground truncate font-mono text-xs">
          {refLabel(d.gitRef)}
        </span>
      </span>
    )
  }
  return (
    <span className="flex flex-col">
      <span className="inline-flex items-center gap-1.5 font-medium">
        <Rocket className="text-primary h-3.5 w-3.5" aria-hidden />
        Production
      </span>
      <span className="text-muted-foreground truncate font-mono text-xs">{refLabel(d.gitRef)}</span>
    </span>
  )
}

function PackagesCell({ packages }: { packages: AppDeployment['packages'] }) {
  if (packages.length === 0) return <span className="text-muted-foreground">—</span>
  const [first, ...rest] = packages
  const all = packages.map((p) => `${p.name}@${p.version}`).join('\n')
  return (
    <span className="flex items-center gap-1.5" title={all}>
      <Package className="text-muted-foreground h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="max-w-[16rem] truncate font-mono text-xs">
        {first.name}@{first.version}
      </span>
      {rest.length > 0 && (
        <span className="bg-muted rounded px-1.5 py-0.5 text-[10px] font-medium">
          +{rest.length}
        </span>
      )}
    </span>
  )
}

function actorLabel(d: AppDeployment): string {
  if (d.actorGithub) return d.actorGithub
  if (d.actorDid) return d.actorDid.length > 20 ? `${d.actorDid.slice(0, 16)}…` : d.actorDid
  return '—'
}

function RollbackDialog({
  app,
  target,
  onClose,
}: {
  app: App
  target: AppDeployment | null
  onClose: () => void
}) {
  const rollback = useRollbackApp(app.id)
  const confirm = () => {
    if (!target) return
    rollback.mutate(target.id, {
      onSuccess: () => {
        toast.success(`Rolling back production to ${shortSha(target.sha)}`)
        onClose()
      },
      onError: (err) => toast.error(describeAppsError(err)),
    })
  }
  return (
    <AlertDialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Roll back production?</AlertDialogTitle>
          <AlertDialogDescription>
            Production is redeployed with the versions from{' '}
            <span className="text-foreground font-mono">{shortSha(target?.sha)}</span>. The next
            push to {app.productionBranch} deploys over it again.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {target && (target.packages.length > 0 || target.imageTag) && (
          <ul className="bg-muted/50 space-y-1 rounded-lg p-3 font-mono text-xs">
            {target.packages.map((p) => (
              <li key={p.name}>
                {p.name}@{p.version}
              </li>
            ))}
            {target.imageTag && <li>image: {target.imageTag}</li>}
          </ul>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={rollback.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              confirm()
            }}
            disabled={rollback.isPending}
          >
            {rollback.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Roll back
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** Deployments tab: full history with status, source, versions and rollback. */
export function AppDeployments({
  app,
  deployments,
  isPending,
  error,
  onRetry,
  retrying = false,
}: {
  app: App
  deployments: AppDeployment[]
  isPending: boolean
  error: Error | null
  /** Re-runs the deployments query after a failed load. */
  onRetry: () => void
  retrying?: boolean
}) {
  const [rollbackTarget, setRollbackTarget] = useState<AppDeployment | null>(null)
  // The newest READY production deployment is what's live; rolling back to it is a no-op.
  const liveProductionId = deployments.find(
    (d) => d.kind === 'PRODUCTION' && d.status === 'READY',
  )?.id
  const repo = app.repository.fullName
  const readOnly = isAppReadOnly(app)

  if (isPending) {
    return <TabSkeleton label="Loading deployments" />
  }
  if (error) {
    // TabError words publisher errors; hand it the apps copy instead.
    return (
      <TabError error={new Error(describeAppsError(error))} onRetry={onRetry} retrying={retrying} />
    )
  }
  if (deployments.length === 0) {
    return (
      <EmptyState icon={History} title="No deployments yet">
        Every push to {app.productionBranch} and every pull request shows up here.
      </EmptyState>
    )
  }

  return (
    <>
      <div className="bg-card border-border overflow-x-auto rounded-xl border shadow-sm">
        <Table>
          <TableHeader className="[&_tr]:border-border">
            <TableRow className="border-border">
              <TableHead className="pl-4">Status</TableHead>
              <TableHead>Deployment</TableHead>
              <TableHead>Commit</TableHead>
              <TableHead>Packages</TableHead>
              <TableHead>Image</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="pr-4 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deployments.map((d) => {
              const rollbackable = !readOnly && canRollback(d) && d.id !== liveProductionId
              const rowStatus = deploymentRowStatus(d, liveProductionId)
              return (
                <TableRow key={d.id} className="border-border">
                  <TableCell className="pl-4 align-top">
                    <StatusInline meta={rowStatus.meta} />
                    {rowStatus.note && (
                      <p
                        className={cn(
                          'mt-1 max-w-[14rem] truncate text-xs',
                          rowStatus.note.tone === 'danger'
                            ? 'text-destructive'
                            : 'text-muted-foreground',
                        )}
                        title={rowStatus.note.text}
                      >
                        {rowStatus.note.text}
                      </p>
                    )}
                    {d.id === liveProductionId && (
                      <span className="bg-primary/10 text-primary mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                        Current
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="align-top">
                    <KindLabel d={d} repo={repo} />
                  </TableCell>
                  <TableCell className="align-top">
                    <a
                      href={githubCommitUrl(repo, d.sha)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-primary font-mono text-xs"
                      title={d.sha}
                    >
                      {shortSha(d.sha)}
                    </a>
                  </TableCell>
                  <TableCell className="align-top">
                    <PackagesCell packages={d.packages} />
                  </TableCell>
                  <TableCell className="align-top font-mono text-xs">
                    {d.imageTag ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell
                    className="text-muted-foreground align-top text-xs"
                    title={d.actorDid ?? undefined}
                  >
                    {actorLabel(d)}
                  </TableCell>
                  <TableCell
                    className="text-muted-foreground align-top text-xs whitespace-nowrap"
                    title={formatTimestamp(d.createdAt)}
                  >
                    {timeAgo(d.createdAt)}
                  </TableCell>
                  <TableCell className="pr-4 text-right align-top">
                    <div className="flex justify-end gap-1">
                      {d.runUrl && (
                        <Button asChild variant="ghost" size="sm" className="h-7">
                          <a
                            href={d.runUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="GitHub Actions run"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Logs
                          </a>
                        </Button>
                      )}
                      {rollbackable && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7"
                          onClick={() => setRollbackTarget(d)}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Rollback
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      <RollbackDialog app={app} target={rollbackTarget} onClose={() => setRollbackTarget(null)} />
    </>
  )
}
