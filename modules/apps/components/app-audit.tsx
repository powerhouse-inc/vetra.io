'use client'

import { Bot, ChevronDown, Loader2, ScrollText } from 'lucide-react'
import { useMemo, useState } from 'react'

import {
  EmptyState,
  TabError,
  TabHeader,
  TabSkeleton,
} from '@/modules/publisher/components/primitives'
import { PersonName } from '@/modules/shared/components/person-name'
import { Button } from '@/modules/shared/components/ui/button'
import { formatTimestamp, timeAgo } from '@/modules/shared/lib/time'
import { cn } from '@/shared/lib/utils'

import { describeAppsError } from '../graphql'
import { useAppAudit } from '../hooks/use-apps'
import {
  AUDIT_KINDS,
  AUDIT_SYSTEM_ACTOR,
  auditDetailText,
  auditGithubActor,
  auditSourceLabel,
  describeAuditEntry,
  filterAudit,
  type AuditKind,
} from '../lib/audit'
import type { AppAuditEntry } from '../types'

const SOURCE_CLASS: Record<string, string> = {
  console: 'bg-primary/10 text-primary',
  api: 'bg-accent text-foreground',
  ci: 'bg-success/15 text-success',
  system: 'bg-muted text-muted-foreground',
  policy: 'bg-warning/15 text-warning',
}

export function AuditSourceBadge({ source }: { source: string }) {
  return (
    <span
      className={cn(
        'shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium tracking-wide uppercase',
        SOURCE_CLASS[source] ?? 'bg-muted text-muted-foreground',
      )}
    >
      {auditSourceLabel(source)}
    </span>
  )
}

/** Who did it: their Renown name and picture, "Vetra", or CI's person with its GitHub login. */
export function AuditActor({ entry }: { entry: AppAuditEntry }) {
  if (entry.actor === AUDIT_SYSTEM_ACTOR) {
    return (
      <span className="inline-flex items-center gap-1.5 font-medium">
        <Bot className="h-4 w-4 shrink-0" aria-hidden />
        Vetra
      </span>
    )
  }
  const github = entry.source === 'ci' ? auditGithubActor(entry) : null
  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-x-1.5">
      <PersonName value={entry.actor} avatar className="font-medium" />
      {entry.source === 'ci' && (
        <span className="text-muted-foreground text-xs">
          via GitHub Actions{github ? ` (${github})` : ''}
        </span>
      )}
    </span>
  )
}

/** What was done, as one sentence with people by name. */
export function AuditSentence({ entry }: { entry: AppAuditEntry }) {
  return (
    <span>
      {describeAuditEntry(entry).map((part, i) =>
        typeof part === 'string' ? (
          <span key={i}>{part}</span>
        ) : (
          <PersonName key={i} value={part.person} className="font-medium" />
        ),
      )}
    </span>
  )
}

export function AuditRow({ entry }: { entry: AppAuditEntry }) {
  const [open, setOpen] = useState(false)
  return (
    <li data-testid={`audit-${entry.id}`} className="space-y-2 px-4 py-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-4">
        <time
          dateTime={entry.at}
          title={formatTimestamp(entry.at)}
          className="text-muted-foreground shrink-0 text-xs sm:w-28 sm:pt-0.5"
        >
          {timeAgo(entry.at)}
        </time>
        <div className="min-w-0 flex-1 space-y-1 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <AuditActor entry={entry} />
            <AuditSourceBadge source={entry.source} />
          </div>
          <p className="text-foreground/90 break-words">
            <AuditSentence entry={entry} />
          </p>
        </div>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1 self-start text-xs"
        >
          Details
          <ChevronDown
            className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')}
            aria-hidden
          />
        </button>
      </div>
      {open && (
        <pre className="bg-muted/50 overflow-x-auto rounded-lg p-3 font-mono text-xs">
          {auditDetailText(entry)}
        </pre>
      )}
    </li>
  )
}

function KindFilter({
  value,
  onChange,
}: {
  value: AuditKind | null
  onChange: (kind: AuditKind | null) => void
}) {
  const options = [{ value: null, label: 'All' }, ...AUDIT_KINDS]
  return (
    <div
      className="border-border inline-flex flex-wrap rounded-md border p-0.5"
      role="group"
      aria-label="Show"
    >
      {options.map((o) => (
        <button
          key={o.label}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded px-2.5 py-1 text-xs transition-colors',
            value === o.value
              ? 'bg-accent text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Audit log tab: who changed what about the App, when and from where, newest first. */
export function AppAudit({ appId }: { appId: string }) {
  const audit = useAppAudit(appId)
  const [kind, setKind] = useState<AuditKind | null>(null)
  const all = useMemo(() => audit.data?.pages.flatMap((p) => p.entries) ?? [], [audit.data])
  const rows = filterAudit(all, kind)

  return (
    <div className="space-y-6">
      <TabHeader
        title="Audit log"
        description="Changes to plans, settings and release managers, recorded releases and instance status changes, newest first. Kept for one year."
        action={<KindFilter value={kind} onChange={setKind} />}
      />
      {audit.isPending ? (
        <TabSkeleton label="Loading audit log" />
      ) : audit.error && all.length === 0 ? (
        <TabError
          error={new Error(describeAppsError(audit.error))}
          onRetry={() => void audit.refetch()}
          retrying={audit.isRefetching}
        />
      ) : (
        <>
          {rows.length === 0 ? (
            <EmptyState icon={ScrollText} title="Nothing recorded yet">
              {kind && audit.hasNextPage
                ? 'Nothing of this kind on the loaded pages. Load older entries to look further.'
                : 'Changes to this app show up here as they happen.'}
            </EmptyState>
          ) : (
            <ul className="bg-card border-border divide-border divide-y rounded-xl border shadow-sm">
              {rows.map((e) => (
                <AuditRow key={e.id} entry={e} />
              ))}
            </ul>
          )}
          {audit.isFetchNextPageError && (
            <p role="alert" className="text-destructive text-sm">
              {describeAppsError(audit.error)}
            </p>
          )}
          {audit.hasNextPage && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void audit.fetchNextPage()}
                disabled={audit.isFetchingNextPage}
              >
                {audit.isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin" />}
                Load more
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
