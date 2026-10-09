'use client'

import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Circle,
  GitBranch,
  GitCommitHorizontal,
  GitPullRequest,
  Settings2,
} from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/modules/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

import {
  deploymentStatusMeta,
  displayHost,
  githubCommitUrl,
  githubRepoUrl,
  identityState,
  isAppReadOnly,
  primaryUrl,
  refLabel,
  shortSha,
} from '../lib/status'
import { formatTimestamp, timeAgo } from '../lib/time'
import type { App, AppDeployment, AppPreview } from '../types'
import { AppAvatar } from './app-avatar'
import { AppProfileCard } from './profile/app-profile-card'
import { SetupDeploys } from './setup-deploys'
import { StatusDot, StatusInline, StatusPill } from './status'
import { UrlList } from './url-list'

function SectionTitle({
  children,
  action,
}: {
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold">{children}</h2>
      {action}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Getting started
// ---------------------------------------------------------------------------

function ChecklistItem({
  done,
  title,
  children,
}: {
  done: boolean
  title: string
  children?: React.ReactNode
}) {
  return (
    <li className="flex gap-4">
      <span
        className={cn(
          'border-border mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border',
          done ? 'bg-primary border-primary text-primary-foreground' : 'text-muted-foreground',
        )}
      >
        {done ? (
          <Check className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <Circle className="h-2 w-2" aria-hidden />
        )}
        <span className="sr-only">{done ? 'Done' : 'To do'}</span>
      </span>
      <div className="min-w-0 flex-1 space-y-3 pb-1">
        <p className={cn('font-medium', done && 'text-muted-foreground')}>{title}</p>
        {!done && children}
      </div>
    </li>
  )
}

/** Shown until the first deployment lands: what's left between "created" and "live". */
export function GettingStarted({
  app,
  hasDeployments,
  onAuthorize,
}: {
  app: App
  hasDeployments: boolean
  onAuthorize: () => void
}) {
  const identityDone = app.status !== 'PENDING_IDENTITY'
  return (
    <section className="bg-card border-border rounded-2xl border p-6 shadow-sm sm:p-8">
      <div className="mb-6 space-y-1">
        <h2 className="text-lg font-semibold">Finish setting up {app.name}</h2>
        <p className="text-muted-foreground text-sm">
          Three steps from here to a live production URL.
        </p>
      </div>
      <ol className="space-y-6">
        <ChecklistItem done title={`Connected ${app.repository.fullName}`} />
        <ChecklistItem done={identityDone} title="Authorize the deploy identity">
          <Button onClick={onAuthorize} size="sm">
            Authorize on Renown
            <ArrowRight className="h-4 w-4" />
          </Button>
        </ChecklistItem>
        <ChecklistItem done={hasDeployments} title="Add the workflow and push">
          <SetupDeploys app={app} />
        </ChecklistItem>
      </ol>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Production
// ---------------------------------------------------------------------------

/** Decorative browser frame around the production host — the App's "screenshot". */
function BrowserFrame({ app, url, live }: { app: App; url: string | null; live: boolean }) {
  return (
    <div className="bg-muted/40 border-border flex flex-col overflow-hidden rounded-xl border">
      <div className="bg-background/80 border-border flex items-center gap-2 border-b px-3 py-2">
        <span className="flex gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        </span>
        <span className="bg-muted text-muted-foreground ml-2 min-w-0 flex-1 truncate rounded-md px-2 py-0.5 text-center font-mono text-[11px]">
          {url ? displayHost(url) : 'not deployed yet'}
        </span>
      </div>
      <div className="relative flex min-h-44 flex-1 items-center justify-center overflow-hidden p-6">
        <div
          aria-hidden
          className={cn(
            'absolute inset-0 opacity-60',
            live
              ? 'bg-[radial-gradient(ellipse_at_center,var(--primary-30),transparent_70%)]'
              : 'bg-[radial-gradient(ellipse_at_center,var(--muted),transparent_70%)]',
          )}
        />
        <div className="relative flex flex-col items-center gap-3 text-center">
          <AppAvatar name={app.name} seed={app.id} size="lg" />
          <span className="text-sm font-medium">{app.name}</span>
        </div>
      </div>
    </div>
  )
}

function DeploymentMeta({ deployment, repo }: { deployment: AppDeployment; repo: string }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
      <dt className="text-muted-foreground">Status</dt>
      <dd>
        <StatusInline meta={deploymentStatusMeta(deployment.status)} />
      </dd>
      <dt className="text-muted-foreground">Source</dt>
      <dd className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-1">
          <GitBranch className="text-muted-foreground h-3.5 w-3.5" aria-hidden />
          {refLabel(deployment.gitRef)}
        </span>
        <a
          href={githubCommitUrl(repo, deployment.sha)}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-primary inline-flex items-center gap-1 font-mono"
        >
          <GitCommitHorizontal className="text-muted-foreground h-3.5 w-3.5" aria-hidden />
          {shortSha(deployment.sha)}
        </a>
      </dd>
      <dt className="text-muted-foreground">Deployed</dt>
      <dd title={formatTimestamp(deployment.createdAt)}>
        {timeAgo(deployment.createdAt)}
        {deployment.actorGithub && (
          <span className="text-muted-foreground"> by {deployment.actorGithub}</span>
        )}
      </dd>
      {deployment.error && (
        <>
          <dt className="text-muted-foreground">Error</dt>
          <dd className="text-destructive break-words">{deployment.error}</dd>
        </>
      )}
    </dl>
  )
}

function ProductionCard({ app, deployment }: { app: App; deployment: AppDeployment | null }) {
  const readOnly = isAppReadOnly(app)
  const url = primaryUrl(app.productionUrls)
  const meta = deploymentStatusMeta(deployment?.status)
  return (
    <section className="space-y-4" aria-labelledby="production-heading">
      <SectionTitle
        action={
          readOnly ? null : (
            <Button asChild variant="ghost" size="sm">
              <Link href={`/user/environments/${app.productionEnvironmentId}`}>
                <Settings2 className="h-4 w-4" />
                Environment
              </Link>
            </Button>
          )
        }
      >
        <span id="production-heading" className="flex items-center gap-2">
          Production
          <StatusPill meta={meta} />
        </span>
      </SectionTitle>
      <div className="bg-card border-border grid gap-6 rounded-2xl border p-4 shadow-sm sm:p-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <BrowserFrame app={app} url={url} live={deployment?.status === 'READY'} />
        <div className="flex min-w-0 flex-col gap-5">
          {deployment ? (
            <DeploymentMeta deployment={deployment} repo={app.repository.fullName} />
          ) : (
            <p className="text-muted-foreground text-sm">
              Nothing deployed yet. Push to{' '}
              <span className="text-foreground font-mono">{app.productionBranch}</span> to ship your
              first production deployment.
            </p>
          )}
          <UrlList urls={app.productionUrls} />
          {url && !readOnly && (
            <Button asChild className="self-start">
              <a href={url} target="_blank" rel="noopener noreferrer">
                Visit
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Previews
// ---------------------------------------------------------------------------

function PreviewRow({ preview }: { preview: AppPreview }) {
  const url = primaryUrl(preview.urls)
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="bg-info/10 text-info flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
          <GitPullRequest className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium">
            <a
              href={preview.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary"
            >
              #{preview.prNumber}
            </a>
            {preview.gitRef && (
              <span className="text-muted-foreground truncate font-mono text-xs">
                {refLabel(preview.gitRef)}
              </span>
            )}
          </p>
          <p className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
            <StatusDot meta={deploymentStatusMeta(preview.status)} />
            {deploymentStatusMeta(preview.status).label}
            {preview.lastDeployedAt && (
              <span title={formatTimestamp(preview.lastDeployedAt)}>
                · {timeAgo(preview.lastDeployedAt)}
              </span>
            )}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/user/environments/${preview.environmentId}`}>Environment</Link>
        </Button>
        {url ? (
          <Button asChild variant="outline" size="sm">
            <a href={url} target="_blank" rel="noopener noreferrer">
              Visit
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </Button>
        ) : null}
      </div>
    </li>
  )
}

function PreviewsSection({ app }: { app: App }) {
  return (
    <section className="space-y-4" aria-labelledby="previews-heading">
      <SectionTitle
        action={
          app.previewsEnabled ? (
            <span className="text-muted-foreground text-xs">
              {app.previews.length} of {app.previewLimit} · removed after {app.previewTtlDays} days
              idle
            </span>
          ) : null
        }
      >
        <span id="previews-heading">Previews</span>
      </SectionTitle>
      {!app.previewsEnabled ? (
        <div className="text-muted-foreground border-border rounded-xl border border-dashed px-5 py-6 text-sm">
          Previews are turned off. Enable them in Settings to get an environment for every pull
          request.
        </div>
      ) : app.previews.length === 0 ? (
        <div className="border-border flex flex-col items-start gap-3 rounded-xl border border-dashed px-5 py-6 text-sm sm:flex-row sm:items-center">
          <GitPullRequest className="text-muted-foreground h-5 w-5 shrink-0" aria-hidden />
          <p className="text-muted-foreground flex-1">
            Open a pull request in{' '}
            <span className="text-foreground font-medium">{app.repository.fullName}</span> and its
            preview environment shows up here.
          </p>
          <Button asChild variant="outline" size="sm">
            <a
              href={`${githubRepoUrl(app.repository.fullName)}/compare`}
              target="_blank"
              rel="noopener noreferrer"
            >
              New pull request
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
      ) : (
        <ul className="bg-card border-border divide-border divide-y rounded-xl border shadow-sm">
          {[...app.previews]
            .sort((a, b) => b.prNumber - a.prNumber)
            .map((p) => (
              <PreviewRow key={p.environmentId} preview={p} />
            ))}
        </ul>
      )}
    </section>
  )
}

/** Overview tab: getting-started (until live), production, previews. */
export function AppOverview({
  app,
  deployments,
  deploymentsLoaded,
  onAuthorize,
  onEditProfile,
}: {
  app: App
  deployments: AppDeployment[]
  deploymentsLoaded: boolean
  onAuthorize: () => void
  /** Opens the Profile tab; absent on read-only apps. */
  onEditProfile?: () => void
}) {
  const production =
    deployments.find((d) => d.kind === 'PRODUCTION') ??
    (app.latestDeployment?.kind === 'PRODUCTION' ? app.latestDeployment : null)
  const hasDeployments = deployments.length > 0 || !!app.latestDeployment
  const readOnly = isAppReadOnly(app)
  const showChecklist =
    !readOnly &&
    app.status !== 'DISCONNECTED' &&
    // Expired identities get the page banner; the checklist is for first-time setup.
    (identityState(app).kind === 'pending' || (deploymentsLoaded && !hasDeployments))

  return (
    <div className="space-y-10">
      {showChecklist && (
        <GettingStarted app={app} hasDeployments={hasDeployments} onAuthorize={onAuthorize} />
      )}
      <ProductionCard app={app} deployment={production} />
      <AppProfileCard appDid={app.identityDid} appName={app.name} onEdit={onEditProfile} />
      {!readOnly && <PreviewsSection app={app} />}
    </div>
  )
}
