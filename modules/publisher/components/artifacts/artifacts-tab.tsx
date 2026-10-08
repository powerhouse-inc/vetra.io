'use client'

import { BookOpen, Box, Container, PackageOpen } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { CopyButton } from '@/modules/apps/components/copy-button'
import { Button } from '@/modules/shared/components/ui/button'
import { usePublisherAppArtifacts } from '../../hooks/use-publisher'
import { artifactKindLabel, channelLabel } from '../../lib/artifacts'
import type { PublisherAppArtifact } from '../../types'
import { EmptyState, TabError, TabHeader, TabSkeleton } from '../primitives'

const VISIBLE = 5

function ArtifactCard({ artifact }: { artifact: PublisherAppArtifact }) {
  const [all, setAll] = useState(false)
  const newestFirst = [...artifact.versions].reverse()
  const shown = all ? newestFirst : newestFirst.slice(0, VISIBLE)
  const Icon = artifact.kind === 'FUSION_IMAGE' ? Container : Box
  return (
    <article
      data-testid={`artifact-${artifact.name}`}
      className="bg-card border-border space-y-4 rounded-xl border p-5 shadow-sm"
    >
      <header className="flex items-start gap-3">
        <span className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-mono text-sm font-semibold">{artifact.name}</h3>
          <p className="text-muted-foreground text-xs">
            <span>{artifactKindLabel(artifact.kind)}</span> · <span>{artifact.versions.length} published</span>
          </p>
        </div>
      </header>
      {artifact.channels.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Channels">
          {artifact.channels.map((c) => (
            <li
              key={c.channel}
              className="bg-muted inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"
            >
              <span className="font-medium">{channelLabel(c.channel)}</span>
              <span className="text-muted-foreground font-mono">{c.version}</span>
            </li>
          ))}
        </ul>
      )}
      <ul className="divide-border divide-y text-sm">
        {shown.map((v) => (
          <li key={v.version} data-testid="artifact-version" className="flex items-center gap-3 py-2">
            <span className="w-24 shrink-0 font-mono">{v.version}</span>
            <span className="text-muted-foreground min-w-0 flex-1 truncate font-mono text-xs">
              {v.reference}
            </span>
            <CopyButton value={v.reference} label={`Copy reference of ${v.version}`} />
          </li>
        ))}
      </ul>
      {newestFirst.length > VISIBLE && (
        <Button variant="ghost" size="sm" onClick={() => setAll((x) => !x)}>
          {all ? 'Show fewer' : `Show all ${newestFirst.length} versions`}
        </Button>
      )}
    </article>
  )
}

/** Read-only: what CI has published for this app. Templates pick from this list. */
export function ArtifactsTab({ appId }: { appId: string }) {
  const artifacts = usePublisherAppArtifacts(appId)
  const list = artifacts.data ?? []
  return (
    <div className="space-y-6">
      <TabHeader
        title="Artifacts"
        description="Packages and app images your deploy workflow has published. Templates use them to decide what every owner runs."
      />
      {artifacts.isPending ? (
        <TabSkeleton label="Loading artifacts" />
      ) : artifacts.error ? (
        <TabError
          error={artifacts.error}
          onRetry={() => void artifacts.refetch()}
          retrying={artifacts.isRefetching}
        />
      ) : list.length === 0 ? (
        <EmptyState
          icon={PackageOpen}
          title="Nothing published yet"
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/docs/deploy">
                <BookOpen className="h-4 w-4" />
                Deploy guide
              </Link>
            </Button>
          }
        >
          Artifacts appear here after the Vetra deploy workflow publishes a package or an app image.
        </EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {list.map((a) => (
            <ArtifactCard key={`${a.kind}:${a.name}`} artifact={a} />
          ))}
        </div>
      )}
    </div>
  )
}
