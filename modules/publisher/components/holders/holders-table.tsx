'use client'

import { Loader2 } from 'lucide-react'
import { CopyButton } from '@/modules/apps/components/copy-button'
import { StatusPill } from '@/modules/apps/components/status'
import { formatDate } from '@/modules/apps/lib/time'
import { Button } from '@/modules/shared/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/modules/shared/components/ui/table'
import { dateRange, shortDid, termName } from '../../lib/format'
import { canChangePlan, type HolderRow } from '../../lib/holders'
import { licenseStatusMeta } from '../../lib/status'
import type { PublisherTerm, TemplateMode } from '../../types'

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
                    {shortDid(r.user)}
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
