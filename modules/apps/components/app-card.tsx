import { GitBranch, GitCommitHorizontal, GitPullRequest, Github, Globe } from 'lucide-react'
import Link from 'next/link'

import { appHeadlineStatus, displayHost, primaryUrl, refLabel, shortSha } from '../lib/status'
import { formatTimestamp, timeAgo } from '../lib/time'
import type { App } from '../types'
import { AppAvatar } from './app-avatar'
import { StatusPill } from './status'

/**
 * App tile on the Apps home. The whole card links to the App; the production
 * URL is its own link layered above the card's stretched link.
 */
export function AppCard({ app }: { app: App }) {
  const status = appHeadlineStatus(app)
  const url = primaryUrl(app.productionUrls)
  const latest = app.latestDeployment
  const previewCount = app.previews.length

  return (
    <article className="group bg-card border-border hover:border-primary/40 relative flex flex-col rounded-xl border p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start gap-3">
        <AppAvatar name={app.name} seed={app.id} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate leading-tight font-semibold">
            <Link
              href={`/user/apps/${app.id}`}
              className="focus-visible:ring-ring rounded-sm after:absolute after:inset-0 after:rounded-xl focus-visible:ring-2 focus-visible:outline-none"
            >
              {app.name}
            </Link>
          </h3>
          <p className="text-muted-foreground mt-1 flex items-center gap-1.5 truncate text-sm">
            <Github className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{app.repository.fullName}</span>
          </p>
        </div>
        <StatusPill meta={status} />
      </div>

      <div className="mt-4 min-h-5">
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground/80 hover:text-primary relative z-10 inline-flex max-w-full items-center gap-1.5 text-sm transition-colors"
          >
            <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{displayHost(url)}</span>
          </a>
        ) : (
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
            <Globe className="h-3.5 w-3.5" aria-hidden />
            Not live yet
          </span>
        )}
      </div>

      <div className="text-muted-foreground border-border mt-4 flex items-center justify-between gap-3 border-t pt-3 text-xs">
        {latest ? (
          <span
            className="flex min-w-0 items-center gap-2"
            title={formatTimestamp(latest.createdAt)}
          >
            <GitCommitHorizontal className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="text-foreground/80 font-mono">{shortSha(latest.sha)}</span>
            <span className="flex min-w-0 items-center gap-1">
              <GitBranch className="h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate">{refLabel(latest.gitRef)}</span>
            </span>
            <span className="shrink-0">· {timeAgo(latest.createdAt)}</span>
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <GitBranch className="h-3.5 w-3.5" aria-hidden />
            Waiting for the first push to {app.productionBranch}
          </span>
        )}
        <span
          className="flex shrink-0 items-center gap-1"
          title={`${previewCount} preview environment${previewCount === 1 ? '' : 's'}`}
        >
          <GitPullRequest className="h-3.5 w-3.5" aria-hidden />
          {previewCount}
          <span className="sr-only"> previews</span>
        </span>
      </div>
    </article>
  )
}
