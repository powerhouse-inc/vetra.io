'use client'

import {
  ArrowUpRight,
  ChevronRight,
  GitBranch,
  GitPullRequest,
  Tag,
  TriangleAlert,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'

import {
  EmptyState,
  TabError,
  TabHeader,
  TabSkeleton,
} from '@/modules/publisher/components/primitives'
import { Button } from '@/modules/shared/components/ui/button'
import { formatTimestamp, timeAgo } from '@/modules/shared/lib/time'
import { cn } from '@/shared/lib/utils'

import { describeAppsError } from '../graphql'
import { useAppReleases } from '../hooks/use-apps'
import {
  RELEASES_LIMIT,
  RELEASES_MORE_LIMIT,
  releaseBadge,
  releasePackageUrl,
  shortDigest,
  type ReleaseBadge,
} from '../lib/releases'
import { githubCommitUrl, githubPullUrl, shortSha } from '../lib/status'
import type { AppRelease, AppReleaseKind } from '../types'
import { CopyButton } from './copy-button'
import { MarkdownLite } from './profile/markdown-lite'

const PUBLISH_README = 'https://github.com/powerhouse-inc/vetra-publish#readme'

const FILTERS: { label: string; kind: AppReleaseKind | null }[] = [
  { label: 'All', kind: null },
  { label: 'Releases', kind: 'release' },
  { label: 'Builds', kind: 'build' },
]

const BADGE_CLASS: Record<ReleaseBadge, string> = {
  Release: 'bg-success/15 text-success',
  Prerelease: 'bg-info/15 text-info',
  Build: 'bg-muted text-muted-foreground',
}

/** The empty state, worded for the filter in use. */
const EMPTY: Record<AppReleaseKind | 'all', { title: string; body: string }> = {
  all: {
    title: 'Nothing published yet',
    body: "No releases yet. Releases and builds appear here once the app's workflow runs powerhouse-inc/vetra-publish.",
  },
  release: {
    title: 'No releases yet',
    body: "Releases appear here once the app's workflow publishes one with powerhouse-inc/vetra-publish.",
  },
  build: {
    title: 'No builds yet',
    body: "Builds from release branches and pull requests appear here once the app's workflow runs powerhouse-inc/vetra-publish.",
  },
}

const LINK_CLASS = 'hover:text-primary underline-offset-2 hover:underline'

function KindFilter({
  value,
  onChange,
}: {
  value: AppReleaseKind | null
  onChange: (kind: AppReleaseKind | null) => void
}) {
  return (
    <div
      className="border-border inline-flex rounded-md border p-0.5"
      role="group"
      aria-label="Show"
    >
      {FILTERS.map((f) => (
        <button
          key={f.label}
          type="button"
          aria-pressed={value === f.kind}
          onClick={() => onChange(f.kind)}
          className={cn(
            'rounded px-2.5 py-1 text-xs transition-colors',
            value === f.kind
              ? 'bg-accent text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  )
}

function Source({ release, repository }: { release: AppRelease; repository: string }) {
  if (release.pr !== null) {
    return (
      <span className="inline-flex items-center gap-1">
        <GitPullRequest className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <a
          href={githubPullUrl(repository, release.pr)}
          target="_blank"
          rel="noopener noreferrer"
          className={LINK_CLASS}
        >
          PR #{release.pr}
        </a>
      </span>
    )
  }
  if (!release.branch) return null
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <GitBranch className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="truncate font-mono">{release.branch}</span>
    </span>
  )
}

function Commit({ sha, repository }: { sha: string; repository: string }) {
  return (
    <a
      href={githubCommitUrl(repository, sha)}
      target="_blank"
      rel="noopener noreferrer"
      title={sha}
      className={cn('font-mono', LINK_CLASS)}
    >
      {shortSha(sha)}
    </a>
  )
}

/** A muted label over a value, as in the details of an expanded row. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</p>
      {children}
    </div>
  )
}

function Notes({ label, text }: { label: string; text: string }) {
  return (
    <Field label={label}>
      <MarkdownLite text={text} className="text-sm" />
    </Field>
  )
}

function ReleaseDetails({ release }: { release: AppRelease }) {
  return (
    <div
      data-testid={`release-details-${release.version}`}
      className="bg-muted/30 border-border grid gap-5 border-t px-4 py-4 pl-11 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"
    >
      <div className="min-w-0 space-y-4">
        {release.notes ? (
          <Notes label="Release notes" text={release.notes} />
        ) : (
          <Field label="Release notes">
            <p className="text-muted-foreground text-sm">No release notes.</p>
          </Field>
        )}
        {/* Vetra starts customer notes as a copy of the release notes; show them once edited. */}
        {release.customerNotes && release.customerNotes !== release.notes && (
          <Notes label="Notes for owners" text={release.customerNotes} />
        )}
      </div>
      <div className="min-w-0 space-y-4">
        <Field label="Image">
          <p className="flex items-center gap-1">
            <span className="min-w-0 font-mono text-xs break-all">{release.imageRef}</span>
            <CopyButton value={release.imageRef} label="Copy image" className="h-7 w-7 shrink-0" />
          </p>
          <p className="flex items-center gap-1">
            <span className="text-muted-foreground font-mono text-xs" title={release.imageDigest}>
              {shortDigest(release.imageDigest)}
            </span>
            <CopyButton
              value={release.imageDigest}
              label="Copy digest"
              className="h-7 w-7 shrink-0"
            />
          </p>
        </Field>
        <Field label="Packages">
          {release.packages.length === 0 ? (
            <p className="text-muted-foreground text-sm">None</p>
          ) : (
            <ul className="space-y-1 font-mono text-xs">
              {release.packages.map((p) => {
                const label = `${p.name}@${p.version}`
                const href = releasePackageUrl(release, p.name)
                return (
                  <li key={p.name} className="break-all">
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn('inline-flex items-center gap-0.5', LINK_CLASS)}
                      >
                        {label}
                        <ArrowUpRight className="h-3 w-3 shrink-0" aria-hidden />
                      </a>
                    ) : (
                      label
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </Field>
      </div>
    </div>
  )
}

function ReleaseRow({ release, repository }: { release: AppRelease; repository: string }) {
  const [open, setOpen] = useState(false)
  const badge = releaseBadge(release)
  return (
    <li data-testid={`release-${release.version}`}>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((x) => !x)}
          className="hover:text-primary inline-flex min-w-0 items-center gap-2 text-left sm:w-80"
        >
          <ChevronRight
            className={cn(
              'text-muted-foreground h-4 w-4 shrink-0 transition-transform',
              open && 'rotate-90',
            )}
            aria-hidden
          />
          <span className="font-mono text-sm break-all">{release.version}</span>
          <span
            className={cn(
              'shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium tracking-wide uppercase',
              BADGE_CLASS[badge],
            )}
          >
            {badge}
          </span>
        </button>
        <div className="text-muted-foreground flex min-w-0 flex-1 flex-wrap items-center gap-x-5 gap-y-1 text-xs">
          <Source release={release} repository={repository} />
          <Commit sha={release.commit} repository={repository} />
          <span title={formatTimestamp(release.createdAt)} className="whitespace-nowrap">
            {timeAgo(release.createdAt)}
          </span>
          <span className="inline-flex items-center gap-1" title="Powerhouse version">
            <span>Powerhouse</span>
            <span className="text-foreground font-mono">{release.powerhouseVersion}</span>
          </span>
          {release.migrates && (
            <span
              className="bg-warning/15 text-warning inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-medium tracking-wide uppercase"
              title="Updating to this version migrates data"
            >
              <TriangleAlert className="h-3 w-3" aria-hidden />
              Migrates
            </span>
          )}
        </div>
      </div>
      {open && <ReleaseDetails release={release} />}
    </li>
  )
}

/** Releases tab: the versions vetra-publish recorded for the app, newest first. Read-only. */
export function AppReleases({
  appId,
  repository,
}: {
  appId: string
  /** `owner/name` on GitHub, for PR and commit links. Null (no repository): nothing to show. */
  repository: string | null
}) {
  const [kind, setKind] = useState<AppReleaseKind | null>(null)
  const [limit, setLimit] = useState(RELEASES_LIMIT)
  const releases = useAppReleases(appId, kind, limit, repository !== null)
  const list = releases.data ?? []
  const canShowMore = limit < RELEASES_MORE_LIMIT && list.length >= limit
  const empty = EMPTY[kind ?? 'all']

  const changeKind = (next: AppReleaseKind | null) => {
    setKind(next)
    setLimit(RELEASES_LIMIT)
  }

  if (repository === null) return null

  return (
    <div className="space-y-6">
      <TabHeader
        title="Releases"
        description="Versions your workflow published with vetra-publish: releases, and builds from release branches and pull requests."
        action={<KindFilter value={kind} onChange={changeKind} />}
      />
      {releases.isPending ? (
        <TabSkeleton label="Loading releases" />
      ) : releases.error ? (
        // TabError words publisher errors; hand it the apps copy instead.
        <TabError
          error={new Error(describeAppsError(releases.error))}
          onRetry={() => void releases.refetch()}
          retrying={releases.isRefetching}
        />
      ) : list.length === 0 ? (
        <EmptyState
          icon={Tag}
          title={empty.title}
          action={
            <Button asChild variant="outline" size="sm">
              <a href={PUBLISH_README} target="_blank" rel="noopener noreferrer">
                Set up vetra-publish
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </Button>
          }
        >
          {empty.body}
        </EmptyState>
      ) : (
        <>
          <ul className="bg-card border-border divide-border divide-y overflow-hidden rounded-xl border shadow-sm">
            {list.map((r) => (
              <ReleaseRow key={r.version} release={r} repository={repository} />
            ))}
          </ul>
          {canShowMore && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLimit(RELEASES_MORE_LIMIT)}
              disabled={releases.isFetching}
            >
              Show more
            </Button>
          )}
        </>
      )}
    </div>
  )
}
