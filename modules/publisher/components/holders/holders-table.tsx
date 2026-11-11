'use client'

import { Loader2 } from 'lucide-react'
import { CopyButton } from '@/modules/apps/components/copy-button'
import { StatusInline, StatusPill } from '@/modules/shared/components/status'
import { formatDate, formatTimestamp, timeFromNow } from '@/modules/shared/lib/time'
import { Button } from '@/modules/shared/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/modules/shared/components/ui/table'
import { dateRange, termName } from '../../lib/format'
import { canChangePlan, type HolderRow } from '../../lib/holders'
import { licenseStatusMeta, updateStatusMeta } from '../../lib/status'
import type { PublisherTerm, TemplateMode } from '../../types'
import { PersonName } from '@/modules/shared/components/person-name'

function EnvironmentCell({
  row,
  mode,
  unavailable,
}: {
  row: HolderRow
  mode: TemplateMode | null
  unavailable: boolean
}) {
  const env = row.environment
  // The environment belongs to the holder, so the publisher only sees its state, never a link.
  if (env) {
    return (
      <div className="space-y-0.5">
        <p className="font-medium break-words">{env.label || env.environmentId.slice(0, 8)}</p>
        {env.stoppedAt ? (
          <p className="text-warning text-xs">
            Stopped {formatDate(env.stoppedAt)}
            {env.deleteAfter && ` — deleted on ${formatDate(env.deleteAfter)}`}
          </p>
        ) : (
          <p className="text-muted-foreground text-xs">Running</p>
        )}
      </div>
    )
  }
  if (unavailable) return <span className="text-muted-foreground">—</span>
  if (mode === 'SHARED') return <span className="text-muted-foreground">Shared environment</span>
  if (mode === 'DEDICATED' && (row.status === 'ISSUED' || row.status === 'ACTIVE')) {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-1.5">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Being set up…
      </span>
    )
  }
  return <span className="text-muted-foreground">—</span>
}

const OPEN_UPDATE = new Set(['PENDING', 'APPLYING'])
const FAILED_UPDATE = new Set(['FAILED', 'REVERTED', 'RESTORED'])

/** What the environment runs, and the release it is waiting for or failed to take. */
function VersionCell({ row }: { row: HolderRow }) {
  const env = row.environment
  const update = env?.update ?? null
  const open = !!update && OPEN_UPDATE.has(update.status)
  const failed = !!update && FAILED_UPDATE.has(update.status)
  if (!env || (!env.runningVersion && !open && !failed)) {
    return <span className="text-muted-foreground">—</span>
  }
  return (
    <div className="space-y-1">
      {env.runningVersion && (
        <p className="inline-flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-xs break-all">{env.runningVersion}</span>
          {env.isCanary && (
            <span
              className="bg-info/15 text-info rounded-full px-1.5 py-px text-[10px] font-medium tracking-wide uppercase"
              title="Follows STAGING and takes releases first"
            >
              canary
            </span>
          )}
        </p>
      )}
      {update && open && (
        <div className="text-muted-foreground space-y-0.5 text-xs">
          <p className="font-mono break-all">→ {update.toVersion}</p>
          <p className="inline-flex flex-wrap items-center gap-x-2">
            <StatusInline meta={updateStatusMeta(update.status)} className="text-xs" />
            {update.status === 'PENDING' && (
              <span title={formatTimestamp(update.dueAt)}>due {timeFromNow(update.dueAt)}</span>
            )}
          </p>
          {/* While open, the error says why the update is waiting; it is not a failure yet. */}
          {update.error && <p className="text-muted-foreground break-words">{update.error}</p>}
        </div>
      )}
      {update && failed && (
        <p className="text-destructive/80 text-xs break-words">
          {updateStatusMeta(update.status).label}: update to{' '}
          <span className="font-mono">{update.toVersion}</span>
          {update.error && ` — ${update.error}`}
        </p>
      )}
    </div>
  )
}

export function HoldersTable({
  rows,
  terms,
  modeOf,
  environmentsUnavailable,
  onChangePlan,
  onRevoke,
}: {
  rows: HolderRow[]
  terms: PublisherTerm[]
  modeOf: (kind: string) => TemplateMode | null
  environmentsUnavailable: boolean
  onChangePlan: (row: HolderRow) => void
  onRevoke: (row: HolderRow) => void
}) {
  const planName = (kind: string) => {
    const t = terms.find((x) => x.kind === kind)
    return t ? termName(t) : kind
  }
  return (
    <div className="bg-card border-border overflow-x-auto rounded-xl border shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Holder</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Valid</TableHead>
            <TableHead>Environment</TableHead>
            <TableHead>Version</TableHead>
            <TableHead className="pr-4 text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const live = r.status === 'ACTIVE' || r.status === 'ISSUED'
            return (
              <TableRow key={r.id} data-testid={`holder-${r.id}`}>
                <TableCell className="pl-4">
                  <span className="inline-flex items-center gap-1 font-mono text-xs break-all">
                    <PersonName value={r.user} avatar />
                    <CopyButton value={r.user} label="Copy holder DID" />
                  </span>
                </TableCell>
                <TableCell>{planName(r.kind)}</TableCell>
                <TableCell>
                  <StatusPill meta={licenseStatusMeta(r.status)} />
                </TableCell>
                <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                  {dateRange(r.start, r.end)}
                </TableCell>
                <TableCell className="text-sm">
                  <EnvironmentCell
                    row={r}
                    mode={modeOf(r.kind)}
                    unavailable={environmentsUnavailable}
                  />
                </TableCell>
                <TableCell className="text-sm" data-testid="environment-version">
                  <VersionCell row={r} />
                </TableCell>
                <TableCell className="pr-4 text-right whitespace-nowrap">
                  {(live || canChangePlan(r)) && (
                    <div className="inline-flex gap-2">
                      {canChangePlan(r) && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={() => onChangePlan(r)}
                        >
                          Change plan
                        </Button>
                      )}
                      {live && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive h-8"
                          onClick={() => onRevoke(r)}
                        >
                          Revoke
                        </Button>
                      )}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
