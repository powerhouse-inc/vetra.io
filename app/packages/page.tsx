import type { Metadata } from 'next'
import Link from 'next/link'
import { CopyButton } from '@/modules/apps/components/copy-button'
import { PageHeader } from '@/modules/shared/components/page-header'
import { PageShell } from '@/modules/shared/components/page-shell'
import { Button } from '@/modules/shared/components/ui/button'
import { timeAgo } from '@/modules/shared/lib/time'
import { cn } from '@/modules/shared/lib/utils'
import {
  directoryView,
  HIDDEN_REASON_LABEL,
  hiddenReason,
  loadDirectory,
  type DirectoryEntry,
  type DirectoryTab,
} from './lib/directory'
import { type PackageModuleType } from './lib/types'

export const revalidate = 600

export const metadata: Metadata = {
  title: 'Packages',
  description: 'Document models, editors and apps you can install on a Vetra environment.',
}

const TABS: { id: DirectoryTab; label: string }[] = [
  { id: 'updated', label: 'Recently updated' },
  { id: 'new', label: 'New' },
  { id: 'recommended', label: 'Recommended' },
]

const MODULE_LABEL: Record<PackageModuleType, [one: string, many: string]> = {
  documentModels: ['document model', 'document models'],
  editors: ['editor', 'editors'],
  apps: ['app', 'apps'],
  subgraphs: ['subgraph', 'subgraphs'],
  processors: ['processor', 'processors'],
}

type SearchParams = Promise<{ tab?: string; q?: string; all?: string }>

function href(params: { tab: DirectoryTab; q: string; all: boolean }): string {
  const search = new URLSearchParams()
  if (params.tab !== 'updated') search.set('tab', params.tab)
  if (params.q) search.set('q', params.q)
  if (params.all) search.set('all', '1')
  const query = search.toString()
  return query ? `/packages?${query}` : '/packages'
}

async function loadView(tab: DirectoryTab, q: string, all: boolean) {
  try {
    const entries = await loadDirectory()
    const now = Date.now()
    return {
      ...directoryView(entries, { tab, query: q, showHidden: all }, now),
      now,
      failed: false,
    }
  } catch {
    return { entries: [], hiddenCount: 0, now: Date.now(), failed: true }
  }
}

export default async function PackagesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const tab = TABS.some((t) => t.id === params.tab) ? (params.tab as DirectoryTab) : 'updated'
  const q = params.q ?? ''
  const all = params.all === '1'
  const view = await loadView(tab, q, all)

  return (
    <PageShell>
      <PageHeader
        eyebrow="~/packages"
        title="Packages"
        description="Document models, editors and apps you can install on a Vetra environment."
      />

      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
        <nav aria-label="Sort" className="border-border flex gap-1 border-b sm:flex-1">
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={href({ tab: t.id, q, all })}
              aria-current={t.id === tab ? 'page' : undefined}
              className={cn(
                '-mb-px border-b-2 px-3 py-2 text-sm transition-colors',
                t.id === tab
                  ? 'border-primary text-foreground'
                  : 'text-muted-foreground hover:text-foreground border-transparent',
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        <form action="/packages" className="flex gap-2">
          {tab !== 'updated' && <input type="hidden" name="tab" value={tab} />}
          {all && <input type="hidden" name="all" value="1" />}
          <input
            id="package-search"
            name="q"
            defaultValue={q}
            placeholder="Search packages"
            aria-label="Search packages"
            className="border-input bg-background focus-visible:ring-ring h-9 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none sm:w-64"
          />
        </form>
      </div>

      {view.failed ? (
        <p className="text-muted-foreground mt-10 text-sm">
          The package registry did not answer. Try again in a minute.
        </p>
      ) : view.entries.length === 0 ? (
        <p className="text-muted-foreground mt-10 text-sm">
          {q ? `No package matches “${q}”.` : 'No packages here yet.'}
        </p>
      ) : (
        <ul className="divide-border border-border bg-card mt-6 divide-y rounded-xl border">
          {view.entries.map((entry) => (
            <PackageRow key={entry.name} entry={entry} now={view.now} />
          ))}
        </ul>
      )}

      {view.hiddenCount > 0 && (
        <p className="text-muted-foreground mt-4 text-sm">
          {view.hiddenCount} older package{view.hiddenCount === 1 ? ' is' : 's are'} hidden:
          deprecated, built for an older platform, or not released in 12 months.{' '}
          <Link href={href({ tab, q, all: true })} className="text-primary hover:underline">
            Show them
          </Link>
        </p>
      )}
    </PageShell>
  )
}

function PackageRow({ entry, now }: { entry: DirectoryEntry; now: number }) {
  const reason = hiddenReason(entry, now)
  const modules = Object.entries(entry.modules) as [PackageModuleType, number][]
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-medium break-all">{entry.name}</span>
          {entry.recommended && (
            <span className="border-primary/40 text-primary rounded-full border px-2 text-xs">
              Recommended
            </span>
          )}
          {reason && (
            <span className="border-warning/40 text-warning rounded-full border px-2 text-xs">
              {HIDDEN_REASON_LABEL[reason]}
            </span>
          )}
        </div>
        {entry.description && (
          <p className="text-muted-foreground line-clamp-2 text-sm">{entry.description}</p>
        )}
        <p className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {entry.publisher && <span>{entry.publisher}</span>}
          {entry.category && <span>{entry.category}</span>}
          {modules.map(([type, count]) => (
            <span key={type}>
              {count} {MODULE_LABEL[type][count === 1 ? 0 : 1]}
            </span>
          ))}
        </p>
      </div>
      <div className="flex shrink-0 flex-col gap-2 sm:items-end">
        <p className="text-muted-foreground font-mono text-xs">
          {entry.version && <span className="text-foreground">{entry.version}</span>}
          {entry.releasedAt && <span> · {timeAgo(entry.releasedAt)}</span>}
        </p>
        <div className="flex gap-2">
          <CopyButton value={`ph install ${entry.name}`} label="Copy install" />
          <Button asChild size="sm" variant="outline">
            <Link href={`/user/environments?addPackage=${encodeURIComponent(entry.name)}`}>
              Add to environment
            </Link>
          </Button>
        </div>
      </div>
    </li>
  )
}
